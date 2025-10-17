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

    def test_cogs_categories(self):
        """Test COGS categories are properly flagged"""
        print("\n🔍 Testing COGS Categories...")
        
        response = self.make_request('GET', 'categories')
        
        if response and response.status_code == 200:
            categories = response.json()
            cogs_categories = [cat for cat in categories if cat.get('is_cogs', False)]
            
            if len(cogs_categories) > 0:
                cogs_names = [cat['name'] for cat in cogs_categories]
                self.log_result("COGS Categories", True, 
                    f"Found {len(cogs_categories)} COGS categories: {', '.join(cogs_names)}")
                return cogs_categories
            else:
                self.log_result("COGS Categories", False, "No COGS categories found with is_cogs=True")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("COGS Categories", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return []

    def test_debug_cogs_endpoint(self):
        """Test debug COGS endpoint"""
        print("\n🔍 Testing Debug COGS Endpoint...")
        
        response = self.make_request('GET', 'debug/cogs')
        
        if response and response.status_code == 200:
            debug_data = response.json()
            required_fields = ['cogs_categories', 'total_cogs_from_expenses', 'total_cogs_from_bank', 'total_cogs']
            
            if all(field in debug_data for field in required_fields):
                cogs_categories = debug_data.get('cogs_categories', [])
                total_cogs = debug_data.get('total_cogs', 0)
                
                self.log_result("Debug COGS Endpoint", True, 
                    f"COGS categories: {len(cogs_categories)}, Total COGS: ${total_cogs}")
                return debug_data
            else:
                missing_fields = [field for field in required_fields if field not in debug_data]
                self.log_result("Debug COGS Endpoint", False, f"Missing fields: {missing_fields}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Debug COGS Endpoint", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_cogs_calculation_with_existing_user(self):
        """Test COGS calculation with the existing user that has COGS data"""
        print("\n🔍 Testing COGS Calculation with Existing User...")
        
        # Try to login with the test user mentioned in the review request
        test_email = "test_user_200146@test.com"
        test_password = "TestPass123!"  # Assuming standard test password
        
        response = self.make_request('POST', 'auth/login', {
            "email": test_email,
            "password": test_password
        })
        
        if response and response.status_code == 200:
            data = response.json()
            old_token = self.token
            self.token = data['access_token']
            
            # Test dashboard summary with existing user
            summary_response = self.make_request('GET', 'dashboard/summary')
            if summary_response and summary_response.status_code == 200:
                summary = summary_response.json()
                total_cogs = summary.get('total_cogs', 0)
                cogs_percentage = summary.get('cogs_percentage', 0)
                
                if total_cogs > 0:
                    self.log_result("COGS Calculation (Existing User)", True, 
                        f"Total COGS: ${total_cogs}, COGS %: {cogs_percentage:.2f}%")
                    
                    # Test debug endpoint with existing user
                    debug_response = self.make_request('GET', 'debug/cogs')
                    if debug_response and debug_response.status_code == 200:
                        debug_data = debug_response.json()
                        cogs_categories = debug_data.get('cogs_categories', [])
                        
                        # Check if "COGS" category exists and has is_cogs=True
                        cogs_category_found = any(cat.get('name') == 'COGS' and cat.get('is_cogs', False) 
                                                for cat in cogs_categories)
                        
                        if cogs_category_found:
                            self.log_result("COGS Category Fix Verification", True, 
                                "COGS category found with is_cogs=True")
                        else:
                            self.log_result("COGS Category Fix Verification", False, 
                                "COGS category not found or not properly flagged")
                    
                    # Restore original token
                    self.token = old_token
                    return True
                else:
                    self.log_result("COGS Calculation (Existing User)", False, 
                        f"Total COGS is still ${total_cogs} (expected > 0)")
            else:
                self.log_result("COGS Calculation (Existing User)", False, 
                    "Failed to get dashboard summary")
            
            # Restore original token
            self.token = old_token
        else:
            self.log_result("COGS Calculation (Existing User)", False, 
                f"Failed to login with test user {test_email}")
        
        return False

    def test_create_cogs_expense(self):
        """Test creating COGS expense and verify it's included in calculations"""
        print("\n🔍 Testing Create COGS Expense...")
        
        # Get COGS categories
        categories = self.test_get_categories()
        cogs_categories = [cat for cat in categories if cat.get('is_cogs', False)]
        
        if not cogs_categories:
            # Create a COGS category if none exists
            response = self.make_request('POST', 'categories', {
                "name": "Test COGS Category",
                "type": "expense",
                "is_cogs": True
            })
            
            if response and response.status_code == 200:
                cogs_category = response.json()
                self.created_categories.append(cogs_category)
                cogs_categories = [cogs_category]
            else:
                self.log_result("Create COGS Expense", False, "Failed to create COGS category")
                return False
        
        # Get baseline dashboard summary
        baseline_response = self.make_request('GET', 'dashboard/summary')
        baseline_cogs = 0
        if baseline_response and baseline_response.status_code == 200:
            baseline_summary = baseline_response.json()
            baseline_cogs = baseline_summary.get('total_cogs', 0)
        
        # Create COGS expense
        cogs_amount = 100.00
        response = self.make_request('POST', 'expenses', {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "amount": cogs_amount,
            "category_id": cogs_categories[0]["id"],
            "description": "Test COGS expense"
        })
        
        if response and response.status_code == 200:
            expense = response.json()
            self.created_expenses.append(expense)
            
            # Verify COGS is included in dashboard summary
            updated_response = self.make_request('GET', 'dashboard/summary')
            if updated_response and updated_response.status_code == 200:
                updated_summary = updated_response.json()
                updated_cogs = updated_summary.get('total_cogs', 0)
                
                expected_cogs = baseline_cogs + cogs_amount
                if abs(updated_cogs - expected_cogs) < 0.01:  # Allow for floating point precision
                    self.log_result("Create COGS Expense", True, 
                        f"COGS expense properly included: ${baseline_cogs} + ${cogs_amount} = ${updated_cogs}")
                    return True
                else:
                    self.log_result("Create COGS Expense", False, 
                        f"COGS not properly calculated: expected ${expected_cogs}, got ${updated_cogs}")
            else:
                self.log_result("Create COGS Expense", False, "Failed to get updated dashboard summary")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Create COGS Expense", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
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

    # ============ RBAC and Multi-Language Tests ============
    
    def test_user_profile_permissions(self):
        """Test GET /api/profile/permissions endpoint"""
        print("\n🔍 Testing User Profile & Permissions...")
        
        response = self.make_request('GET', 'profile/permissions')
        
        if response and response.status_code == 200:
            profile = response.json()
            required_fields = ['user_id', 'username', 'email', 'role', 'language', 'permissions']
            
            if all(field in profile for field in required_fields):
                role = profile.get('role', 'unknown')
                permissions_count = len(profile.get('permissions', []))
                language = profile.get('language', 'unknown')
                
                self.log_result("User Profile & Permissions", True, 
                    f"Role: {role}, Language: {language}, Permissions: {permissions_count}")
                return profile
            else:
                missing_fields = [field for field in required_fields if field not in profile]
                self.log_result("User Profile & Permissions", False, f"Missing fields: {missing_fields}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("User Profile & Permissions", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return None

    def test_language_management(self):
        """Test PUT /api/profile/language endpoint"""
        print("\n🔍 Testing Language Management...")
        
        # Test valid language change to Spanish
        response = self.make_request('PUT', 'profile/language?language=es')
        
        if response and response.status_code == 200:
            result = response.json()
            if result.get('language') == 'es':
                self.log_result("Language Change to Spanish", True, "Language updated to Spanish")
                
                # Verify the change by checking profile
                profile_response = self.make_request('GET', 'profile/permissions')
                if profile_response and profile_response.status_code == 200:
                    profile = profile_response.json()
                    if profile.get('language') == 'es':
                        self.log_result("Language Verification", True, "Language change verified in profile")
                    else:
                        self.log_result("Language Verification", False, f"Profile shows language: {profile.get('language')}")
                
                # Change back to English
                response = self.make_request('PUT', 'profile/language?language=en')
                if response and response.status_code == 200:
                    self.log_result("Language Change to English", True, "Language updated back to English")
                else:
                    self.log_result("Language Change to English", False, "Failed to change back to English")
                
                return True
            else:
                self.log_result("Language Change to Spanish", False, f"Expected 'es', got {result.get('language')}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Language Change to Spanish", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        # Test invalid language
        invalid_response = self.make_request('PUT', 'profile/language?language=fr')
        if invalid_response and invalid_response.status_code == 400:
            self.log_result("Invalid Language Rejection", True, "Correctly rejected invalid language 'fr'")
        else:
            self.log_result("Invalid Language Rejection", False, f"Expected 400, got {invalid_response.status_code if invalid_response else 'None'}")
        
        return False

    def test_create_admin_user(self):
        """Create an admin user for testing admin endpoints"""
        print("\n🔍 Creating Admin User for Testing...")
        
        admin_email = f"admin_test_{datetime.now().strftime('%H%M%S')}@test.com"
        admin_password = "AdminPass123!"
        admin_username = f"AdminUser_{datetime.now().strftime('%H%M%S')}"
        
        response = self.make_request('POST', 'auth/register', {
            "username": admin_username,
            "email": admin_email,
            "password": admin_password,
            "role": "admin"
        })
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data:
                admin_token = data['access_token']
                admin_user_data = data['user']
                
                self.log_result("Create Admin User", True, f"Admin user created: {admin_user_data['username']}")
                return {
                    'token': admin_token,
                    'user_data': admin_user_data,
                    'email': admin_email,
                    'password': admin_password
                }
            else:
                self.log_result("Create Admin User", False, "Missing token in response")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Create Admin User", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return None

    def test_admin_user_management(self):
        """Test admin-only user management endpoints"""
        print("\n🔍 Testing Admin User Management...")
        
        # Create admin user
        admin_info = self.test_create_admin_user()
        if not admin_info:
            self.log_result("Admin User Management", False, "Failed to create admin user")
            return False
        
        # Store original token
        original_token = self.token
        original_user = self.user_data
        
        # Switch to admin token
        self.token = admin_info['token']
        
        success_count = 0
        total_tests = 0
        
        # Test GET /api/users
        total_tests += 1
        response = self.make_request('GET', 'users')
        if response and response.status_code == 200:
            users = response.json()
            if isinstance(users, list) and len(users) >= 2:  # At least admin and regular user
                success_count += 1
                print(f"  ✅ GET /api/users - Found {len(users)} users")
                
                # Find a non-admin user for testing
                test_user = None
                for user in users:
                    if user.get('role') != 'admin' and user.get('id') != admin_info['user_data']['id']:
                        test_user = user
                        break
                
                if test_user:
                    # Test GET /api/users/{user_id}
                    total_tests += 1
                    user_response = self.make_request('GET', f'users/{test_user["id"]}')
                    if user_response and user_response.status_code == 200:
                        user_detail = user_response.json()
                        if 'permissions' in user_detail:
                            success_count += 1
                            print(f"  ✅ GET /api/users/{test_user['id']} - User details retrieved")
                            
                            # Test PUT /api/users/{user_id} - Update user role
                            total_tests += 1
                            update_response = self.make_request('PUT', f'users/{test_user["id"]}', {
                                "role": "manager",
                                "language": "es"
                            })
                            if update_response and update_response.status_code == 200:
                                success_count += 1
                                print(f"  ✅ PUT /api/users/{test_user['id']} - User updated")
                                
                                # Verify the update
                                verify_response = self.make_request('GET', f'users/{test_user["id"]}')
                                if verify_response and verify_response.status_code == 200:
                                    updated_user = verify_response.json()
                                    if updated_user.get('role') == 'manager' and updated_user.get('language') == 'es':
                                        print(f"  ✅ User update verified - Role: {updated_user.get('role')}, Language: {updated_user.get('language')}")
                                    else:
                                        print(f"  ⚠️ User update not fully verified")
                            else:
                                print(f"  ❌ PUT /api/users/{test_user['id']} failed")
                        else:
                            print(f"  ❌ GET /api/users/{test_user['id']} - Missing permissions field")
                    else:
                        print(f"  ❌ GET /api/users/{test_user['id']} failed")
            else:
                print(f"  ❌ GET /api/users - Expected list with >= 2 users, got {len(users) if isinstance(users, list) else 'not a list'}")
        else:
            print(f"  ❌ GET /api/users failed")
        
        # Restore original token
        self.token = original_token
        self.user_data = original_user
        
        if success_count >= 3:  # At least basic user management working
            self.log_result("Admin User Management", True, f"{success_count}/{total_tests} admin operations successful")
            return True
        else:
            self.log_result("Admin User Management", False, f"Only {success_count}/{total_tests} admin operations successful")
        
        return False

    def test_roles_info(self):
        """Test GET /api/roles endpoint (Admin only)"""
        print("\n🔍 Testing Roles Info...")
        
        # Create admin user
        admin_info = self.test_create_admin_user()
        if not admin_info:
            self.log_result("Roles Info", False, "Failed to create admin user")
            return False
        
        # Store original token
        original_token = self.token
        
        # Switch to admin token
        self.token = admin_info['token']
        
        response = self.make_request('GET', 'roles')
        
        if response and response.status_code == 200:
            roles_data = response.json()
            if 'roles' in roles_data:
                roles = roles_data['roles']
                expected_roles = ['admin', 'manager', 'accountant', 'seller']
                
                role_values = [role.get('value') for role in roles]
                if all(expected_role in role_values for expected_role in expected_roles):
                    # Check if each role has permissions
                    roles_with_permissions = sum(1 for role in roles if 'permissions' in role and len(role['permissions']) > 0)
                    
                    self.log_result("Roles Info", True, 
                        f"Found {len(roles)} roles, {roles_with_permissions} with permissions")
                    
                    # Restore original token
                    self.token = original_token
                    return roles_data
                else:
                    missing_roles = [role for role in expected_roles if role not in role_values]
                    self.log_result("Roles Info", False, f"Missing roles: {missing_roles}")
            else:
                self.log_result("Roles Info", False, "Missing 'roles' field in response")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Roles Info", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        # Restore original token
        self.token = original_token
        return None

    def test_permissions_info(self):
        """Test GET /api/permissions endpoint (Admin only)"""
        print("\n🔍 Testing Permissions Info...")
        
        # Create admin user
        admin_info = self.test_create_admin_user()
        if not admin_info:
            self.log_result("Permissions Info", False, "Failed to create admin user")
            return False
        
        # Store original token
        original_token = self.token
        
        # Switch to admin token
        self.token = admin_info['token']
        
        response = self.make_request('GET', 'permissions')
        
        if response and response.status_code == 200:
            permissions_data = response.json()
            if 'permissions' in permissions_data:
                permissions = permissions_data['permissions']
                
                # Check for expected permissions (should be 16 total)
                expected_min_permissions = 10  # At least 10 permissions
                if len(permissions) >= expected_min_permissions:
                    permission_values = [perm.get('value') for perm in permissions]
                    
                    # Check for some key permissions
                    key_permissions = ['view_dashboard', 'manage_users', 'view_sales', 'create_expenses']
                    found_key_permissions = sum(1 for perm in key_permissions if perm in permission_values)
                    
                    self.log_result("Permissions Info", True, 
                        f"Found {len(permissions)} permissions, {found_key_permissions}/{len(key_permissions)} key permissions present")
                    
                    # Restore original token
                    self.token = original_token
                    return permissions_data
                else:
                    self.log_result("Permissions Info", False, f"Expected >= {expected_min_permissions} permissions, got {len(permissions)}")
            else:
                self.log_result("Permissions Info", False, "Missing 'permissions' field in response")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Permissions Info", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        # Restore original token
        self.token = original_token
        return None

    def test_permission_based_access_control(self):
        """Test that endpoints require correct permissions"""
        print("\n🔍 Testing Permission-based Access Control...")
        
        success_count = 0
        total_tests = 0
        
        # Test 1: Non-admin user trying to access admin endpoints
        total_tests += 1
        response = self.make_request('GET', 'users')  # Admin only endpoint
        if response and response.status_code == 403:
            success_count += 1
            print(f"  ✅ Non-admin correctly denied access to GET /api/users")
        else:
            print(f"  ❌ Non-admin should be denied access to GET /api/users, got status: {response.status_code if response else 'None'}")
        
        total_tests += 1
        response = self.make_request('GET', 'roles')  # Admin only endpoint
        if response and response.status_code == 403:
            success_count += 1
            print(f"  ✅ Non-admin correctly denied access to GET /api/roles")
        else:
            print(f"  ❌ Non-admin should be denied access to GET /api/roles, got status: {response.status_code if response else 'None'}")
        
        total_tests += 1
        response = self.make_request('GET', 'permissions')  # Admin only endpoint
        if response and response.status_code == 403:
            success_count += 1
            print(f"  ✅ Non-admin correctly denied access to GET /api/permissions")
        else:
            print(f"  ❌ Non-admin should be denied access to GET /api/permissions, got status: {response.status_code if response else 'None'}")
        
        # Test 2: Create different role users and test their access
        # Create a seller user (default role)
        seller_email = f"seller_test_{datetime.now().strftime('%H%M%S')}@test.com"
        seller_response = self.make_request('POST', 'auth/register', {
            "username": f"SellerUser_{datetime.now().strftime('%H%M%S')}",
            "email": seller_email,
            "password": "SellerPass123!",
            "role": "seller"
        })
        
        if seller_response and seller_response.status_code == 200:
            seller_data = seller_response.json()
            seller_token = seller_data['access_token']
            
            # Store original token
            original_token = self.token
            
            # Switch to seller token
            self.token = seller_token
            
            # Test seller permissions
            total_tests += 1
            profile_response = self.make_request('GET', 'profile/permissions')
            if profile_response and profile_response.status_code == 200:
                profile = profile_response.json()
                seller_permissions = profile.get('permissions', [])
                
                # Seller should have limited permissions
                expected_seller_permissions = ['view_dashboard', 'view_sales', 'create_sales', 'edit_sales']
                has_expected_permissions = any(perm in seller_permissions for perm in expected_seller_permissions)
                
                if has_expected_permissions and 'manage_users' not in seller_permissions:
                    success_count += 1
                    print(f"  ✅ Seller has correct limited permissions: {len(seller_permissions)} permissions")
                else:
                    print(f"  ❌ Seller permissions incorrect: {seller_permissions}")
            else:
                print(f"  ❌ Failed to get seller profile permissions")
            
            # Restore original token
            self.token = original_token
        
        if success_count >= 3:  # At least basic access control working
            self.log_result("Permission-based Access Control", True, f"{success_count}/{total_tests} access control tests passed")
            return True
        else:
            self.log_result("Permission-based Access Control", False, f"Only {success_count}/{total_tests} access control tests passed")
        
        return False

    def test_role_permissions_mapping(self):
        """Test that role permissions are correctly mapped"""
        print("\n🔍 Testing Role Permissions Mapping...")
        
        # Test different roles and their expected permissions
        test_roles = [
            {
                'role': 'seller',
                'expected_permissions': ['view_dashboard', 'view_sales', 'create_sales', 'edit_sales'],
                'forbidden_permissions': ['manage_users', 'manage_categories', 'delete_expenses']
            },
            {
                'role': 'accountant', 
                'expected_permissions': ['view_dashboard', 'view_expenses', 'create_expenses', 'view_reports'],
                'forbidden_permissions': ['manage_users', 'delete_sales']
            },
            {
                'role': 'manager',
                'expected_permissions': ['view_dashboard', 'view_sales', 'create_sales', 'manage_categories', 'view_reports'],
                'forbidden_permissions': ['manage_users']
            }
        ]
        
        success_count = 0
        total_tests = len(test_roles)
        
        for role_test in test_roles:
            role = role_test['role']
            
            # Create user with specific role
            user_email = f"{role}_test_{datetime.now().strftime('%H%M%S')}@test.com"
            user_response = self.make_request('POST', 'auth/register', {
                "username": f"{role.title()}User_{datetime.now().strftime('%H%M%S')}",
                "email": user_email,
                "password": f"{role.title()}Pass123!",
                "role": role
            })
            
            if user_response and user_response.status_code == 200:
                user_data = user_response.json()
                user_token = user_data['access_token']
                
                # Store original token
                original_token = self.token
                
                # Switch to role-specific token
                self.token = user_token
                
                # Get user permissions
                profile_response = self.make_request('GET', 'profile/permissions')
                if profile_response and profile_response.status_code == 200:
                    profile = profile_response.json()
                    user_permissions = profile.get('permissions', [])
                    
                    # Check expected permissions
                    has_expected = all(perm in user_permissions for perm in role_test['expected_permissions'])
                    
                    # Check forbidden permissions are not present
                    has_forbidden = any(perm in user_permissions for perm in role_test['forbidden_permissions'])
                    
                    if has_expected and not has_forbidden:
                        success_count += 1
                        print(f"  ✅ {role.title()} role permissions correct: {len(user_permissions)} total permissions")
                    else:
                        missing_expected = [perm for perm in role_test['expected_permissions'] if perm not in user_permissions]
                        present_forbidden = [perm for perm in role_test['forbidden_permissions'] if perm in user_permissions]
                        print(f"  ❌ {role.title()} role permissions incorrect - Missing: {missing_expected}, Forbidden present: {present_forbidden}")
                else:
                    print(f"  ❌ Failed to get {role} profile permissions")
                
                # Restore original token
                self.token = original_token
            else:
                print(f"  ❌ Failed to create {role} user")
        
        if success_count == total_tests:
            self.log_result("Role Permissions Mapping", True, f"All {total_tests} role permission mappings correct")
            return True
        else:
            self.log_result("Role Permissions Mapping", False, f"Only {success_count}/{total_tests} role permission mappings correct")
        
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
        
        # ============ NEW: RBAC and Multi-Language Tests ============
        print("\n" + "="*70)
        print("🔐 PRIORITY: Role-Based Access Control & Multi-Language Tests")
        print("="*70)
        
        # User profile and permissions tests
        self.test_user_profile_permissions()
        self.test_language_management()
        
        # Admin-only endpoints tests
        self.test_roles_info()
        self.test_permissions_info()
        self.test_admin_user_management()
        
        # Permission-based access control tests
        self.test_permission_based_access_control()
        self.test_role_permissions_mapping()
        
        # ============ Original Tests (for regression) ============
        print("\n" + "="*60)
        print("📊 Regression Tests - Core Functionality")
        print("="*60)
        
        # Category tests
        self.test_get_categories()
        self.test_create_custom_category()
        self.test_update_custom_category()
        
        # COGS-specific tests
        print("\n" + "="*60)
        print("🧮 COGS-Specific Tests")
        print("="*60)
        self.test_cogs_categories()
        self.test_debug_cogs_endpoint()
        self.test_create_cogs_expense()
        
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
        
        # Test COGS calculation with existing user (regression)
        print("\n" + "="*60)
        print("🎯 COGS Calculation Regression Test")
        print("="*60)
        self.test_cogs_calculation_with_existing_user()
        
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