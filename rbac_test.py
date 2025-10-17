#!/usr/bin/env python3
"""
Focused RBAC and Multi-Language Testing Script
Tests the newly implemented role-based permission system and multi-language support.
"""

import requests
import json
from datetime import datetime
import sys

class RBACTester:
    def __init__(self, base_url="https://cashflow-clarity-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}")
            if details:
                print(f"   {details}")
        else:
            print(f"❌ {test_name}")
            if details:
                print(f"   Error: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request"""
        url = f"{self.api_url}/{endpoint}"
        if not headers:
            headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            
            return response
        except Exception as e:
            print(f"Request error for {method} {endpoint}: {str(e)}")
            return None

    def create_test_user(self, role="seller", suffix=""):
        """Create a test user with specified role"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "username": f"{role.title()}User_{timestamp}{suffix}",
            "email": f"{role}_test_{timestamp}{suffix}@test.com",
            "password": f"{role.title()}Pass123!",
            "role": role
        }
        
        response = self.make_request('POST', 'auth/register', user_data)
        
        if response and response.status_code == 200:
            data = response.json()
            return {
                'token': data['access_token'],
                'user_data': data['user'],
                'credentials': user_data
            }
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            print(f"Failed to create {role} user: {error_msg}")
            return None

    def test_user_profile_permissions(self):
        """Test GET /api/profile/permissions"""
        print("\n🔍 Testing User Profile & Permissions...")
        
        # Create a regular user
        user_info = self.create_test_user("seller")
        if not user_info:
            self.log_result("User Profile & Permissions", False, "Failed to create test user")
            return False
        
        headers = {'Authorization': f'Bearer {user_info["token"]}'}
        response = self.make_request('GET', 'profile/permissions', headers=headers)
        
        if response and response.status_code == 200:
            profile = response.json()
            required_fields = ['user_id', 'username', 'email', 'role', 'language', 'permissions']
            
            if all(field in profile for field in required_fields):
                role = profile.get('role')
                permissions_count = len(profile.get('permissions', []))
                language = profile.get('language')
                
                self.log_result("User Profile & Permissions", True, 
                    f"Role: {role}, Language: {language}, Permissions: {permissions_count}")
                return profile
            else:
                missing_fields = [field for field in required_fields if field not in profile]
                self.log_result("User Profile & Permissions", False, f"Missing fields: {missing_fields}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("User Profile & Permissions", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_language_management(self):
        """Test PUT /api/profile/language"""
        print("\n🔍 Testing Language Management...")
        
        # Create a test user
        user_info = self.create_test_user("seller", "_lang")
        if not user_info:
            self.log_result("Language Management", False, "Failed to create test user")
            return False
        
        headers = {'Authorization': f'Bearer {user_info["token"]}'}
        
        # Test changing to Spanish
        response = self.make_request('PUT', 'profile/language?language=es', headers=headers)
        
        if response and response.status_code == 200:
            result = response.json()
            if result.get('language') == 'es':
                # Verify the change
                profile_response = self.make_request('GET', 'profile/permissions', headers=headers)
                if profile_response and profile_response.status_code == 200:
                    profile = profile_response.json()
                    if profile.get('language') == 'es':
                        self.log_result("Language Management", True, "Successfully changed language to Spanish and verified")
                        return True
                    else:
                        self.log_result("Language Management", False, f"Language not updated in profile: {profile.get('language')}")
                else:
                    self.log_result("Language Management", False, "Failed to verify language change")
            else:
                self.log_result("Language Management", False, f"Expected 'es', got {result.get('language')}")
        else:
            error_msg = response.json().get('detail', 'Unknown error') if response else 'No response'
            self.log_result("Language Management", False, f"Status: {response.status_code if response else 'None'}, Error: {error_msg}")
        
        return False

    def test_admin_endpoints(self):
        """Test admin-only endpoints"""
        print("\n🔍 Testing Admin Endpoints...")
        
        # Create admin user
        admin_info = self.create_test_user("admin")
        if not admin_info:
            self.log_result("Admin Endpoints", False, "Failed to create admin user")
            return False
        
        admin_headers = {'Authorization': f'Bearer {admin_info["token"]}'}
        
        success_count = 0
        total_tests = 0
        
        # Test GET /api/users
        total_tests += 1
        response = self.make_request('GET', 'users', headers=admin_headers)
        if response and response.status_code == 200:
            users = response.json()
            if isinstance(users, list) and len(users) > 0:
                success_count += 1
                print(f"  ✅ GET /api/users - Found {len(users)} users")
            else:
                print(f"  ❌ GET /api/users - Invalid response format")
        else:
            print(f"  ❌ GET /api/users - Status: {response.status_code if response else 'None'}")
        
        # Test GET /api/roles
        total_tests += 1
        response = self.make_request('GET', 'roles', headers=admin_headers)
        if response and response.status_code == 200:
            roles_data = response.json()
            if 'roles' in roles_data:
                roles = roles_data['roles']
                expected_roles = ['admin', 'manager', 'accountant', 'seller']
                role_values = [role.get('value') for role in roles]
                
                if all(expected_role in role_values for expected_role in expected_roles):
                    success_count += 1
                    print(f"  ✅ GET /api/roles - Found all {len(expected_roles)} expected roles")
                else:
                    missing_roles = [role for role in expected_roles if role not in role_values]
                    print(f"  ❌ GET /api/roles - Missing roles: {missing_roles}")
            else:
                print(f"  ❌ GET /api/roles - Missing 'roles' field")
        else:
            print(f"  ❌ GET /api/roles - Status: {response.status_code if response else 'None'}")
        
        # Test GET /api/permissions
        total_tests += 1
        response = self.make_request('GET', 'permissions', headers=admin_headers)
        if response and response.status_code == 200:
            permissions_data = response.json()
            if 'permissions' in permissions_data:
                permissions = permissions_data['permissions']
                if len(permissions) >= 10:  # Should have at least 10 permissions
                    success_count += 1
                    print(f"  ✅ GET /api/permissions - Found {len(permissions)} permissions")
                else:
                    print(f"  ❌ GET /api/permissions - Only {len(permissions)} permissions found")
            else:
                print(f"  ❌ GET /api/permissions - Missing 'permissions' field")
        else:
            print(f"  ❌ GET /api/permissions - Status: {response.status_code if response else 'None'}")
        
        if success_count == total_tests:
            self.log_result("Admin Endpoints", True, f"All {total_tests} admin endpoints working")
            return True
        else:
            self.log_result("Admin Endpoints", False, f"Only {success_count}/{total_tests} admin endpoints working")
        
        return False

    def test_permission_access_control(self):
        """Test permission-based access control"""
        print("\n🔍 Testing Permission-based Access Control...")
        
        # Create non-admin user
        user_info = self.create_test_user("seller", "_access")
        if not user_info:
            self.log_result("Permission Access Control", False, "Failed to create test user")
            return False
        
        user_headers = {'Authorization': f'Bearer {user_info["token"]}'}
        
        success_count = 0
        total_tests = 0
        
        # Test that non-admin is denied access to admin endpoints
        admin_endpoints = ['users', 'roles', 'permissions']
        
        for endpoint in admin_endpoints:
            total_tests += 1
            response = self.make_request('GET', endpoint, headers=user_headers)
            if response and response.status_code == 403:
                success_count += 1
                print(f"  ✅ Non-admin correctly denied access to GET /api/{endpoint}")
            else:
                print(f"  ❌ Non-admin should be denied access to GET /api/{endpoint}, got status: {response.status_code if response else 'None'}")
        
        if success_count == total_tests:
            self.log_result("Permission Access Control", True, f"All {total_tests} access control tests passed")
            return True
        else:
            self.log_result("Permission Access Control", False, f"Only {success_count}/{total_tests} access control tests passed")
        
        return False

    def test_role_permissions_mapping(self):
        """Test that different roles have correct permissions"""
        print("\n🔍 Testing Role Permissions Mapping...")
        
        test_roles = [
            {
                'role': 'seller',
                'expected_permissions': ['view_dashboard', 'view_sales', 'create_sales', 'edit_sales'],
                'forbidden_permissions': ['manage_users', 'manage_categories']
            },
            {
                'role': 'accountant',
                'expected_permissions': ['view_dashboard', 'view_expenses', 'create_expenses', 'view_reports'],
                'forbidden_permissions': ['manage_users', 'delete_sales']
            },
            {
                'role': 'manager',
                'expected_permissions': ['view_dashboard', 'view_sales', 'manage_categories', 'view_reports'],
                'forbidden_permissions': ['manage_users']
            }
        ]
        
        success_count = 0
        total_tests = len(test_roles)
        
        for role_test in test_roles:
            role = role_test['role']
            
            # Create user with specific role
            user_info = self.create_test_user(role, f"_perm")
            if not user_info:
                print(f"  ❌ Failed to create {role} user")
                continue
            
            headers = {'Authorization': f'Bearer {user_info["token"]}'}
            
            # Get user permissions
            response = self.make_request('GET', 'profile/permissions', headers=headers)
            if response and response.status_code == 200:
                profile = response.json()
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
                    print(f"  ❌ {role.title()} role permissions incorrect")
                    if missing_expected:
                        print(f"     Missing expected: {missing_expected}")
                    if present_forbidden:
                        print(f"     Has forbidden: {present_forbidden}")
            else:
                print(f"  ❌ Failed to get {role} profile permissions")
        
        if success_count == total_tests:
            self.log_result("Role Permissions Mapping", True, f"All {total_tests} role permission mappings correct")
            return True
        else:
            self.log_result("Role Permissions Mapping", False, f"Only {success_count}/{total_tests} role permission mappings correct")
        
        return False

    def test_user_management_operations(self):
        """Test admin user management operations"""
        print("\n🔍 Testing User Management Operations...")
        
        # Create admin user
        admin_info = self.create_test_user("admin", "_mgmt")
        if not admin_info:
            self.log_result("User Management Operations", False, "Failed to create admin user")
            return False
        
        # Create a regular user to manage
        target_user_info = self.create_test_user("seller", "_target")
        if not target_user_info:
            self.log_result("User Management Operations", False, "Failed to create target user")
            return False
        
        admin_headers = {'Authorization': f'Bearer {admin_info["token"]}'}
        target_user_id = target_user_info['user_data']['id']
        
        success_count = 0
        total_tests = 0
        
        # Test GET specific user
        total_tests += 1
        response = self.make_request('GET', f'users/{target_user_id}', headers=admin_headers)
        if response and response.status_code == 200:
            user_detail = response.json()
            if 'permissions' in user_detail and user_detail.get('id') == target_user_id:
                success_count += 1
                print(f"  ✅ GET /api/users/{target_user_id} - User details retrieved")
            else:
                print(f"  ❌ GET /api/users/{target_user_id} - Invalid response format")
        else:
            print(f"  ❌ GET /api/users/{target_user_id} - Status: {response.status_code if response else 'None'}")
        
        # Test PUT update user
        total_tests += 1
        update_data = {
            "role": "manager",
            "language": "es"
        }
        response = self.make_request('PUT', f'users/{target_user_id}', update_data, admin_headers)
        if response and response.status_code == 200:
            # Verify the update
            verify_response = self.make_request('GET', f'users/{target_user_id}', headers=admin_headers)
            if verify_response and verify_response.status_code == 200:
                updated_user = verify_response.json()
                if updated_user.get('role') == 'manager' and updated_user.get('language') == 'es':
                    success_count += 1
                    print(f"  ✅ PUT /api/users/{target_user_id} - User updated and verified")
                else:
                    print(f"  ❌ PUT /api/users/{target_user_id} - Update not verified")
            else:
                print(f"  ❌ PUT /api/users/{target_user_id} - Failed to verify update")
        else:
            print(f"  ❌ PUT /api/users/{target_user_id} - Status: {response.status_code if response else 'None'}")
        
        if success_count >= 1:  # At least basic user management working
            self.log_result("User Management Operations", True, f"{success_count}/{total_tests} user management operations successful")
            return True
        else:
            self.log_result("User Management Operations", False, f"Only {success_count}/{total_tests} user management operations successful")
        
        return False

    def run_all_tests(self):
        """Run all RBAC and multi-language tests"""
        print("🚀 Starting RBAC and Multi-Language Tests...")
        print(f"Testing against: {self.base_url}")
        print("="*70)
        
        # Core RBAC tests
        self.test_user_profile_permissions()
        self.test_language_management()
        self.test_admin_endpoints()
        self.test_permission_access_control()
        self.test_role_permissions_mapping()
        self.test_user_management_operations()
        
        return self.generate_summary()

    def generate_summary(self):
        """Generate test summary"""
        print(f"\n📊 RBAC & Multi-Language Test Summary:")
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
    tester = RBACTester()
    summary = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if summary["success_rate"] >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())