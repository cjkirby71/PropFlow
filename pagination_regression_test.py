#!/usr/bin/env python3
"""
PropFlow CRM Pagination Regression Test Suite
Tests all paginated list endpoints after database performance upgrade
"""

import asyncio
import aiohttp
import json
import math
from datetime import datetime
from typing import Dict, Any, Optional

# Test configuration
BASE_URL = "https://propflow-crm-4.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@propflow.com"
ADMIN_PASSWORD = "admin123"

class PaginationTester:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.test_data = {}  # Store created test data for cleanup
        
    async def __aenter__(self):
        # Create session with cookie jar to handle secure cookies
        jar = aiohttp.CookieJar(unsafe=True)  # Allow cookies for different domains
        self.session = aiohttp.ClientSession(
            cookie_jar=jar,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "success": success,
            "details": details,
            "response_data": response_data,
            "timestamp": datetime.now().isoformat()
        })
        print(f"{status} {test_name}: {details}")
    
    async def make_request(self, method: str, endpoint: str, data: Dict = None, 
                          headers: Dict = None, expect_status: int = 200) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{BASE_URL}{endpoint}"
        request_headers = {"Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)
            
        try:
            async with self.session.request(
                method, url, 
                json=data if data else None,
                headers=request_headers
            ) as response:
                try:
                    response_data = await response.json()
                except:
                    response_data = await response.text()
                
                success = response.status == expect_status
                return success, response_data, response.status
                
        except Exception as e:
            return False, str(e), 0
    
    async def test_auth_login(self):
        """Test admin login"""
        success, data, status = await self.make_request(
            "POST", "/auth/login",
            {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if success and isinstance(data, dict) and "email" in data:
            self.log_result("Auth Login", True, f"Logged in as {data.get('email')}")
            return True
        else:
            self.log_result("Auth Login", False, f"Status: {status}, Response: {data}")
            return False
    
    def validate_pagination_response(self, data: Any, expected_page: int = 1, expected_limit: int = 50) -> tuple:
        """Validate pagination response format"""
        if not isinstance(data, dict):
            return False, "Response is not a dictionary"
        
        if "data" not in data:
            return False, "Missing 'data' field in response"
        
        if "pagination" not in data:
            return False, "Missing 'pagination' field in response"
        
        if not isinstance(data["data"], list):
            return False, "'data' field is not a list"
        
        pagination = data["pagination"]
        required_pagination_fields = ["page", "limit", "total", "total_pages"]
        
        for field in required_pagination_fields:
            if field not in pagination:
                return False, f"Missing '{field}' in pagination object"
        
        # Validate pagination values
        if pagination["page"] != expected_page:
            return False, f"Expected page {expected_page}, got {pagination['page']}"
        
        if pagination["limit"] != expected_limit:
            return False, f"Expected limit {expected_limit}, got {pagination['limit']}"
        
        # Validate total_pages calculation
        expected_total_pages = math.ceil(pagination["total"] / pagination["limit"]) if pagination["total"] > 0 else 0
        if pagination["total_pages"] != expected_total_pages:
            return False, f"Incorrect total_pages calculation. Expected {expected_total_pages}, got {pagination['total_pages']}"
        
        # Validate data array length doesn't exceed limit
        if len(data["data"]) > pagination["limit"]:
            return False, f"Data array length ({len(data['data'])}) exceeds limit ({pagination['limit']})"
        
        return True, "Valid pagination response"
    
    async def test_contacts_pagination(self):
        """Test contacts pagination with different parameters"""
        # Test 1: Basic pagination with page=1, limit=5
        success, data, status = await self.make_request("GET", "/contacts?page=1&limit=5")
        if not success:
            self.log_result("Contacts Pagination (page=1, limit=5)", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=5)
        if not valid:
            self.log_result("Contacts Pagination (page=1, limit=5)", False, msg)
            return False
        
        self.log_result("Contacts Pagination (page=1, limit=5)", True, 
                       f"Total: {data['pagination']['total']}, Pages: {data['pagination']['total_pages']}, Items: {len(data['data'])}")
        
        # Test 2: Different limit with page=1, limit=2
        success, data, status = await self.make_request("GET", "/contacts?page=1&limit=2")
        if not success:
            self.log_result("Contacts Pagination (page=1, limit=2)", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=2)
        if not valid:
            self.log_result("Contacts Pagination (page=1, limit=2)", False, msg)
            return False
        
        self.log_result("Contacts Pagination (page=1, limit=2)", True, 
                       f"Total: {data['pagination']['total']}, Pages: {data['pagination']['total_pages']}, Items: {len(data['data'])}")
        
        return True
    
    async def test_properties_pagination(self):
        """Test properties pagination"""
        success, data, status = await self.make_request("GET", "/properties?page=1&limit=50")
        if not success:
            self.log_result("Properties Pagination", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=50)
        if not valid:
            self.log_result("Properties Pagination", False, msg)
            return False
        
        self.log_result("Properties Pagination", True, 
                       f"Total: {data['pagination']['total']}, Pages: {data['pagination']['total_pages']}, Items: {len(data['data'])}")
        return True
    
    async def test_deals_pagination(self):
        """Test deals pagination"""
        success, data, status = await self.make_request("GET", "/deals?page=1&limit=50")
        if not success:
            self.log_result("Deals Pagination", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=50)
        if not valid:
            self.log_result("Deals Pagination", False, msg)
            return False
        
        self.log_result("Deals Pagination", True, 
                       f"Total: {data['pagination']['total']}, Pages: {data['pagination']['total_pages']}, Items: {len(data['data'])}")
        return True
    
    async def test_tasks_pagination(self):
        """Test tasks pagination"""
        success, data, status = await self.make_request("GET", "/tasks?page=1&limit=50")
        if not success:
            self.log_result("Tasks Pagination", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=50)
        if not valid:
            self.log_result("Tasks Pagination", False, msg)
            return False
        
        self.log_result("Tasks Pagination", True, 
                       f"Total: {data['pagination']['total']}, Pages: {data['pagination']['total_pages']}, Items: {len(data['data'])}")
        return True
    
    async def test_activities_pagination(self):
        """Test activities pagination"""
        success, data, status = await self.make_request("GET", "/activities?page=1&limit=50")
        if not success:
            self.log_result("Activities Pagination", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=50)
        if not valid:
            self.log_result("Activities Pagination", False, msg)
            return False
        
        self.log_result("Activities Pagination", True, 
                       f"Total: {data['pagination']['total']}, Pages: {data['pagination']['total_pages']}, Items: {len(data['data'])}")
        return True
    
    async def test_templates_pagination(self):
        """Test templates pagination"""
        success, data, status = await self.make_request("GET", "/templates?page=1&limit=50")
        if not success:
            self.log_result("Templates Pagination", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=50)
        if not valid:
            self.log_result("Templates Pagination", False, msg)
            return False
        
        self.log_result("Templates Pagination", True, 
                       f"Total: {data['pagination']['total']}, Pages: {data['pagination']['total_pages']}, Items: {len(data['data'])}")
        return True
    
    async def test_webhooks_pagination(self):
        """Test webhooks pagination"""
        success, data, status = await self.make_request("GET", "/webhooks?page=1&limit=50")
        if not success:
            self.log_result("Webhooks Pagination", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=50)
        if not valid:
            self.log_result("Webhooks Pagination", False, msg)
            return False
        
        self.log_result("Webhooks Pagination", True, 
                       f"Total: {data['pagination']['total']}, Pages: {data['pagination']['total_pages']}, Items: {len(data['data'])}")
        return True
    
    async def test_team_members_pagination(self):
        """Test team members pagination"""
        success, data, status = await self.make_request("GET", "/team/members?page=1&limit=50")
        if not success:
            self.log_result("Team Members Pagination", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=50)
        if not valid:
            self.log_result("Team Members Pagination", False, msg)
            return False
        
        self.log_result("Team Members Pagination", True, 
                       f"Total: {data['pagination']['total']}, Pages: {data['pagination']['total_pages']}, Items: {len(data['data'])}")
        return True
    
    async def test_api_keys_pagination(self):
        """Test API keys pagination"""
        success, data, status = await self.make_request("GET", "/api-keys?page=1&limit=50")
        if not success:
            self.log_result("API Keys Pagination", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=50)
        if not valid:
            self.log_result("API Keys Pagination", False, msg)
            return False
        
        self.log_result("API Keys Pagination", True, 
                       f"Total: {data['pagination']['total']}, Pages: {data['pagination']['total_pages']}, Items: {len(data['data'])}")
        return True
    
    async def test_contacts_sorting(self):
        """Test contacts sorting functionality"""
        success, data, status = await self.make_request("GET", "/contacts?sort=name&order=asc&page=1&limit=10")
        if not success:
            self.log_result("Contacts Sorting", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=10)
        if not valid:
            self.log_result("Contacts Sorting", False, f"Pagination validation failed: {msg}")
            return False
        
        # Check if data is sorted by name (ascending)
        contacts = data["data"]
        if len(contacts) > 1:
            names = [contact.get("name", "").lower() for contact in contacts if contact.get("name")]
            is_sorted = all(names[i] <= names[i+1] for i in range(len(names)-1))
            if not is_sorted:
                self.log_result("Contacts Sorting", False, "Contacts not sorted by name in ascending order")
                return False
        
        self.log_result("Contacts Sorting", True, f"Contacts sorted correctly, {len(contacts)} items returned")
        return True
    
    async def test_dashboard_stats_not_paginated(self):
        """Test that dashboard stats endpoint is NOT paginated (should return old format)"""
        success, data, status = await self.make_request("GET", "/dashboard/stats")
        if not success:
            self.log_result("Dashboard Stats (Not Paginated)", False, f"Status: {status}, Response: {data}")
            return False
        
        # Dashboard should NOT have pagination format
        if isinstance(data, dict) and "pagination" in data:
            self.log_result("Dashboard Stats (Not Paginated)", False, "Dashboard stats incorrectly has pagination format")
            return False
        
        # Should have the expected dashboard fields
        if isinstance(data, dict):
            expected_fields = ["total_contacts", "total_deals", "total_properties", "open_tasks"]
            missing_fields = [field for field in expected_fields if field not in data]
            if missing_fields:
                self.log_result("Dashboard Stats (Not Paginated)", False, f"Missing fields: {missing_fields}")
                return False
        
        self.log_result("Dashboard Stats (Not Paginated)", True, "Dashboard stats correctly returns old format (not paginated)")
        return True
    
    async def test_crud_regression(self):
        """Test CRUD operations still work with pagination"""
        # Create a contact
        contact_data = {
            "name": "Pagination Test Contact",
            "email": "pagination.test@example.com",
            "phone": "(555) 999-8888",
            "company": "Pagination Test Co",
            "source": "api_test",
            "property_type": "residential_lease",
            "notes": "Created for pagination regression testing",
            "lead_score": 85
        }
        
        success, data, status = await self.make_request("POST", "/contacts", contact_data)
        if not success:
            self.log_result("CRUD Regression - Create", False, f"Status: {status}, Response: {data}")
            return False
        
        contact_id = data.get("id")
        if not contact_id:
            self.log_result("CRUD Regression - Create", False, "No contact ID returned")
            return False
        
        self.test_data["contact_id"] = contact_id
        self.log_result("CRUD Regression - Create", True, f"Created contact: {contact_id}")
        
        # Verify it appears in paginated list
        success, data, status = await self.make_request("GET", "/contacts?page=1&limit=100")
        if not success:
            self.log_result("CRUD Regression - List", False, f"Status: {status}, Response: {data}")
            return False
        
        valid, msg = self.validate_pagination_response(data, expected_page=1, expected_limit=100)
        if not valid:
            self.log_result("CRUD Regression - List", False, f"Pagination validation failed: {msg}")
            return False
        
        # Check if our contact is in the list
        contact_found = any(contact.get("id") == contact_id for contact in data["data"])
        if not contact_found:
            self.log_result("CRUD Regression - List", False, "Created contact not found in paginated list")
            return False
        
        self.log_result("CRUD Regression - List", True, "Created contact found in paginated list")
        
        # Update the contact
        update_data = {"name": "Updated Pagination Test Contact", "lead_score": 95}
        success, data, status = await self.make_request("PUT", f"/contacts/{contact_id}", update_data)
        if not success:
            self.log_result("CRUD Regression - Update", False, f"Status: {status}, Response: {data}")
            return False
        
        if data.get("name") != "Updated Pagination Test Contact":
            self.log_result("CRUD Regression - Update", False, "Contact name not updated correctly")
            return False
        
        self.log_result("CRUD Regression - Update", True, f"Updated contact: {contact_id}")
        
        # Delete the contact
        success, data, status = await self.make_request("DELETE", f"/contacts/{contact_id}")
        if not success:
            self.log_result("CRUD Regression - Delete", False, f"Status: {status}, Response: {data}")
            return False
        
        self.log_result("CRUD Regression - Delete", True, f"Deleted contact: {contact_id}")
        return True
    
    async def test_email_validation_fix(self):
        """Test that email validation is now working (previous fix verification)"""
        success, data, status = await self.make_request(
            "POST", "/contacts",
            {"name": "Test", "email": "bademail"},
            expect_status=422
        )
        
        if status == 422:
            self.log_result("Email Validation Fix", True, "Invalid email correctly rejected with 422")
            return True
        else:
            self.log_result("Email Validation Fix", False, f"Invalid email accepted, status: {status}")
            return False
    
    async def test_objectid_validation_fix(self):
        """Test that ObjectId validation returns 404 (previous fix verification)"""
        success, data, status = await self.make_request(
            "GET", "/contacts/invalid-id",
            expect_status=404
        )
        
        if status == 404:
            self.log_result("ObjectId Validation Fix", True, "Invalid ObjectId correctly returns 404")
            return True
        else:
            self.log_result("ObjectId Validation Fix", False, f"Invalid ObjectId returned status: {status}")
            return False
    
    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print("\n" + "="*80)
        print("PROPFLOW CRM PAGINATION REGRESSION TEST SUMMARY")
        print("="*80)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print("\nFAILED TESTS:")
            print("-" * 40)
            for result in self.test_results:
                if not result["success"]:
                    print(f"❌ {result['test']}: {result['details']}")
        
        print("\nALL TEST RESULTS:")
        print("-" * 40)
        for result in self.test_results:
            print(f"{result['status']} {result['test']}")
        
        return failed_tests == 0

async def main():
    """Run all pagination regression tests"""
    print("Starting PropFlow CRM Pagination Regression Tests...")
    print(f"Testing against: {BASE_URL}")
    print("="*80)
    
    async with PaginationTester() as tester:
        # Authentication
        if not await tester.test_auth_login():
            print("❌ Login failed - cannot continue with other tests")
            return False
        
        # Test all paginated list endpoints
        await tester.test_contacts_pagination()
        await tester.test_properties_pagination()
        await tester.test_deals_pagination()
        await tester.test_tasks_pagination()
        await tester.test_activities_pagination()
        await tester.test_templates_pagination()
        await tester.test_webhooks_pagination()
        await tester.test_team_members_pagination()
        await tester.test_api_keys_pagination()
        
        # Test sorting
        await tester.test_contacts_sorting()
        
        # Test dashboard is NOT paginated
        await tester.test_dashboard_stats_not_paginated()
        
        # Test CRUD regression
        await tester.test_crud_regression()
        
        # Test previous fixes
        await tester.test_email_validation_fix()
        await tester.test_objectid_validation_fix()
        
        # Print summary
        success = tester.print_summary()
        return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)