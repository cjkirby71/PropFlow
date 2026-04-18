#!/usr/bin/env python3
"""
PropFlow CRM Backend Regression Test Suite
Tests all backend functionality after security hardening
"""

import asyncio
import aiohttp
import json
import csv
import io
import os
from datetime import datetime
from typing import Dict, Any, Optional

# Test configuration
BASE_URL = "https://propflow-crm-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@propflow.com"
ADMIN_PASSWORD = "admin123"

class PropFlowTester:
    def __init__(self):
        self.session = None
        self.access_token = None
        self.refresh_token = None
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
    
    async def test_auth_me(self):
        """Test /auth/me endpoint"""
        success, data, status = await self.make_request("GET", "/auth/me")
        
        if success and isinstance(data, dict) and "email" in data:
            self.log_result("Auth Me", True, f"User info retrieved: {data.get('email')}")
            return True
        else:
            self.log_result("Auth Me", False, f"Status: {status}, Response: {data}")
            return False
    
    async def test_auth_register(self):
        """Test user registration"""
        test_email = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        success, data, status = await self.make_request(
            "POST", "/auth/register",
            {
                "email": test_email,
                "password": "testpass123",
                "name": "Test User"
            }
        )
        
        if success and isinstance(data, dict) and "email" in data:
            self.log_result("Auth Register", True, f"Registered user: {test_email}")
            self.test_data["test_user_email"] = test_email
            return True
        else:
            self.log_result("Auth Register", False, f"Status: {status}, Response: {data}")
            return False
    
    async def test_auth_refresh(self):
        """Test token refresh"""
        success, data, status = await self.make_request("POST", "/auth/refresh")
        
        if success:
            self.log_result("Auth Refresh", True, "Token refreshed successfully")
            return True
        else:
            self.log_result("Auth Refresh", False, f"Status: {status}, Response: {data}")
            return False
    
    async def test_auth_logout(self):
        """Test logout"""
        success, data, status = await self.make_request("POST", "/auth/logout")
        
        if success:
            self.log_result("Auth Logout", True, "Logged out successfully")
            return True
        else:
            self.log_result("Auth Logout", False, f"Status: {status}, Response: {data}")
            return False
    
    async def test_contacts_crud(self):
        """Test contacts CRUD operations"""
        # Create contact
        contact_data = {
            "name": "John Doe",
            "email": "john.doe@example.com",
            "phone": "(555) 123-4567",
            "company": "Test Company",
            "source": "website",
            "property_type": "residential_lease",
            "notes": "Test contact for regression testing",
            "lead_score": 75
        }
        
        success, data, status = await self.make_request("POST", "/contacts", contact_data)
        if not success:
            self.log_result("Contacts Create", False, f"Status: {status}, Response: {data}")
            return False
        
        contact_id = data.get("id")
        if not contact_id:
            self.log_result("Contacts Create", False, "No contact ID returned")
            return False
        
        self.test_data["contact_id"] = contact_id
        self.log_result("Contacts Create", True, f"Created contact: {contact_id}")
        
        # List contacts
        success, data, status = await self.make_request("GET", "/contacts")
        if success and isinstance(data, list):
            self.log_result("Contacts List", True, f"Retrieved {len(data)} contacts")
        else:
            self.log_result("Contacts List", False, f"Status: {status}, Response: {data}")
            return False
        
        # Get contact by ID
        success, data, status = await self.make_request("GET", f"/contacts/{contact_id}")
        if success and data.get("id") == contact_id:
            self.log_result("Contacts Get", True, f"Retrieved contact: {contact_id}")
        else:
            self.log_result("Contacts Get", False, f"Status: {status}, Response: {data}")
            return False
        
        # Update contact
        update_data = {"name": "John Doe Updated", "lead_score": 85}
        success, data, status = await self.make_request("PUT", f"/contacts/{contact_id}", update_data)
        if success and data.get("name") == "John Doe Updated":
            self.log_result("Contacts Update", True, f"Updated contact: {contact_id}")
        else:
            self.log_result("Contacts Update", False, f"Status: {status}, Response: {data}")
            return False
        
        return True
    
    async def test_contacts_import_export(self):
        """Test contacts import/export functionality"""
        # Download template
        try:
            async with self.session.get(f"{BASE_URL}/contacts/template") as response:
                if response.status == 200:
                    template_content = await response.text()
                    self.log_result("Contacts Template", True, "Downloaded CSV template")
                else:
                    self.log_result("Contacts Template", False, f"Status: {response.status}")
                    return False
        except Exception as e:
            self.log_result("Contacts Template", False, f"Error: {e}")
            return False
        
        # Export contacts
        try:
            async with self.session.get(f"{BASE_URL}/contacts/export") as response:
                if response.status == 200:
                    export_content = await response.text()
                    self.log_result("Contacts Export", True, "Exported contacts CSV")
                else:
                    self.log_result("Contacts Export", False, f"Status: {response.status}")
                    return False
        except Exception as e:
            self.log_result("Contacts Export", False, f"Error: {e}")
            return False
        
        # Test CSV import (create a simple CSV)
        csv_content = """name,email,phone,company,source,property_type,tags,notes,lead_score
Jane Smith,jane.smith@example.com,(555) 987-6543,Import Test Co,csv_import,commercial_lease,vip,Imported contact,90"""
        
        try:
            form_data = aiohttp.FormData()
            form_data.add_field('file', csv_content, filename='test_import.csv', content_type='text/csv')
            
            async with self.session.post(f"{BASE_URL}/contacts/import", data=form_data) as response:
                if response.status == 200:
                    result = await response.json()
                    imported = result.get("imported", 0)
                    self.log_result("Contacts Import", True, f"Imported {imported} contacts")
                else:
                    self.log_result("Contacts Import", False, f"Status: {response.status}")
                    return False
        except Exception as e:
            self.log_result("Contacts Import", False, f"Error: {e}")
            return False
        
        return True
    
    async def test_properties_crud(self):
        """Test properties CRUD operations"""
        # Create property
        property_data = {
            "name": "Test Property",
            "address": "123 Test St, Test City, TS 12345",
            "property_type": "residential",
            "listing_type": "lease",
            "price": 2500.00,
            "sqft": 1200,
            "bedrooms": 2,
            "bathrooms": 2,
            "description": "Test property for regression testing",
            "status": "active"
        }
        
        success, data, status = await self.make_request("POST", "/properties", property_data)
        if not success:
            self.log_result("Properties Create", False, f"Status: {status}, Response: {data}")
            return False
        
        property_id = data.get("id")
        if not property_id:
            self.log_result("Properties Create", False, "No property ID returned")
            return False
        
        self.test_data["property_id"] = property_id
        self.log_result("Properties Create", True, f"Created property: {property_id}")
        
        # List properties
        success, data, status = await self.make_request("GET", "/properties")
        if success and isinstance(data, list):
            self.log_result("Properties List", True, f"Retrieved {len(data)} properties")
        else:
            self.log_result("Properties List", False, f"Status: {status}, Response: {data}")
            return False
        
        # Get property by ID
        success, data, status = await self.make_request("GET", f"/properties/{property_id}")
        if success and data.get("id") == property_id:
            self.log_result("Properties Get", True, f"Retrieved property: {property_id}")
        else:
            self.log_result("Properties Get", False, f"Status: {status}, Response: {data}")
            return False
        
        # Update property
        update_data = {"price": 2750.00, "status": "pending"}
        success, data, status = await self.make_request("PUT", f"/properties/{property_id}", update_data)
        if success and data.get("price") == 2750.00:
            self.log_result("Properties Update", True, f"Updated property: {property_id}")
        else:
            self.log_result("Properties Update", False, f"Status: {status}, Response: {data}")
            return False
        
        return True
    
    async def test_deals_crud(self):
        """Test deals CRUD operations"""
        # Create deal
        deal_data = {
            "title": "Test Deal",
            "pipeline_type": "residential_lease",
            "stage": "New Lead",
            "contact_id": self.test_data.get("contact_id", ""),
            "property_id": self.test_data.get("property_id", ""),
            "value": 30000.00,
            "notes": "Test deal for regression testing"
        }
        
        success, data, status = await self.make_request("POST", "/deals", deal_data)
        if not success:
            self.log_result("Deals Create", False, f"Status: {status}, Response: {data}")
            return False
        
        deal_id = data.get("id")
        if not deal_id:
            self.log_result("Deals Create", False, "No deal ID returned")
            return False
        
        self.test_data["deal_id"] = deal_id
        self.log_result("Deals Create", True, f"Created deal: {deal_id}")
        
        # List deals
        success, data, status = await self.make_request("GET", "/deals")
        if success and isinstance(data, list):
            self.log_result("Deals List", True, f"Retrieved {len(data)} deals")
        else:
            self.log_result("Deals List", False, f"Status: {status}, Response: {data}")
            return False
        
        # Update deal stage
        update_data = {"stage": "Contacted", "value": 35000.00}
        success, data, status = await self.make_request("PUT", f"/deals/{deal_id}", update_data)
        if success and data.get("stage") == "Contacted":
            self.log_result("Deals Update Stage", True, f"Updated deal stage: {deal_id}")
        else:
            self.log_result("Deals Update Stage", False, f"Status: {status}, Response: {data}")
            return False
        
        return True
    
    async def test_tasks_crud(self):
        """Test tasks CRUD operations"""
        # Create task
        task_data = {
            "title": "Test Task",
            "description": "Test task for regression testing",
            "due_date": "2024-12-31",
            "contact_id": self.test_data.get("contact_id", ""),
            "deal_id": self.test_data.get("deal_id", ""),
            "priority": "high",
            "completed": False
        }
        
        success, data, status = await self.make_request("POST", "/tasks", task_data)
        if not success:
            self.log_result("Tasks Create", False, f"Status: {status}, Response: {data}")
            return False
        
        task_id = data.get("id")
        if not task_id:
            self.log_result("Tasks Create", False, "No task ID returned")
            return False
        
        self.test_data["task_id"] = task_id
        self.log_result("Tasks Create", True, f"Created task: {task_id}")
        
        # List tasks
        success, data, status = await self.make_request("GET", "/tasks")
        if success and isinstance(data, list):
            self.log_result("Tasks List", True, f"Retrieved {len(data)} tasks")
        else:
            self.log_result("Tasks List", False, f"Status: {status}, Response: {data}")
            return False
        
        # Update task
        update_data = {"completed": True, "priority": "medium"}
        success, data, status = await self.make_request("PUT", f"/tasks/{task_id}", update_data)
        if success and data.get("completed") == True:
            self.log_result("Tasks Update", True, f"Updated task: {task_id}")
        else:
            self.log_result("Tasks Update", False, f"Status: {status}, Response: {data}")
            return False
        
        return True
    
    async def test_activities_crud(self):
        """Test activities CRUD operations"""
        contact_id = self.test_data.get("contact_id")
        if not contact_id:
            self.log_result("Activities Create", False, "No contact ID available")
            return False
        
        # Create activity
        activity_data = {
            "contact_id": contact_id,
            "activity_type": "note",
            "description": "Test activity for regression testing",
            "deal_id": self.test_data.get("deal_id", "")
        }
        
        success, data, status = await self.make_request("POST", "/activities", activity_data)
        if not success:
            self.log_result("Activities Create", False, f"Status: {status}, Response: {data}")
            return False
        
        activity_id = data.get("id")
        if not activity_id:
            self.log_result("Activities Create", False, "No activity ID returned")
            return False
        
        self.test_data["activity_id"] = activity_id
        self.log_result("Activities Create", True, f"Created activity: {activity_id}")
        
        # List activities
        success, data, status = await self.make_request("GET", "/activities")
        if success and isinstance(data, list):
            self.log_result("Activities List", True, f"Retrieved {len(data)} activities")
        else:
            self.log_result("Activities List", False, f"Status: {status}, Response: {data}")
            return False
        
        return True
    
    async def test_templates_crud(self):
        """Test templates CRUD operations"""
        # Create template
        template_data = {
            "name": "Test Email Template",
            "category": "email",
            "subject": "Test Subject",
            "body": "Hello {contact_name}, this is a test email template.",
            "tags": ["test", "regression"]
        }
        
        success, data, status = await self.make_request("POST", "/templates", template_data)
        if not success:
            self.log_result("Templates Create", False, f"Status: {status}, Response: {data}")
            return False
        
        template_id = data.get("id")
        if not template_id:
            self.log_result("Templates Create", False, "No template ID returned")
            return False
        
        self.test_data["template_id"] = template_id
        self.log_result("Templates Create", True, f"Created template: {template_id}")
        
        # List templates
        success, data, status = await self.make_request("GET", "/templates")
        if success and isinstance(data, list):
            self.log_result("Templates List", True, f"Retrieved {len(data)} templates")
        else:
            self.log_result("Templates List", False, f"Status: {status}, Response: {data}")
            return False
        
        # Update template
        update_data = {
            "name": "Updated Test Template",
            "category": "email",
            "subject": "Updated Subject",
            "body": "Updated body content",
            "tags": ["updated", "test"]
        }
        success, data, status = await self.make_request("PUT", f"/templates/{template_id}", update_data)
        if success and data.get("name") == "Updated Test Template":
            self.log_result("Templates Update", True, f"Updated template: {template_id}")
        else:
            self.log_result("Templates Update", False, f"Status: {status}, Response: {data}")
            return False
        
        return True
    
    async def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, data, status = await self.make_request("GET", "/dashboard/stats")
        
        if success and isinstance(data, dict):
            required_fields = ["total_contacts", "total_deals", "total_properties", "open_tasks"]
            if all(field in data for field in required_fields):
                self.log_result("Dashboard Stats", True, f"Retrieved dashboard stats: {data}")
                return True
            else:
                self.log_result("Dashboard Stats", False, f"Missing required fields in response: {data}")
                return False
        else:
            self.log_result("Dashboard Stats", False, f"Status: {status}, Response: {data}")
            return False
    
    async def test_security_headers(self):
        """Test security headers are present"""
        try:
            async with self.session.get(f"{BASE_URL}/auth/me") as response:
                headers = response.headers
                
                security_headers = {
                    "X-Content-Type-Options": "nosniff",
                    "X-Frame-Options": "DENY",
                    "X-XSS-Protection": "1; mode=block",
                    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
                    "Referrer-Policy": "strict-origin-when-cross-origin",
                    "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
                }
                
                missing_headers = []
                for header, expected_value in security_headers.items():
                    if header not in headers:
                        missing_headers.append(header)
                    elif headers[header] != expected_value:
                        missing_headers.append(f"{header} (wrong value: {headers[header]})")
                
                if not missing_headers:
                    self.log_result("Security Headers", True, "All security headers present")
                    return True
                else:
                    self.log_result("Security Headers", False, f"Missing/incorrect headers: {missing_headers}")
                    return False
                    
        except Exception as e:
            self.log_result("Security Headers", False, f"Error: {e}")
            return False
    
    async def test_rate_limiting(self):
        """Test rate limiting on auth routes"""
        # Make multiple rapid requests to login endpoint
        login_data = {"email": "invalid@test.com", "password": "invalid"}
        rate_limited = False
        
        for i in range(12):  # Try 12 requests (limit is 10/min)
            success, data, status = await self.make_request(
                "POST", "/auth/login", login_data, expect_status=401
            )
            if status == 429:  # Rate limited
                rate_limited = True
                break
            await asyncio.sleep(0.1)  # Small delay between requests
        
        if rate_limited:
            self.log_result("Rate Limiting", True, "Rate limiting working on auth routes")
            return True
        else:
            self.log_result("Rate Limiting", False, "Rate limiting not triggered after 12 requests")
            return False
    
    async def test_input_validation(self):
        """Test input validation"""
        # Test invalid email format
        success, data, status = await self.make_request(
            "POST", "/contacts",
            {
                "name": "Test",
                "email": "invalid-email",
                "property_type": "residential_lease"
            },
            expect_status=422
        )
        
        if status == 422:
            self.log_result("Input Validation - Email", True, "Invalid email rejected")
        else:
            self.log_result("Input Validation - Email", False, f"Invalid email accepted, status: {status}")
            return False
        
        # Test property_type length limit (should be max 50 chars)
        long_property_type = "x" * 151  # 151 characters
        success, data, status = await self.make_request(
            "POST", "/contacts",
            {
                "name": "Test",
                "email": "test@example.com",
                "property_type": long_property_type
            },
            expect_status=422
        )
        
        if status == 422:
            self.log_result("Input Validation - Length", True, "Long property_type rejected")
            return True
        else:
            self.log_result("Input Validation - Length", False, f"Long property_type accepted, status: {status}")
            return False
    
    async def test_error_responses(self):
        """Test that error responses don't contain stack traces"""
        # Try to access non-existent contact
        success, data, status = await self.make_request(
            "GET", "/contacts/invalid_id", expect_status=404
        )
        
        if status == 404:
            # Check if response contains stack trace indicators
            response_str = str(data).lower()
            stack_trace_indicators = ["traceback", "file \"", "line ", "in ", "raise", "exception"]
            
            has_stack_trace = any(indicator in response_str for indicator in stack_trace_indicators)
            
            if not has_stack_trace:
                self.log_result("Error Response Security", True, "No stack traces in error responses")
                return True
            else:
                self.log_result("Error Response Security", False, f"Stack trace found in error: {data}")
                return False
        else:
            self.log_result("Error Response Security", False, f"Unexpected status: {status}")
            return False
    
    async def cleanup_test_data(self):
        """Clean up test data"""
        cleanup_results = []
        
        # Delete in reverse order of creation to handle dependencies
        cleanup_order = [
            ("template_id", "/templates"),
            ("activity_id", "/activities"),
            ("task_id", "/tasks"),
            ("deal_id", "/deals"),
            ("property_id", "/properties"),
            ("contact_id", "/contacts")
        ]
        
        for key, endpoint in cleanup_order:
            if key in self.test_data:
                item_id = self.test_data[key]
                success, data, status = await self.make_request(
                    "DELETE", f"{endpoint}/{item_id}", expect_status=200
                )
                cleanup_results.append(f"{key}: {'✅' if success else '❌'}")
        
        if cleanup_results:
            self.log_result("Cleanup", True, f"Cleanup results: {', '.join(cleanup_results)}")
    
    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print("\n" + "="*80)
        print("PROPFLOW CRM BACKEND REGRESSION TEST SUMMARY")
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
    """Run all tests"""
    print("Starting PropFlow CRM Backend Regression Tests...")
    print(f"Testing against: {BASE_URL}")
    print("="*80)
    
    async with PropFlowTester() as tester:
        # Authentication tests
        if not await tester.test_auth_login():
            print("❌ Login failed - cannot continue with other tests")
            return False
        
        await tester.test_auth_me()
        await tester.test_auth_register()
        await tester.test_auth_refresh()
        
        # Core CRUD tests
        await tester.test_contacts_crud()
        await tester.test_contacts_import_export()
        await tester.test_properties_crud()
        await tester.test_deals_crud()
        await tester.test_tasks_crud()
        await tester.test_activities_crud()
        await tester.test_templates_crud()
        
        # Dashboard and stats
        await tester.test_dashboard_stats()
        
        # Security tests
        await tester.test_security_headers()
        await tester.test_rate_limiting()
        await tester.test_input_validation()
        await tester.test_error_responses()
        
        # Logout test
        await tester.test_auth_logout()
        
        # Re-login for cleanup
        await tester.test_auth_login()
        await tester.cleanup_test_data()
        
        # Print summary
        success = tester.print_summary()
        return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)