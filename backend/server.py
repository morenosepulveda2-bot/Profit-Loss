from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import pandas as pd
import io
from collections import defaultdict
import pdfplumber
import re
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="Profit & Loss API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============ Models ============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: EmailStr
    hashed_password: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    type: str  # "income" or "expense"
    is_predefined: bool = False
    is_cogs: bool = False  # True if this expense category is Cost of Goods Sold
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CategoryCreate(BaseModel):
    name: str
    type: str
    is_cogs: Optional[bool] = False

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str
    amount: float
    category_id: str
    payment_method: str
    description: Optional[str] = None
    source: str = "manual"  # "manual", "csv", "toast"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SaleCreate(BaseModel):
    date: str
    amount: float
    category_id: str
    payment_method: str
    description: Optional[str] = None

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str
    amount: float
    category_id: str
    description: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ExpenseCreate(BaseModel):
    date: str
    amount: float
    category_id: str
    description: Optional[str] = None

class DashboardSummary(BaseModel):
    total_income: float
    total_expenses: float
    net_profit: float
    total_cogs: float
    cogs_percentage: float
    gross_profit: float
    gross_margin: float
    income_by_category: Dict[str, float]
    expenses_by_category: Dict[str, float]
    sales_by_payment: Dict[str, float]

class MonthComparison(BaseModel):
    month: str
    income: float
    expenses: float
    profit: float
    growth_percentage: Optional[float] = None

class CheckStatus(str, Enum):
    PENDING = "pending"  # Cheque emitido, no cobrado
    CLEARED = "cleared"  # Cheque cobrado (matched con banco)
    CANCELLED = "cancelled"  # Cheque cancelado

class Check(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    check_number: str
    date_issued: str
    amount: float
    payee: str  # A favor de
    description: Optional[str] = None
    status: str = CheckStatus.PENDING
    date_cleared: Optional[str] = None
    bank_transaction_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CheckCreate(BaseModel):
    check_number: str
    date_issued: str
    amount: float
    payee: str
    description: Optional[str] = None

class BankTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    statement_id: str
    date: str
    description: str
    amount: float
    type: str  # "debit" or "credit"
    check_number: Optional[str] = None
    matched_check_id: Optional[str] = None
    matched_expense_id: Optional[str] = None
    category_id: Optional[str] = None
    validated: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BankTransactionCreate(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    check_number: Optional[str] = None

class BankTransactionUpdate(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    check_number: Optional[str] = None
    category_id: Optional[str] = None
    validated: Optional[bool] = None

class BankStatement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    filename: str
    period_start: str
    period_end: str
    starting_balance: float
    ending_balance: float
    transactions_count: int
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ReconciliationReport(BaseModel):
    statement_balance: float
    book_balance: float
    outstanding_checks: List[Check]
    deposits_in_transit: List[Dict[str, Any]]
    outstanding_checks_total: float
    deposits_in_transit_total: float
    reconciled_balance: float
    difference: float

# ============ Helper Functions ============

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

async def initialize_predefined_categories(user_id: str):
    """Initialize predefined categories for new user"""
    predefined_income = [
        "Ventas de Productos",
        "Servicios",
        "Propinas",
        "Otros Ingresos"
    ]
    # (name, is_cogs)
    predefined_expenses = [
        ("Costo de Mercancía Vendida", True),  # COGS
        ("Inventario/Productos", True),  # COGS
        ("Renta", False),
        ("Nómina", False),
        ("Marketing", False),
        "Servicios Públicos",
        "Mantenimiento",
        "Otros Gastos"
    ]
    
    categories = []
    for name in predefined_income:
        cat = Category(user_id=user_id, name=name, type="income", is_predefined=True, is_cogs=False)
        categories.append(cat.model_dump())
    
    for expense in predefined_expenses:
        if isinstance(expense, tuple):
            name, is_cogs = expense
            cat = Category(user_id=user_id, name=name, type="expense", is_predefined=True, is_cogs=is_cogs)
        else:
            cat = Category(user_id=user_id, name=expense, type="expense", is_predefined=True, is_cogs=False)
        categories.append(cat.model_dump())
    
    if categories:
        await db.categories.insert_many(categories)

# ============ Authentication Routes ============

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password)
    )
    
    await db.users.insert_one(user.model_dump())
    
    # Initialize predefined categories
    await initialize_predefined_categories(user.id)
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user or not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        }
    }

# ============ Category Routes ============

@api_router.get("/categories", response_model=List[Category])
async def get_categories(current_user: dict = Depends(get_current_user)):
    categories = await db.categories.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return categories

@api_router.post("/categories", response_model=Category)
async def create_category(category_data: CategoryCreate, current_user: dict = Depends(get_current_user)):
    category = Category(
        user_id=current_user["id"],
        name=category_data.name,
        type=category_data.type,
        is_predefined=False,
        is_cogs=category_data.is_cogs if category_data.type == "expense" else False
    )
    await db.categories.insert_one(category.model_dump())
    return category

@api_router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, category_data: CategoryCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.categories.find_one({"id": category_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if existing.get("is_predefined", False):
        raise HTTPException(status_code=400, detail="Cannot modify predefined categories")
    
    update_data = {"name": category_data.name, "type": category_data.type}
    if category_data.type == "expense":
        update_data["is_cogs"] = category_data.is_cogs
    else:
        update_data["is_cogs"] = False
    
    await db.categories.update_one(
        {"id": category_id, "user_id": current_user["id"]},
        {"$set": update_data}
    )
    
    updated = await db.categories.find_one({"id": category_id}, {"_id": 0})
    return updated

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: dict = Depends(get_current_user)):
    existing = await db.categories.find_one({"id": category_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if existing.get("is_predefined", False):
        raise HTTPException(status_code=400, detail="Cannot delete predefined categories")
    
    await db.categories.delete_one({"id": category_id, "user_id": current_user["id"]})
    return {"message": "Category deleted successfully"}

# ============ Sales Routes ============

@api_router.get("/sales", response_model=List[Sale])
async def get_sales(current_user: dict = Depends(get_current_user)):
    sales = await db.sales.find({"user_id": current_user["id"]}, {"_id": 0}).sort("date", -1).to_list(10000)
    return sales

@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: dict = Depends(get_current_user)):
    sale = Sale(
        user_id=current_user["id"],
        date=sale_data.date,
        amount=sale_data.amount,
        category_id=sale_data.category_id,
        payment_method=sale_data.payment_method,
        description=sale_data.description,
        source="manual"
    )
    await db.sales.insert_one(sale.model_dump())
    return sale

@api_router.put("/sales/{sale_id}", response_model=Sale)
async def update_sale(sale_id: str, sale_data: SaleCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.sales.find_one({"id": sale_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    await db.sales.update_one(
        {"id": sale_id, "user_id": current_user["id"]},
        {"$set": sale_data.model_dump()}
    )
    
    updated = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    return updated

@api_router.delete("/sales/{sale_id}")
async def delete_sale(sale_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.sales.delete_one({"id": sale_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sale not found")
    return {"message": "Sale deleted successfully"}

@api_router.post("/sales/import-csv")
async def import_csv_sales(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Expected columns: date, amount, category_id, payment_method, description
        required_columns = ['date', 'amount', 'category_id', 'payment_method']
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(status_code=400, detail=f"CSV must contain columns: {', '.join(required_columns)}")
        
        sales = []
        for _, row in df.iterrows():
            sale = Sale(
                user_id=current_user["id"],
                date=str(row['date']),
                amount=float(row['amount']),
                category_id=str(row['category_id']),
                payment_method=str(row['payment_method']),
                description=str(row.get('description', '')),
                source="csv"
            )
            sales.append(sale.model_dump())
        
        if sales:
            await db.sales.insert_many(sales)
        
        return {"message": f"Successfully imported {len(sales)} sales", "count": len(sales)}
    except Exception as e:
        logger.error(f"CSV import error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {str(e)}")

# ============ Expenses Routes ============

@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(current_user: dict = Depends(get_current_user)):
    expenses = await db.expenses.find({"user_id": current_user["id"]}, {"_id": 0}).sort("date", -1).to_list(10000)
    return expenses

@api_router.post("/expenses", response_model=Expense)
async def create_expense(expense_data: ExpenseCreate, current_user: dict = Depends(get_current_user)):
    expense = Expense(
        user_id=current_user["id"],
        date=expense_data.date,
        amount=expense_data.amount,
        category_id=expense_data.category_id,
        description=expense_data.description
    )
    await db.expenses.insert_one(expense.model_dump())
    return expense

@api_router.put("/expenses/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, expense_data: ExpenseCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.expenses.find_one({"id": expense_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    await db.expenses.update_one(
        {"id": expense_id, "user_id": current_user["id"]},
        {"$set": expense_data.model_dump()}
    )
    
    updated = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    return updated

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.expenses.delete_one({"id": expense_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted successfully"}

# ============ Dashboard & Analytics Routes ============

@api_router.get("/debug/cogs")
async def debug_cogs(current_user: dict = Depends(get_current_user)):
    """Debug endpoint to check COGS calculation"""
    categories = await db.categories.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    expenses = await db.expenses.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(10000)
    
    cogs_categories = [cat for cat in categories if cat.get("is_cogs", False)]
    cogs_category_ids = {cat["id"] for cat in cogs_categories}
    
    cogs_expenses = [exp for exp in expenses if exp["category_id"] in cogs_category_ids]
    total_cogs = sum(exp["amount"] for exp in cogs_expenses)
    
    return {
        "total_categories": len(categories),
        "cogs_categories": cogs_categories,
        "cogs_category_ids": list(cogs_category_ids),
        "total_expenses": len(expenses),
        "cogs_expenses": cogs_expenses,
        "total_cogs": total_cogs
    }

@api_router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    # Get all sales and expenses
    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find(query, {"_id": 0}).to_list(10000)
    
    # Get validated bank transactions with categories
    bank_query = {
        "user_id": current_user["id"],
        "validated": True,
        "category_id": {"$ne": None, "$exists": True}
    }
    if start_date and end_date:
        bank_query["date"] = {"$gte": start_date, "$lte": end_date}
    
    bank_transactions = await db.bank_transactions.find(bank_query, {"_id": 0}).to_list(10000)
    
    # Get categories for mapping
    categories = await db.categories.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    cat_map = {cat["id"]: cat["name"] for cat in categories}
    cogs_categories = {cat["id"] for cat in categories if cat.get("is_cogs", False)}
    
    # Calculate totals including bank transactions
    total_income = sum(sale["amount"] for sale in sales)
    # Add credit bank transactions to income
    total_income += sum(
        trans["amount"] 
        for trans in bank_transactions 
        if trans["type"] == "credit"
    )
    
    total_expenses = sum(expense["amount"] for expense in expenses)
    # Add debit bank transactions to expenses
    total_expenses += sum(
        trans["amount"] 
        for trans in bank_transactions 
        if trans["type"] == "debit"
    )
    
    # Calculate COGS (from expenses and bank transactions)
    total_cogs = sum(
        expense["amount"] 
        for expense in expenses 
        if expense["category_id"] in cogs_categories
    )
    # Add COGS from bank transactions
    total_cogs += sum(
        trans["amount"]
        for trans in bank_transactions
        if trans["type"] == "debit" and trans.get("category_id") in cogs_categories
    )
    
    # Calculate metrics
    # % COGS = (Gastos COGS / Ingresos Sales) × 100
    cogs_percentage = (total_cogs / total_income * 100) if total_income > 0 else 0
    gross_profit = total_income - total_cogs
    gross_margin = (gross_profit / total_income * 100) if total_income > 0 else 0
    
    # Group by category
    income_by_category = defaultdict(float)
    for sale in sales:
        cat_name = cat_map.get(sale["category_id"], "Unknown")
        income_by_category[cat_name] += sale["amount"]
    
    # Add bank transactions to income by category
    for trans in bank_transactions:
        if trans["type"] == "credit" and trans.get("category_id"):
            cat_name = cat_map.get(trans["category_id"], "Transacciones Bancarias")
            income_by_category[cat_name] += trans["amount"]
    
    expenses_by_category = defaultdict(float)
    for expense in expenses:
        cat_name = cat_map.get(expense["category_id"], "Unknown")
        expenses_by_category[cat_name] += expense["amount"]
    
    # Add bank transactions to expenses by category
    for trans in bank_transactions:
        if trans["type"] == "debit" and trans.get("category_id"):
            cat_name = cat_map.get(trans["category_id"], "Transacciones Bancarias")
            expenses_by_category[cat_name] += trans["amount"]
    
    # Group by payment method
    sales_by_payment = defaultdict(float)
    for sale in sales:
        sales_by_payment[sale["payment_method"]] += sale["amount"]
    
    return DashboardSummary(
        total_income=total_income,
        total_expenses=total_expenses,
        net_profit=total_income - total_expenses,
        total_cogs=total_cogs,
        cogs_percentage=cogs_percentage,
        gross_profit=gross_profit,
        gross_margin=gross_margin,
        income_by_category=dict(income_by_category),
        expenses_by_category=dict(expenses_by_category),
        sales_by_payment=dict(sales_by_payment)
    )

@api_router.get("/dashboard/comparison", response_model=List[MonthComparison])
async def get_month_comparison(
    months: int = 12,
    current_user: dict = Depends(get_current_user)
):
    comparisons = []
    
    for i in range(months - 1, -1, -1):
        # Calculate month start and end
        now = datetime.now(timezone.utc)
        target_date = now - timedelta(days=30 * i)
        month_start = target_date.replace(day=1).strftime("%Y-%m-%d")
        
        # Get next month for end date
        if target_date.month == 12:
            next_month = target_date.replace(year=target_date.year + 1, month=1, day=1)
        else:
            next_month = target_date.replace(month=target_date.month + 1, day=1)
        month_end = (next_month - timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Query sales and expenses
        sales = await db.sales.find({
            "user_id": current_user["id"],
            "date": {"$gte": month_start, "$lte": month_end}
        }, {"_id": 0}).to_list(10000)
        
        expenses = await db.expenses.find({
            "user_id": current_user["id"],
            "date": {"$gte": month_start, "$lte": month_end}
        }, {"_id": 0}).to_list(10000)
        
        income = sum(sale["amount"] for sale in sales)
        expense_total = sum(expense["amount"] for expense in expenses)
        profit = income - expense_total
        
        # Calculate growth percentage
        growth_percentage = None
        if len(comparisons) > 0:
            prev_profit = comparisons[-1].profit
            if prev_profit != 0:
                growth_percentage = ((profit - prev_profit) / abs(prev_profit)) * 100
        
        comparisons.append(MonthComparison(
            month=target_date.strftime("%Y-%m"),
            income=income,
            expenses=expense_total,
            profit=profit,
            growth_percentage=growth_percentage
        ))
    
    return list(reversed(comparisons))

@api_router.get("/analytics/report")
async def get_analytics_report(
    filter_type: str = "month",  # week, month, quarter, year, custom
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    
    if filter_type == "week":
        start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        end = now.strftime("%Y-%m-%d")
    elif filter_type == "month":
        start = now.replace(day=1).strftime("%Y-%m-%d")
        end = now.strftime("%Y-%m-%d")
    elif filter_type == "quarter":
        quarter_month = ((now.month - 1) // 3) * 3 + 1
        start = now.replace(month=quarter_month, day=1).strftime("%Y-%m-%d")
        end = now.strftime("%Y-%m-%d")
    elif filter_type == "year":
        start = now.replace(month=1, day=1).strftime("%Y-%m-%d")
        end = now.strftime("%Y-%m-%d")
    elif filter_type == "custom":
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="start_date and end_date required for custom filter")
        start = start_date
        end = end_date
    else:
        raise HTTPException(status_code=400, detail="Invalid filter_type")
    
    # Get summary for the period
    summary = await get_dashboard_summary(start, end, current_user)
    
    return {
        "filter_type": filter_type,
        "start_date": start,
        "end_date": end,
        "summary": summary
    }

# ============ Bank Reconciliation Routes ============

@api_router.get("/checks", response_model=List[Check])
async def get_checks(current_user: dict = Depends(get_current_user)):
    checks = await db.checks.find({" user_id": current_user["id"]}, {"_id": 0}).sort("date_issued", -1).to_list(10000)
    return checks

@api_router.post("/checks", response_model=Check)
async def create_check(check_data: CheckCreate, current_user: dict = Depends(get_current_user)):
    check = Check(
        user_id=current_user["id"],
        check_number=check_data.check_number,
        date_issued=check_data.date_issued,
        amount=check_data.amount,
        payee=check_data.payee,
        description=check_data.description,
        status=CheckStatus.PENDING
    )
    await db.checks.insert_one(check.model_dump())
    return check

@api_router.put("/checks/{check_id}", response_model=Check)
async def update_check(check_id: str, check_data: CheckCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.checks.find_one({"id": check_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Check not found")
    
    await db.checks.update_one(
        {"id": check_id, "user_id": current_user["id"]},
        {"$set": check_data.model_dump()}
    )
    
    updated = await db.checks.find_one({"id": check_id}, {"_id": 0})
    return updated

@api_router.delete("/checks/{check_id}")
async def delete_check(check_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.checks.delete_one({"id": check_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Check not found")
    return {"message": "Check deleted successfully"}

@api_router.post("/checks/{check_id}/cancel")
async def cancel_check(check_id: str, current_user: dict = Depends(get_current_user)):
    check = await db.checks.find_one({"id": check_id, "user_id": current_user["id"]})
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")
    
    await db.checks.update_one(
        {"id": check_id},
        {"$set": {"status": CheckStatus.CANCELLED}}
    )
    return {"message": "Check cancelled successfully"}

# Bank Transactions
@api_router.get("/bank-transactions", response_model=List[BankTransaction])
async def get_bank_transactions(current_user: dict = Depends(get_current_user)):
    transactions = await db.bank_transactions.find({"user_id": current_user["id"]}, {"_id": 0}).sort("date", -1).to_list(10000)
    return transactions

@api_router.post("/bank-transactions", response_model=BankTransaction)
async def create_bank_transaction(transaction_data: BankTransactionCreate, current_user: dict = Depends(get_current_user)):
    transaction = BankTransaction(
        user_id=current_user["id"],
        statement_id="manual",
        date=transaction_data.date,
        description=transaction_data.description,
        amount=transaction_data.amount,
        type=transaction_data.type,
        check_number=transaction_data.check_number
    )
    await db.bank_transactions.insert_one(transaction.model_dump())
    return transaction

@api_router.put("/bank-transactions/{transaction_id}")
async def update_bank_transaction(
    transaction_id: str,
    transaction_data: BankTransactionUpdate,
    current_user: dict = Depends(get_current_user)
):
    existing = await db.bank_transactions.find_one({"id": transaction_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = {k: v for k, v in transaction_data.model_dump().items() if v is not None}
    
    if update_data:
        await db.bank_transactions.update_one(
            {"id": transaction_id, "user_id": current_user["id"]},
            {"$set": update_data}
        )
    
    updated = await db.bank_transactions.find_one({"id": transaction_id}, {"_id": 0})
    return updated

@api_router.delete("/bank-transactions/{transaction_id}")
async def delete_bank_transaction(transaction_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.bank_transactions.delete_one({"id": transaction_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction deleted successfully"}

@api_router.post("/bank-transactions/{transaction_id}/validate")
async def validate_bank_transaction(
    transaction_id: str,
    transaction_type: str,
    category_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Validate and categorize a bank transaction"""
    transaction = await db.bank_transactions.find_one({"id": transaction_id, "user_id": current_user["id"]})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = {
        "type": transaction_type,
        "validated": True
    }
    
    if category_id:
        update_data["category_id"] = category_id
    
    await db.bank_transactions.update_one(
        {"id": transaction_id},
        {"$set": update_data}
    )
    
    return {"message": "Transaction validated successfully"}

# Match check with bank transaction
@api_router.post("/bank-transactions/{transaction_id}/match-check/{check_id}")
async def match_check_with_transaction(
    transaction_id: str,
    check_id: str,
    current_user: dict = Depends(get_current_user)
):
    # Verify transaction exists
    transaction = await db.bank_transactions.find_one({"id": transaction_id, "user_id": current_user["id"]})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Verify check exists
    check = await db.checks.find_one({"id": check_id, "user_id": current_user["id"]})
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")
    
    # Update transaction
    await db.bank_transactions.update_one(
        {"id": transaction_id},
        {"$set": {"matched_check_id": check_id}}
    )
    
    # Update check
    await db.checks.update_one(
        {"id": check_id},
        {"$set": {
            "status": CheckStatus.CLEARED,
            "date_cleared": transaction["date"],
            "bank_transaction_id": transaction_id
        }}
    )
    
    return {"message": "Check matched successfully"}

# Automatic matching
@api_router.post("/bank-reconciliation/auto-match")
async def auto_match_checks(current_user: dict = Depends(get_current_user)):
    # Get unmatched transactions
    transactions = await db.bank_transactions.find({
        "user_id": current_user["id"],
        "matched_check_id": None,
        "type": "debit"
    }).to_list(10000)
    
    # Get pending checks
    checks = await db.checks.find({
        "user_id": current_user["id"],
        "status": CheckStatus.PENDING
    }).to_list(10000)
    
    matched_count = 0
    for transaction in transactions:
        for check in checks:
            # Match by check number or amount + date proximity
            if transaction.get("check_number") == check["check_number"] or \
               (abs(transaction["amount"] - check["amount"]) < 0.01 and \
                abs((datetime.fromisoformat(transaction["date"].replace('Z', '+00:00')) - 
                     datetime.fromisoformat(check["date_issued"].replace('Z', '+00:00'))).days) <= 7):
                
                # Update transaction
                await db.bank_transactions.update_one(
                    {"id": transaction["id"]},
                    {"$set": {"matched_check_id": check["id"]}}
                )
                
                # Update check
                await db.checks.update_one(
                    {"id": check["id"]},
                    {"$set": {
                        "status": CheckStatus.CLEARED,
                        "date_cleared": transaction["date"],
                        "bank_transaction_id": transaction["id"]
                    }}
                )
                
                matched_count += 1
                break
    
    return {"message": f"Matched {matched_count} checks automatically"}

# Reconciliation report
@api_router.get("/checks/in-transit-report")
async def get_checks_in_transit_report(current_user: dict = Depends(get_current_user)):
    """Get detailed report of checks in transit"""
    outstanding_checks = await db.checks.find({
        "user_id": current_user["id"],
        "status": CheckStatus.PENDING
    }, {"_id": 0}).sort("date_issued", 1).to_list(10000)
    
    total_amount = sum(check["amount"] for check in outstanding_checks)
    
    # Group by age
    now = datetime.now(timezone.utc)
    by_age = {
        "0-7 days": [],
        "8-30 days": [],
        "31-60 days": [],
        "60+ days": []
    }
    
    for check in outstanding_checks:
        try:
            check_date = datetime.fromisoformat(check["date_issued"].replace('Z', '+00:00'))
            days_old = (now - check_date).days
            
            if days_old <= 7:
                by_age["0-7 days"].append(check)
            elif days_old <= 30:
                by_age["8-30 days"].append(check)
            elif days_old <= 60:
                by_age["31-60 days"].append(check)
            else:
                by_age["60+ days"].append(check)
        except:
            by_age["0-7 days"].append(check)
    
    return {
        "total_checks": len(outstanding_checks),
        "total_amount": total_amount,
        "checks": outstanding_checks,
        "by_age": {
            key: {
                "count": len(checks),
                "amount": sum(c["amount"] for c in checks),
                "checks": checks
            }
            for key, checks in by_age.items()
        }
    }

@api_router.get("/bank-reconciliation/report", response_model=ReconciliationReport)
async def get_reconciliation_report(
    statement_balance: float,
    current_user: dict = Depends(get_current_user)
):
    # Get outstanding checks (pending)
    outstanding_checks = await db.checks.find({
        "user_id": current_user["id"],
        "status": CheckStatus.PENDING
    }, {"_id": 0}).to_list(10000)
    
    outstanding_checks_total = sum(check["amount"] for check in outstanding_checks)
    
    # Get deposits in transit (sales not yet in bank)
    # For now, we'll use recent sales not matched with bank transactions
    recent_sales = await db.sales.find({
        "user_id": current_user["id"],
        "payment_method": {"$in": ["Transferencia", "Cheque"]}
    }, {"_id": 0}).to_list(10000)
    
    bank_transactions = await db.bank_transactions.find({
        "user_id": current_user["id"],
        "type": "credit"
    }, {"_id": 0}).to_list(10000)
    
    # Simple matching - deposits not in bank yet
    deposits_in_transit = []
    for sale in recent_sales[-20:]:  # Last 20 sales
        matched = False
        for trans in bank_transactions:
            if abs(float(sale["amount"]) - float(trans["amount"])) < 0.01:
                matched = True
                break
        if not matched:
            deposits_in_transit.append({
                "date": sale["date"],
                "amount": sale["amount"],
                "description": sale.get("description", "Venta")
            })
    
    deposits_in_transit_total = sum(d["amount"] for d in deposits_in_transit)
    
    # Calculate reconciled balance
    # Bank balance + deposits in transit - outstanding checks = Book balance
    reconciled_balance = statement_balance + deposits_in_transit_total - outstanding_checks_total
    
    # Get book balance (from our records)
    # This would be cash/bank account balance from our books
    book_balance = statement_balance  # Simplified
    
    difference = reconciled_balance - book_balance
    
    return ReconciliationReport(
        statement_balance=statement_balance,
        book_balance=book_balance,
        outstanding_checks=outstanding_checks,
        deposits_in_transit=deposits_in_transit,
        outstanding_checks_total=outstanding_checks_total,
        deposits_in_transit_total=deposits_in_transit_total,
        reconciled_balance=reconciled_balance,
        difference=difference
    )

# PDF Upload and parse
@api_router.post("/bank-statements/extract-text")
async def extract_text_from_pdf(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Extract raw text from PDF for manual review"""
    try:
        contents = await file.read()
        pdf_path = f"/tmp/{file.filename}"
        with open(pdf_path, "wb") as f:
            f.write(contents)
        
        all_text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                all_text += f"=== Página {pdf.pages.index(page) + 1} ===\n{text}\n\n"
        
        return {
            "filename": file.filename,
            "text": all_text,
            "pages": len(all_text.split("=== Página"))
        }
    except Exception as e:
        logger.error(f"Error extracting text: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error al extraer texto: {str(e)}")

class TextParseRequest(BaseModel):
    text: str

@api_router.post("/bank-statements/test-parse")
async def test_parse_text(
    request: TextParseRequest,
    current_user: dict = Depends(get_current_user)
):
    """Test parsing on sample text - useful for debugging"""
    lines = request.text.split('\n')
    results = []
    
    for line_num, line in enumerate(lines):
        line = line.strip()
        if not line or len(line) < 10:
            continue
        
        # Try all patterns
        patterns = [
            (r'(\d{1,2}/\d{1,2}/\d{2,4})\s+([-+]?\$?\s*[\d,]+\.?\d{2})\s+(.+)', 'Pattern 1: Date Amount Desc'),
            (r'(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([-+]?\$?\s*[\d,]+\.?\d{2})$', 'Pattern 2: Date Desc Amount'),
            (r'(.+?)\s+(\d{1,2}/\d{1,2}/\d{2,4})\s+([-+]?\$?\s*[\d,]+\.?\d{2})$', 'Pattern 3: Desc Date Amount'),
            (r'(\d{4}-\d{1,2}-\d{1,2})\s+([-+]?\$?\s*[\d,]+\.?\d{2})\s+(.+)', 'Pattern 4: ISO Date'),
            (r'(\d{1,2}/\d{1,2}/\d{2,4})\s+\d{1,2}/\d{1,2}/\d{2,4}\s+(.+?)\s+([-+]?\$?\s*[\d,]+\.?\d{2})$', 'Pattern 5: Two dates'),
        ]
        
        matched = False
        for pattern, pattern_name in patterns:
            match = re.search(pattern, line)
            if match:
                results.append({
                    "line_number": line_num + 1,
                    "line": line,
                    "matched": True,
                    "pattern": pattern_name,
                    "groups": match.groups()
                })
                matched = True
                break
        
        if not matched and any(char.isdigit() for char in line):
            results.append({
                "line_number": line_num + 1,
                "line": line,
                "matched": False,
                "pattern": None,
                "groups": []
            })
    
    return {
        "total_lines": len(lines),
        "matched_lines": len([r for r in results if r["matched"]]),
        "unmatched_lines": len([r for r in results if not r["matched"]]),
        "results": results
    }

@api_router.post("/bank-statements/upload")
async def upload_bank_statement(
    file: UploadFile = File(...),
    period_start: str = "",
    period_end: str = "",
    starting_balance: float = 0,
    ending_balance: float = 0,
    current_user: dict = Depends(get_current_user)
):
    try:
        contents = await file.read()
        
        # Save PDF temporarily
        pdf_path = f"/tmp/{file.filename}"
        with open(pdf_path, "wb") as f:
            f.write(contents)
        
        logger.info(f"Processing PDF: {file.filename}")
        
        # Extract text from PDF
        transactions = []
        all_text = ""
        
        with pdfplumber.open(pdf_path) as pdf:
            logger.info(f"PDF has {len(pdf.pages)} pages")
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text()
                all_text += text + "\n"
                logger.info(f"Page {page_num + 1} extracted")
                
                # Try multiple patterns for different bank formats
                lines = text.split('\n')
                for line_num, line in enumerate(lines):
                    line = line.strip()
                    if not line or len(line) < 10:
                        continue
                    
                    # Skip header lines and page headers
                    if any(header in line.upper() for header in [
                        'DATE', 'DESCRIPTION', 'AMOUNT', 'BALANCE', 'DEPOSITS', 'WITHDRAWALS', 
                        'FECHA', 'DESCRIPCION', 'MONTO', 'CHECK NUMBER', 'ENDING DAILY',
                        'TRANSACTION HISTORY', 'PAGE', 'BEGINNING BALANCE', 'ENDING BALANCE',
                        'STATEMENT PERIOD', 'ACCOUNT NUMBER'
                    ]):
                        continue
                    
                    # Pattern for Wells Fargo style: Date [CheckNum] Description Amount Amount Balance
                    # Example: 9/15 Zelle to Camargo Elena on 09/12 Ref # Wfct0Z8Q8Z29 550.00
                    # Example: 9/10 Purchase authorized on 09/09 Paypal *Streamline 57.00
                    # Allow amounts with 0-2 decimal places
                    wells_fargo_match = re.search(r'^(\d{1,2}/\d{1,2})\s+(?:(\d+)\s+)?(.+?)\s+([\d,]+(?:\.\d{1,2})?)\s*$', line)
                    
                    if wells_fargo_match:
                        date_short, check_num, description, amount_str = wells_fargo_match.groups()
                        
                        # Build full date - assume current or previous year
                        try:
                            current_year = datetime.now(timezone.utc).year
                            date_str = f"{date_short}/{current_year}"
                            date_obj = datetime.strptime(date_str, "%m/%d/%Y")
                            date_formatted = date_obj.strftime("%Y-%m-%d")
                        except:
                            continue
                        
                        # Parse amount
                        try:
                            amount = float(amount_str.replace(',', ''))
                        except:
                            continue
                        
                        # Determine transaction type from description
                        desc_upper = description.upper()
                        is_deposit = any(word in desc_upper for word in [
                            'ZELLE FROM', 'MOBILE DEPOSIT', 'DEPOSIT', 'ATM CASH DEPOSIT',
                            'PAYMENT RECEIVED', 'TRANSFER IN', 'CREDIT'
                        ])
                        
                        is_withdrawal = any(word in desc_upper for word in [
                            'ZELLE TO', 'PURCHASE', 'PAYMENT', 'WITHDRAWAL', 'DEBIT', 
                            'TRANSFER DEBIT', 'ACH PMT', 'ATM', 'CHECK'
                        ])
                        
                        trans_type = "credit" if is_deposit else "debit"
                        
                        # Extract check number
                        check_number = check_num if check_num else None
                        if not check_number:
                            check_match = re.search(r'CHECK #?(\d+)', description, re.IGNORECASE)
                            if check_match:
                                check_number = check_match.group(1)
                        
                        transaction = BankTransaction(
                            user_id=current_user["id"],
                            statement_id="",
                            date=date_formatted,
                            description=description.strip()[:200],
                            amount=amount,
                            type=trans_type,
                            check_number=check_number
                        )
                        transactions.append(transaction.model_dump())
                        logger.info(f"✓ Transaction #{len(transactions)}: {date_formatted} | {trans_type.upper()} | ${amount} | {description[:50]}")
                        continue
                    
                    # Pattern 1: Date at start, amount with $ or - sign
                    # Example: 09/15/2024 -500.00 CHECK #1234
                    match1 = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})\s+([-+]?\$?\s*[\d,]+\.?\d{2})\s+(.+)', line)
                    
                    # Pattern 2: Date at start, description, then amount at end
                    # Example: 09/15/2024 Payment to vendor 500.00
                    match2 = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([-+]?\$?\s*[\d,]+\.?\d{2})$', line)
                    
                    # Pattern 3: Description first, date, then amount
                    # Example: CHECK #1234 09/15/2024 500.00
                    match3 = re.search(r'(.+?)\s+(\d{1,2}/\d{1,2}/\d{2,4})\s+([-+]?\$?\s*[\d,]+\.?\d{2})$', line)
                    
                    # Pattern 4: ISO date format
                    # Example: 2024-09-15 -500.00 Description
                    match4 = re.search(r'(\d{4}-\d{1,2}-\d{1,2})\s+([-+]?\$?\s*[\d,]+\.?\d{2})\s+(.+)', line)
                    
                    # Pattern 5: Two dates in line (transaction date and posting date)
                    # Example: 09/15/2024 09/16/2024 Description 500.00
                    match5 = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})\s+\d{1,2}/\d{1,2}/\d{2,4}\s+(.+?)\s+([-+]?\$?\s*[\d,]+\.?\d{2})$', line)
                    
                    # Pattern 6: Amount in middle with separators
                    # Example: 09/15/2024    -500.00    Description here
                    match6 = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})\s+([-+]?\$?\s*[\d,]+\.?\d{2})\s+(.+)', line)
                    
                    match = match1 or match2 or match3 or match4 or match5 or match6
                    
                    if match:
                        try:
                            groups = match.groups()
                            
                            # Identify which pattern matched
                            if match1 or match4 or match6:
                                date_str, amount_str, description = groups
                            elif match2 or match5:
                                date_str, description, amount_str = groups
                            elif match3:
                                description, date_str, amount_str = groups
                            else:
                                continue
                            
                            # Clean up description
                            description = description.strip()
                            
                            # Skip if description looks like a subtotal or header
                            if any(skip in description.upper() for skip in ['TOTAL', 'SUBTOTAL', 'BALANCE', 'CONTINUED', 'PAGE']):
                                continue
                            
                            # Parse amount
                            amount_clean = amount_str.replace('$', '').replace(',', '').replace(' ', '').strip()
                            
                            # Determine if debit or credit
                            is_negative = '-' in amount_clean or '(' in amount_str
                            
                            # Keywords that indicate credit (money in)
                            credit_keywords = ['DEPOSIT', 'CREDIT', 'DEPOSITO', 'ABONO', 'INGRESO', 'PAYMENT RECEIVED', 'TRANSFER IN']
                            
                            # Keywords that indicate debit (money out)
                            debit_keywords = ['WITHDRAWAL', 'DEBIT', 'RETIRO', 'CARGO', 'CHECK', 'CHEQUE', 'FEE', 'PAYMENT', 'PURCHASE', 'ATM']
                            
                            # Check description for hints
                            desc_upper = description.upper()
                            has_credit_keyword = any(word in desc_upper for word in credit_keywords)
                            has_debit_keyword = any(word in desc_upper for word in debit_keywords)
                            
                            # Determine type
                            if is_negative or has_debit_keyword:
                                trans_type = "debit"
                            elif has_credit_keyword:
                                trans_type = "credit"
                            else:
                                # Default: assume positive amounts are debits unless otherwise indicated
                                # (most transactions in statements are debits)
                                trans_type = "debit"
                            
                            try:
                                amount = abs(float(amount_clean.replace('-', '').replace('(', '').replace(')', '')))
                            except ValueError:
                                logger.warning(f"Could not parse amount: {amount_str}")
                                continue
                            
                            # Extract check number if present
                            check_patterns = [
                                r'CHECK\s*#?(\d+)',
                                r'CHK\s*#?(\d+)',
                                r'CHEQUE\s*#?(\d+)',
                                r'#(\d{4,})'
                            ]
                            check_number = None
                            for pattern in check_patterns:
                                check_match = re.search(pattern, description, re.IGNORECASE)
                                if check_match:
                                    check_number = check_match.group(1)
                                    break
                            
                            # Convert date - try multiple formats
                            date_formatted = None
                            date_formats = ["%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y"]
                            for date_format in date_formats:
                                try:
                                    date_obj = datetime.strptime(date_str, date_format)
                                    date_formatted = date_obj.strftime("%Y-%m-%d")
                                    break
                                except:
                                    continue
                            
                            if not date_formatted:
                                logger.warning(f"Could not parse date: {date_str}")
                                continue
                            
                            transaction = BankTransaction(
                                user_id=current_user["id"],
                                statement_id="",
                                date=date_formatted,
                                description=description.strip()[:200],  # Limit description length
                                amount=amount,
                                type=trans_type,
                                check_number=check_number
                            )
                            transactions.append(transaction.model_dump())
                            logger.info(f"✓ Transaction #{len(transactions)}: {date_formatted} | {trans_type.upper()} | ${amount} | {description[:50]}")
                            
                        except Exception as parse_error:
                            logger.warning(f"✗ Error parsing line {line_num}: {line[:100]} | Error: {str(parse_error)}")
                            continue
                    else:
                        # Log lines that didn't match any pattern (only if they look like they might be transactions)
                        if any(char.isdigit() for char in line) and len(line) > 15:
                            logger.debug(f"⊘ Line {line_num} didn't match patterns: {line[:80]}")
        
        logger.info(f"Total transactions extracted: {len(transactions)}")
        
        # Save extracted text for debugging
        debug_path = f"/tmp/{file.filename}_debug.txt"
        with open(debug_path, "w") as f:
            f.write(all_text)
        logger.info(f"Saved debug text to: {debug_path}")
        
        # Create statement record
        statement = BankStatement(
            user_id=current_user["id"],
            filename=file.filename,
            period_start=period_start if period_start else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            period_end=period_end if period_end else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            starting_balance=starting_balance,
            ending_balance=ending_balance,
            transactions_count=len(transactions)
        )
        
        await db.bank_statements.insert_one(statement.model_dump())
        logger.info(f"Statement saved with ID: {statement.id}")
        
        # Update transactions with statement_id
        for trans in transactions:
            trans["statement_id"] = statement.id
        
        # Insert transactions
        if transactions:
            await db.bank_transactions.insert_many(transactions)
            logger.info(f"Inserted {len(transactions)} transactions")
        
        return {
            "message": f"Estado de cuenta procesado. Se extrajeron {len(transactions)} transacciones.",
            "statement_id": statement.id,
            "transactions_count": len(transactions),
            "debug_info": f"Se extrajo texto de {len(all_text)} caracteres. Si no se encontraron transacciones, el formato del PDF puede no ser compatible."
        }
    except Exception as e:
        logger.error(f"Error uploading bank statement: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Error al procesar PDF: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()