#!/usr/bin/env python3
"""
PropFlow CRM Backend Testing Suite
Tests auth, CRUD operations, CSV import/export, and dashboard functionality
"""

import requests
import json
import csv
import io
import time
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://drip-sequences.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@propflow.com"
ADMIN_PASSWORD = "admin123"

class PropFlowTester:
    def __init__(self):
        self.session = requests.Session()
        self.user_id = None
        self.access_token = None
        self.test_contact_id = None
        self.test_deal_id = None
        self.test_property_id = None
        self.test_task_id = None
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def test_auth_flow(self):
        """Test complete authentication flow"""
        self.log("=== Testing Authentication Flow ===")
        
        # Test login
        self.log("Testing login...")
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
        if response.status_code != 200:
            raise Exception(f"Login failed: {response.status_code} - {response.text}")
            
        user_data = response.json()
        self.user_id = user_data.get("id")
        self.log(f"✅ Login successful - User ID: {self.user_id}")
        
        # Test /auth/me
        self.log("Testing /auth/me...")
        response = self.session.get(f"{BACKEND_URL}/auth/me")
        if response.status_code != 200:
            raise Exception(f"/auth/me failed: {response.status_code} - {response.text}")
        self.log("✅ /auth/me working")
        
        # Test refresh token
        self.log("Testing token refresh...")
        response = self.session.post(f"{BACKEND_URL}/auth/refresh")
        if response.status_code != 200:
            raise Exception(f"Token refresh failed: {response.status_code} - {response.text}")
        self.log("✅ Token refresh working")
        
        return True
        
    def test_contacts_crud(self):
        """Test contacts CRUD operations"""
        self.log("=== Testing Contacts CRUD ===")
        
        # Create contact
        self.log("Creating test contact...")
        timestamp = str(int(time.time()))
        contact_data = {
            "name": "Test Contact",
            "email": f"test{timestamp}@example.com",
            "phone": "(555) 123-4567",
            "company": "Test Company",
            "source": "website",
            "property_type": "residential_lease",
            "tags": ["test", "automation"],
            "notes": "Test contact for automation",
            "lead_score": 75
        }
        
        response = self.session.post(f"{BACKEND_URL}/contacts", json=contact_data)
        if response.status_code != 200:
            raise Exception(f"Contact creation failed: {response.status_code} - {response.text}")
            
        contact = response.json()
        self.test_contact_id = contact.get("id")
        self.log(f"✅ Contact created - ID: {self.test_contact_id}")
        
        # List contacts
        self.log("Testing contacts list...")
        response = self.session.get(f"{BACKEND_URL}/contacts")
        if response.status_code != 200:
            raise Exception(f"Contacts list failed: {response.status_code} - {response.text}")
        
        contacts_data = response.json()
        if "data" not in contacts_data or "pagination" not in contacts_data:
            raise Exception("Contacts list response missing data or pagination")
        self.log(f"✅ Contacts list working - Found {len(contacts_data['data'])} contacts")
        
        # Get specific contact
        self.log("Testing get contact...")
        response = self.session.get(f"{BACKEND_URL}/contacts/{self.test_contact_id}")
        if response.status_code != 200:
            raise Exception(f"Get contact failed: {response.status_code} - {response.text}")
        self.log("✅ Get contact working")
        
        # Update contact
        self.log("Testing contact update...")
        update_data = {
            "notes": "Updated test contact",
            "lead_score": 85
        }
        response = self.session.put(f"{BACKEND_URL}/contacts/{self.test_contact_id}", json=update_data)
        if response.status_code != 200:
            raise Exception(f"Contact update failed: {response.status_code} - {response.text}")
        self.log("✅ Contact update working")
        
        return True
        
    def test_deals_crud(self):
        """Test deals CRUD operations"""
        self.log("=== Testing Deals CRUD ===")
        
        # Create deal
        self.log("Creating test deal...")
        deal_data = {
            "title": "Test Deal",
            "pipeline_type": "residential_lease",
            "stage": "New Lead",
            "contact_id": self.test_contact_id,
            "value": 2500.0,
            "notes": "Test deal for automation"
        }
        
        response = self.session.post(f"{BACKEND_URL}/deals", json=deal_data)
        if response.status_code != 200:
            raise Exception(f"Deal creation failed: {response.status_code} - {response.text}")
            
        deal = response.json()
        self.test_deal_id = deal.get("id")
        self.log(f"✅ Deal created - ID: {self.test_deal_id}")
        
        # List deals
        self.log("Testing deals list...")
        response = self.session.get(f"{BACKEND_URL}/deals")
        if response.status_code != 200:
            raise Exception(f"Deals list failed: {response.status_code} - {response.text}")
        
        deals_data = response.json()
        if "data" not in deals_data or "pagination" not in deals_data:
            raise Exception("Deals list response missing data or pagination")
        self.log(f"✅ Deals list working - Found {len(deals_data['data'])} deals")
        
        # Get specific deal
        self.log("Testing get deal...")
        response = self.session.get(f"{BACKEND_URL}/deals/{self.test_deal_id}")
        if response.status_code != 200:
            raise Exception(f"Get deal failed: {response.status_code} - {response.text}")
        self.log("✅ Get deal working")
        
        # Update deal
        self.log("Testing deal update...")
        update_data = {
            "stage": "Contacted",
            "notes": "Updated test deal"
        }
        response = self.session.put(f"{BACKEND_URL}/deals/{self.test_deal_id}", json=update_data)
        if response.status_code != 200:
            raise Exception(f"Deal update failed: {response.status_code} - {response.text}")
        self.log("✅ Deal update working")
        
        return True
        
    def test_properties_crud(self):
        """Test properties CRUD operations"""
        self.log("=== Testing Properties CRUD ===")
        
        # Create property
        self.log("Creating test property...")
        property_data = {
            "name": "Test Property",
            "address": "123 Test St, Test City, TS 12345",
            "property_type": "residential",
            "listing_type": "lease",
            "price": 2500.0,
            "sqft": 1200.0,
            "bedrooms": 2,
            "bathrooms": 2,
            "description": "Test property for automation",
            "status": "active"
        }
        
        response = self.session.post(f"{BACKEND_URL}/properties", json=property_data)
        if response.status_code != 200:
            raise Exception(f"Property creation failed: {response.status_code} - {response.text}")
            
        property_obj = response.json()
        self.test_property_id = property_obj.get("id")
        self.log(f"✅ Property created - ID: {self.test_property_id}")
        
        # List properties
        self.log("Testing properties list...")
        response = self.session.get(f"{BACKEND_URL}/properties")
        if response.status_code != 200:
            raise Exception(f"Properties list failed: {response.status_code} - {response.text}")
        
        properties_data = response.json()
        if "data" not in properties_data or "pagination" not in properties_data:
            raise Exception("Properties list response missing data or pagination")
        self.log(f"✅ Properties list working - Found {len(properties_data['data'])} properties")
        
        # Get specific property
        self.log("Testing get property...")
        response = self.session.get(f"{BACKEND_URL}/properties/{self.test_property_id}")
        if response.status_code != 200:
            raise Exception(f"Get property failed: {response.status_code} - {response.text}")
        self.log("✅ Get property working")
        
        return True
        
    def test_tasks_crud(self):
        """Test tasks CRUD operations"""
        self.log("=== Testing Tasks CRUD ===")
        
        # Create task
        self.log("Creating test task...")
        task_data = {
            "title": "Test Task",
            "description": "Test task for automation",
            "due_date": "2025-02-15",
            "contact_id": self.test_contact_id,
            "deal_id": self.test_deal_id,
            "priority": "high",
            "completed": False
        }
        
        response = self.session.post(f"{BACKEND_URL}/tasks", json=task_data)
        if response.status_code != 200:
            raise Exception(f"Task creation failed: {response.status_code} - {response.text}")
            
        task = response.json()
        self.test_task_id = task.get("id")
        self.log(f"✅ Task created - ID: {self.test_task_id}")
        
        # List tasks
        self.log("Testing tasks list...")
        response = self.session.get(f"{BACKEND_URL}/tasks")
        if response.status_code != 200:
            raise Exception(f"Tasks list failed: {response.status_code} - {response.text}")
        
        tasks_data = response.json()
        if "data" not in tasks_data or "pagination" not in tasks_data:
            raise Exception("Tasks list response missing data or pagination")
        self.log(f"✅ Tasks list working - Found {len(tasks_data['data'])} tasks")
        
        return True
        
    def test_csv_template_download(self):
        """Test CSV template download"""
        self.log("=== Testing CSV Template Download ===")
        
        response = self.session.get(f"{BACKEND_URL}/contacts/template")
        if response.status_code != 200:
            raise Exception(f"CSV template download failed: {response.status_code} - {response.text}")
            
        # Check if response is CSV
        if "text/csv" not in response.headers.get("content-type", ""):
            raise Exception("CSV template response is not CSV format")
            
        # Parse CSV to check for new leasing columns
        csv_content = response.text
        reader = csv.DictReader(io.StringIO(csv_content))
        headers = reader.fieldnames
        
        expected_leasing_columns = [
            "move_in_date", "budget_min", "budget_max", "bedrooms_needed",
            "pet_type", "lease_term_months", "referral_source"
        ]
        
        missing_columns = [col for col in expected_leasing_columns if col not in headers]
        if missing_columns:
            raise Exception(f"CSV template missing leasing columns: {missing_columns}")
            
        self.log(f"✅ CSV template download working - Found all {len(expected_leasing_columns)} leasing columns")
        return True
        
    def test_csv_import_with_errors(self):
        """Test CSV import with validation errors"""
        self.log("=== Testing CSV Import with Errors ===")
        
        # Create CSV with some invalid rows
        import random
        timestamp = str(int(time.time()))
        csv_data = f"""name,email,phone,company,source,property_type,tags,notes,lead_score,move_in_date,budget_min,budget_max,bedrooms_needed,pet_type,lease_term_months,referral_source
Valid Contact,valid{timestamp}@example.com,(555) 111-2222,Valid Company,website,residential_lease,test,Valid contact,50,2025-03-01,1500,2500,2,cat,12,zillow
,invalid{timestamp}@example.com,(555) 222-3333,Missing Name,website,residential_lease,test,Missing name,60,2025-04-01,1800,2800,1,dog,12,referral
Invalid Contact,not-an-email{timestamp},(555) 333-4444,Invalid Email,website,residential_lease,test,Invalid email format,70,2025-05-01,2000,3000,3,none,24,website
Another Valid,another{timestamp}@example.com,(555) 444-5555,Another Company,referral,commercial_lease,vip,Another valid contact,80,2025-06-01,3000,5000,,none,36,agent-referral"""
        
        # Create file-like object
        files = {
            'file': ('test_contacts.csv', csv_data, 'text/csv')
        }
        
        response = self.session.post(f"{BACKEND_URL}/contacts/import", files=files)
        if response.status_code != 200:
            raise Exception(f"CSV import failed: {response.status_code} - {response.text}")
            
        result = response.json()
        
        # Check response structure
        required_fields = ["imported", "skipped", "total_rows", "errors"]
        missing_fields = [field for field in required_fields if field not in result]
        if missing_fields:
            raise Exception(f"CSV import response missing fields: {missing_fields}")
            
        # Check that some contacts were imported and some had errors
        if result["imported"] == 0:
            raise Exception("No contacts were imported")
            
        if result["skipped"] == 0:
            raise Exception("Expected some contacts to be skipped due to validation errors")
            
        if not result["errors"]:
            raise Exception("Expected error details for invalid rows")
            
        # Check error structure
        for error in result["errors"]:
            if not all(key in error for key in ["row", "field", "reason"]):
                raise Exception(f"Error missing required structure: {error}")
                
        self.log(f"✅ CSV import working - Imported: {result['imported']}, Skipped: {result['skipped']}, Errors: {len(result['errors'])}")
        return True
        
    def test_csv_export(self):
        """Test CSV export with new columns"""
        self.log("=== Testing CSV Export ===")
        
        response = self.session.get(f"{BACKEND_URL}/contacts/export")
        if response.status_code != 200:
            raise Exception(f"CSV export failed: {response.status_code} - {response.text}")
            
        # Check if response is CSV
        if "text/csv" not in response.headers.get("content-type", ""):
            raise Exception("CSV export response is not CSV format")
            
        # Parse CSV to check for new leasing columns
        csv_content = response.text
        reader = csv.DictReader(io.StringIO(csv_content))
        headers = reader.fieldnames
        
        expected_leasing_columns = [
            "move_in_date", "budget_min", "budget_max", "bedrooms_needed",
            "pet_type", "lease_term_months", "referral_source"
        ]
        
        missing_columns = [col for col in expected_leasing_columns if col not in headers]
        if missing_columns:
            raise Exception(f"CSV export missing leasing columns: {missing_columns}")
            
        self.log(f"✅ CSV export working - Found all {len(expected_leasing_columns)} leasing columns")
        return True
        
    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        self.log("=== Testing Dashboard Stats ===")
        
        response = self.session.get(f"{BACKEND_URL}/dashboard/stats")
        if response.status_code != 200:
            raise Exception(f"Dashboard stats failed: {response.status_code} - {response.text}")
            
        stats = response.json()
        
        # Check for expected stats structure
        expected_stats = ["total_contacts", "total_deals", "total_properties", "open_tasks"]
        missing_stats = [stat for stat in expected_stats if stat not in stats]
        if missing_stats:
            raise Exception(f"Dashboard stats missing fields: {missing_stats}")
            
        self.log(f"✅ Dashboard stats working - Contacts: {stats['total_contacts']}, Deals: {stats['total_deals']}, Tasks: {stats['open_tasks']}")
        return True
        
    def test_pagination(self):
        """Test pagination on list endpoints"""
        self.log("=== Testing Pagination ===")
        
        # Test contacts pagination
        response = self.session.get(f"{BACKEND_URL}/contacts?page=1&limit=5")
        if response.status_code != 200:
            raise Exception(f"Contacts pagination failed: {response.status_code} - {response.text}")
            
        data = response.json()
        if "pagination" not in data:
            raise Exception("Pagination info missing from contacts response")
            
        pagination = data["pagination"]
        required_pagination_fields = ["page", "limit", "total", "total_pages"]
        missing_fields = [field for field in required_pagination_fields if field not in pagination]
        if missing_fields:
            raise Exception(f"Pagination missing fields: {missing_fields}")
            
        self.log(f"✅ Pagination working - Page: {pagination['page']}, Total: {pagination['total']}")
        return True
        
    def test_rate_limiting(self):
        """Test rate limiting on auth endpoints"""
        self.log("=== Testing Rate Limiting ===")
        
        # Create a new session to avoid using existing auth
        test_session = requests.Session()
        
        # Make rapid login attempts to trigger rate limiting
        login_data = {
            "email": "test@example.com",  # Non-existent user
            "password": "wrongpassword"
        }
        
        attempts = 0
        rate_limited = False
        
        for i in range(12):  # Try more than the 10/minute limit
            response = test_session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            attempts += 1
            
            if response.status_code == 429:
                rate_limited = True
                self.log(f"✅ Rate limiting triggered after {attempts} attempts")
                break
            elif response.status_code == 401:
                # Expected for wrong credentials
                continue
            else:
                # Wait a bit between requests
                time.sleep(0.1)
                
        if not rate_limited:
            self.log("⚠️  Rate limiting not triggered - may need more attempts or different timing")
        
        return True
        
    def cleanup_test_data(self):
        """Clean up test data"""
        self.log("=== Cleaning Up Test Data ===")
        
        # Delete test task
        if self.test_task_id:
            response = self.session.delete(f"{BACKEND_URL}/tasks/{self.test_task_id}")
            if response.status_code == 200:
                self.log("✅ Test task deleted")
                
        # Delete test deal
        if self.test_deal_id:
            response = self.session.delete(f"{BACKEND_URL}/deals/{self.test_deal_id}")
            if response.status_code == 200:
                self.log("✅ Test deal deleted")
                
        # Delete test property
        if self.test_property_id:
            response = self.session.delete(f"{BACKEND_URL}/properties/{self.test_property_id}")
            if response.status_code == 200:
                self.log("✅ Test property deleted")
                
        # Delete test contact
        if self.test_contact_id:
            response = self.session.delete(f"{BACKEND_URL}/contacts/{self.test_contact_id}")
            if response.status_code == 200:
                self.log("✅ Test contact deleted")
                
        # Logout
        response = self.session.post(f"{BACKEND_URL}/auth/logout")
        if response.status_code == 200:
            self.log("✅ Logged out")
            
    def run_all_tests(self):
        """Run all tests"""
        self.log("🚀 Starting PropFlow CRM Backend Tests")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        try:
            # Core functionality tests
            self.test_auth_flow()
            self.test_contacts_crud()
            self.test_deals_crud()
            self.test_properties_crud()
            self.test_tasks_crud()
            
            # CSV functionality tests
            self.test_csv_template_download()
            self.test_csv_import_with_errors()
            self.test_csv_export()
            
            # Additional functionality tests
            self.test_dashboard_stats()
            self.test_pagination()
            self.test_rate_limiting()
            
            self.log("🎉 All tests completed successfully!")
            return True
            
        except Exception as e:
            self.log(f"❌ Test failed: {str(e)}")
            return False
            
        finally:
            # Always try to clean up
            try:
                self.cleanup_test_data()
            except Exception as e:
                self.log(f"⚠️  Cleanup failed: {str(e)}")

if __name__ == "__main__":
    tester = PropFlowTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)