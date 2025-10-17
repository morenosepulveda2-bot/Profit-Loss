import requests
import sys
import json
from datetime import datetime, timedelta
import io
import csv

class ProfitLossAPITester:
    def __init__(self, base_url="https://cashflow-clarity-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_user_email = f"test_user_{datetime.now().strftime('%H%M%S')}@test.com"
        self.test_user_password = "TestPass123!"
        self.test_username = f"TestUser_{datetime.now().strftime('%H%M%S')}"
        self.created_categories = []
        self.created_sales = []
        self.created_expenses = []

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, files=None):
        """Make HTTP request with proper headers"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if files:
            headers.pop('Content-Type', None)  # Let requests set it for multipart
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            return response
        except Exception as e:
            print(f"Request error: {str(e)}")
            return None

    def test_user_registration(self):
        """Test user registration and automatic category creation"""
        print("\n🔍 Testing User Registration...")
        
        response = self.make_request('POST', 'auth/register', {
            "username": self.test_username,
            "email": self.test_user_email,
            "password": self.test_user_password
        })
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                self.user_data = data['user']
                self.log_result("User Registration", True, f"User created: {self.user_data['username']}")
                return True
            else:
                self.log_result("User Registration", False, "Missing token or user data")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("User Registration", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_user_login(self):
        """Test user login"""
        print("\n🔍 Testing User Login...")
        
        response = self.make_request('POST', 'auth/login', {
            "email": self.test_user_email,
            "password": self.test_user_password
        })
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data:
                self.token = data['access_token']
                self.log_result("User Login", True, "Login successful")
                return True
            else:
                self.log_result("User Login", False, "Missing access token")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("User Login", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        print("\n🔍 Testing Invalid Login...")
        
        response = self.make_request('POST', 'auth/login', {
            "email": self.test_user_email,
            "password": "wrongpassword"
        })
        
        if response and response.status_code == 401:
            self.log_result("Invalid Login", True, "Correctly rejected invalid credentials")
            return True
        else:
            self.log_result("Invalid Login", False, f"Expected 401, got {response.status_code if response else 'None'}")
        
        return False

    def test_get_categories(self):
        """Test getting categories (should include predefined ones)"""
        print("\n🔍 Testing Get Categories...")
        
        response = self.make_request('GET', 'categories')
        
        if response and response.status_code == 200:
            categories = response.json()
            if isinstance(categories, list) and len(categories) > 0:
                # Check for predefined categories
                predefined_count = sum(1 for cat in categories if cat.get('is_predefined', False))
                income_count = sum(1 for cat in categories if cat.get('type') == 'income')
                expense_count = sum(1 for cat in categories if cat.get('type') == 'expense')
                
                self.log_result("Get Categories", True, 
                    f"Found {len(categories)} categories ({predefined_count} predefined, {income_count} income, {expense_count} expense)")
                return categories
            else:
                self.log_result("Get Categories", False, "No categories found")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Get Categories", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return []

    def test_create_custom_category(self):
        """Test creating custom categories"""
        print("\n🔍 Testing Create Custom Category...")
        
        # Test income category
        response = self.make_request('POST', 'categories', {
            "name": "Test Income Category",
            "type": "income"
        })
        
        if response and response.status_code == 200:
            category = response.json()
            self.created_categories.append(category)
            self.log_result("Create Income Category", True, f"Created: {category['name']}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Create Income Category", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        # Test expense category
        response = self.make_request('POST', 'categories', {
            "name": "Test Expense Category",
            "type": "expense"
        })
        
        if response and response.status_code == 200:
            category = response.json()
            self.created_categories.append(category)
            self.log_result("Create Expense Category", True, f"Created: {category['name']}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Create Expense Category", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_update_custom_category(self):
        """Test updating custom categories (should not allow predefined)"""
        print("\n🔍 Testing Update Custom Category...")
        
        if not self.created_categories:
            self.log_result("Update Custom Category", False, "No custom categories to update")
            return False
        
        category = self.created_categories[0]
        response = self.make_request('PUT', f'categories/{category["id"]}', {
            "name": "Updated Test Category",
            "type": category["type"]
        })
        
        if response and response.status_code == 200:
            updated_category = response.json()
            self.log_result("Update Custom Category", True, f"Updated: {updated_category['name']}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Update Custom Category", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_create_sale(self):
        """Test creating sales"""
        print("\n🔍 Testing Create Sale...")
        
        # Get income categories
        categories = self.test_get_categories()
        income_categories = [cat for cat in categories if cat.get('type') == 'income']
        
        if not income_categories:
            self.log_result("Create Sale", False, "No income categories available")
            return False
        
        response = self.make_request('POST', 'sales', {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "amount": 150.50,
            "category_id": income_categories[0]["id"],
            "payment_method": "Efectivo",
            "description": "Test sale"
        })
        
        if response and response.status_code == 200:
            sale = response.json()
            self.created_sales.append(sale)
            self.log_result("Create Sale", True, f"Created sale: ${sale['amount']}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Create Sale", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_get_sales(self):
        """Test getting sales"""
        print("\n🔍 Testing Get Sales...")
        
        response = self.make_request('GET', 'sales')
        
        if response and response.status_code == 200:
            sales = response.json()
            self.log_result("Get Sales", True, f"Found {len(sales)} sales")
            return sales
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Get Sales", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return []

    def test_update_sale(self):
        """Test updating sales"""
        print("\n🔍 Testing Update Sale...")
        
        if not self.created_sales:
            self.log_result("Update Sale", False, "No sales to update")
            return False
        
        sale = self.created_sales[0]
        response = self.make_request('PUT', f'sales/{sale["id"]}', {
            "date": sale["date"],
            "amount": 200.00,
            "category_id": sale["category_id"],
            "payment_method": "Tarjeta",
            "description": "Updated test sale"
        })
        
        if response and response.status_code == 200:
            updated_sale = response.json()
            self.log_result("Update Sale", True, f"Updated sale: ${updated_sale['amount']}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Update Sale", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_create_expense(self):
        """Test creating expenses"""
        print("\n🔍 Testing Create Expense...")
        
        # Get expense categories
        categories = self.test_get_categories()
        expense_categories = [cat for cat in categories if cat.get('type') == 'expense']
        
        if not expense_categories:
            self.log_result("Create Expense", False, "No expense categories available")
            return False
        
        response = self.make_request('POST', 'expenses', {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "amount": 75.25,
            "category_id": expense_categories[0]["id"],
            "description": "Test expense"
        })
        
        if response and response.status_code == 200:
            expense = response.json()
            self.created_expenses.append(expense)
            self.log_result("Create Expense", True, f"Created expense: ${expense['amount']}")
            return True
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Create Expense", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_get_expenses(self):
        """Test getting expenses"""
        print("\n🔍 Testing Get Expenses...")
        
        response = self.make_request('GET', 'expenses')
        
        if response and response.status_code == 200:
            expenses = response.json()
            self.log_result("Get Expenses", True, f"Found {len(expenses)} expenses")
            return expenses
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Get Expenses", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return []

    def test_dashboard_summary(self):
        """Test dashboard summary"""
        print("\n🔍 Testing Dashboard Summary...")
        
        response = self.make_request('GET', 'dashboard/summary')
        
        if response and response.status_code == 200:
            summary = response.json()
            required_fields = ['total_income', 'total_expenses', 'net_profit', 'total_cogs', 'cogs_percentage', 'gross_profit', 'gross_margin', 'income_by_category', 'expenses_by_category']
            
            if all(field in summary for field in required_fields):
                self.log_result("Dashboard Summary", True, 
                    f"Income: ${summary['total_income']}, Expenses: ${summary['total_expenses']}, COGS: ${summary['total_cogs']}, Profit: ${summary['net_profit']}")
                return summary
            else:
                missing_fields = [field for field in required_fields if field not in summary]
                self.log_result("Dashboard Summary", False, f"Missing fields: {missing_fields}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Dashboard Summary", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_month_comparison(self):
        """Test month comparison"""
        print("\n🔍 Testing Month Comparison...")
        
        response = self.make_request('GET', 'dashboard/comparison?months=6')
        
        if response and response.status_code == 200:
            comparison = response.json()
            if isinstance(comparison, list):
                self.log_result("Month Comparison", True, f"Found {len(comparison)} months of data")
                return True
            else:
                self.log_result("Month Comparison", False, "Response is not a list")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Month Comparison", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_analytics_report(self):
        """Test analytics report with different filters"""
        print("\n🔍 Testing Analytics Report...")
        
        filters = ['week', 'month', 'quarter', 'year']
        success_count = 0
        
        for filter_type in filters:
            response = self.make_request('GET', f'analytics/report?filter_type={filter_type}')
            
            if response and response.status_code == 200:
                report = response.json()
                if 'summary' in report and 'filter_type' in report:
                    success_count += 1
                    print(f"  ✅ {filter_type} filter working")
                else:
                    print(f"  ❌ {filter_type} filter missing required fields")
            else:
                print(f"  ❌ {filter_type} filter failed")
        
        if success_count == len(filters):
            self.log_result("Analytics Report", True, f"All {len(filters)} filters working")
            return True
        else:
            self.log_result("Analytics Report", False, f"Only {success_count}/{len(filters)} filters working")
        
        return False

    def test_csv_import(self):
        """Test CSV import functionality"""
        print("\n🔍 Testing CSV Import...")
        
        # Get income categories
        categories = self.test_get_categories()
        income_categories = [cat for cat in categories if cat.get('type') == 'income']
        
        if not income_categories:
            self.log_result("CSV Import", False, "No income categories available")
            return False
        
        # Create test CSV data
        csv_data = [
            ['date', 'amount', 'category_id', 'payment_method', 'description'],
            ['2024-01-15', '100.00', income_categories[0]['id'], 'Efectivo', 'CSV Test Sale 1'],
            ['2024-01-16', '250.50', income_categories[0]['id'], 'Tarjeta', 'CSV Test Sale 2']
        ]
        
        # Create CSV file in memory
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerows(csv_data)
        csv_content = csv_buffer.getvalue()
        
        # Prepare file for upload
        files = {'file': ('test_sales.csv', csv_content, 'text/csv')}
        
        response = self.make_request('POST', 'sales/import-csv', files=files)
        
        if response and response.status_code == 200:
            result = response.json()
            if 'count' in result and result['count'] > 0:
                self.log_result("CSV Import", True, f"Imported {result['count']} sales")
                return True
            else:
                self.log_result("CSV Import", False, "No sales imported")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("CSV Import", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_delete_operations(self):
        """Test delete operations"""
        print("\n🔍 Testing Delete Operations...")
        
        success_count = 0
        total_tests = 0
        
        # Delete created sales
        for sale in self.created_sales:
            total_tests += 1
            response = self.make_request('DELETE', f'sales/{sale["id"]}')
            if response and response.status_code == 200:
                success_count += 1
                print(f"  ✅ Deleted sale {sale['id']}")
            else:
                print(f"  ❌ Failed to delete sale {sale['id']}")
        
        # Delete created expenses
        for expense in self.created_expenses:
            total_tests += 1
            response = self.make_request('DELETE', f'expenses/{expense["id"]}')
            if response and response.status_code == 200:
                success_count += 1
                print(f"  ✅ Deleted expense {expense['id']}")
            else:
                print(f"  ❌ Failed to delete expense {expense['id']}")
        
        # Delete created categories
        for category in self.created_categories:
            total_tests += 1
            response = self.make_request('DELETE', f'categories/{category["id"]}')
            if response and response.status_code == 200:
                success_count += 1
                print(f"  ✅ Deleted category {category['id']}")
            else:
                print(f"  ❌ Failed to delete category {category['id']}")
        
        if success_count == total_tests and total_tests > 0:
            self.log_result("Delete Operations", True, f"Deleted {success_count} items")
            return True
        else:
            self.log_result("Delete Operations", False, f"Only {success_count}/{total_tests} deletions successful")
        
        return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Profit & Loss API Tests...")
        print(f"Testing against: {self.base_url}")
        
        # Authentication tests
        if not self.test_user_registration():
            print("❌ Registration failed, stopping tests")
            return self.generate_summary()
        
        self.test_invalid_login()
        
        # Re-login to ensure token is fresh
        if not self.test_user_login():
            print("❌ Login failed, stopping tests")
            return self.generate_summary()
        
        # Category tests
        self.test_get_categories()
        self.test_create_custom_category()
        self.test_update_custom_category()
        
        # Sales tests
        self.test_create_sale()
        self.test_get_sales()
        self.test_update_sale()
        
        # Expense tests
        self.test_create_expense()
        self.test_get_expenses()
        
        # Dashboard and analytics tests
        self.test_dashboard_summary()
        self.test_month_comparison()
        self.test_analytics_report()
        
        # CSV import test
        self.test_csv_import()
        
        # Cleanup tests
        self.test_delete_operations()
        
        return self.generate_summary()

    def generate_summary(self):
        """Generate test summary"""
        print(f"\n📊 Test Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "success_rate": (self.tests_passed/self.tests_run*100) if self.tests_run > 0 else 0,
            "failed_tests": [r for r in self.test_results if not r['success']]
        }

def main():
    tester = ProfitLossAPITester()
    summary = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if summary["success_rate"] >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())