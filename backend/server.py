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
    
    # Get categories for mapping
    categories = await db.categories.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    cat_map = {cat["id"]: cat["name"] for cat in categories}
    cogs_categories = {cat["id"] for cat in categories if cat.get("is_cogs", False)}
    
    # Calculate totals
    total_income = sum(sale["amount"] for sale in sales)
    total_expenses = sum(expense["amount"] for expense in expenses)
    
    # Calculate COGS
    total_cogs = sum(
        expense["amount"] 
        for expense in expenses 
        if expense["category_id"] in cogs_categories
    )
    
    # Calculate metrics
    cogs_percentage = (total_income / total_cogs * 100) if total_cogs > 0 else 0
    gross_profit = total_income - total_cogs
    gross_margin = (gross_profit / total_income * 100) if total_income > 0 else 0
    
    # Group by category
    income_by_category = defaultdict(float)
    for sale in sales:
        cat_name = cat_map.get(sale["category_id"], "Unknown")
        income_by_category[cat_name] += sale["amount"]
    
    expenses_by_category = defaultdict(float)
    for expense in expenses:
        cat_name = cat_map.get(expense["category_id"], "Unknown")
        expenses_by_category[cat_name] += expense["amount"]
    
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