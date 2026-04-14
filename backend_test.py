import requests
import sys
import json
from datetime import datetime

class PropFlowAPITester:
    def __init__(self, base_url="https://prop-flow.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.user_data = None
        self.contact_id = None
        self.property_id = None
        self.deal_id = None
        self.task_id = None
        self.api_key = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = self.session.headers.copy()
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@propflow.com", "password": "admin123"}
        )
        if success:
            self.user_data = response
            print(f"   Logged in as: {response.get('name')} ({response.get('role')})")
        return success

    def test_auth_me(self):
        """Test getting current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        if success:
            print(f"   Stats: {response.get('total_contacts', 0)} contacts, {response.get('total_deals', 0)} deals")
        return success

    def test_create_contact(self):
        """Test creating a contact"""
        contact_data = {
            "name": "Test Contact",
            "email": "test@example.com",
            "phone": "555-0123",
            "company": "Test Company",
            "property_type": "residential_lease",
            "notes": "Test contact for API testing"
        }
        success, response = self.run_test(
            "Create Contact",
            "POST",
            "contacts",
            200,
            data=contact_data
        )
        if success:
            self.contact_id = response.get('id')
            print(f"   Created contact ID: {self.contact_id}")
        return success

    def test_list_contacts(self):
        """Test listing contacts"""
        success, response = self.run_test(
            "List Contacts",
            "GET",
            "contacts",
            200
        )
        if success:
            print(f"   Found {len(response)} contacts")
        return success

    def test_get_contact(self):
        """Test getting a specific contact"""
        if not self.contact_id:
            print("❌ Skipped - No contact ID available")
            return False
        
        success, response = self.run_test(
            "Get Contact",
            "GET",
            f"contacts/{self.contact_id}",
            200
        )
        return success

    def test_create_property(self):
        """Test creating a property"""
        property_data = {
            "name": "Test Property",
            "address": "123 Test St, Test City, TC 12345",
            "property_type": "residential",
            "listing_type": "lease",
            "price": 2500.0,
            "sqft": 1200.0,
            "bedrooms": 2,
            "bathrooms": 2,
            "description": "Test property for API testing"
        }
        success, response = self.run_test(
            "Create Property",
            "POST",
            "properties",
            200,
            data=property_data
        )
        if success:
            self.property_id = response.get('id')
            print(f"   Created property ID: {self.property_id}")
        return success

    def test_list_properties(self):
        """Test listing properties"""
        success, response = self.run_test(
            "List Properties",
            "GET",
            "properties",
            200
        )
        if success:
            print(f"   Found {len(response)} properties")
        return success

    def test_pipeline_stages(self):
        """Test getting pipeline stages"""
        success, response = self.run_test(
            "Get Pipeline Stages",
            "GET",
            "pipelines/stages",
            200
        )
        if success:
            print(f"   Pipeline types: {list(response.keys())}")
        return success

    def test_create_deal(self):
        """Test creating a deal"""
        deal_data = {
            "title": "Test Deal",
            "pipeline_type": "residential_lease",
            "stage": "New Lead",
            "contact_id": self.contact_id or "",
            "property_id": self.property_id or "",
            "value": 30000.0,
            "notes": "Test deal for API testing"
        }
        success, response = self.run_test(
            "Create Deal",
            "POST",
            "deals",
            200,
            data=deal_data
        )
        if success:
            self.deal_id = response.get('id')
            print(f"   Created deal ID: {self.deal_id}")
        return success

    def test_list_deals(self):
        """Test listing deals"""
        success, response = self.run_test(
            "List Deals",
            "GET",
            "deals",
            200
        )
        if success:
            print(f"   Found {len(response)} deals")
        return success

    def test_create_task(self):
        """Test creating a task"""
        task_data = {
            "title": "Test Task",
            "description": "Test task for API testing",
            "due_date": "2024-12-31",
            "contact_id": self.contact_id or "",
            "deal_id": self.deal_id or "",
            "priority": "high",
            "completed": False
        }
        success, response = self.run_test(
            "Create Task",
            "POST",
            "tasks",
            200,
            data=task_data
        )
        if success:
            self.task_id = response.get('id')
            print(f"   Created task ID: {self.task_id}")
        return success

    def test_list_tasks(self):
        """Test listing tasks"""
        success, response = self.run_test(
            "List Tasks",
            "GET",
            "tasks",
            200
        )
        if success:
            print(f"   Found {len(response)} tasks")
        return success

    def test_update_task(self):
        """Test updating a task"""
        if not self.task_id:
            print("❌ Skipped - No task ID available")
            return False
        
        update_data = {"completed": True}
        success, response = self.run_test(
            "Update Task (Mark Complete)",
            "PUT",
            f"tasks/{self.task_id}",
            200,
            data=update_data
        )
        return success

    def test_create_activity(self):
        """Test creating an activity"""
        if not self.contact_id:
            print("❌ Skipped - No contact ID available")
            return False
        
        activity_data = {
            "contact_id": self.contact_id,
            "activity_type": "note",
            "description": "Test activity for API testing",
            "deal_id": self.deal_id or ""
        }
        success, response = self.run_test(
            "Create Activity",
            "POST",
            "activities",
            200,
            data=activity_data
        )
        return success

    def test_list_activities(self):
        """Test listing activities"""
        success, response = self.run_test(
            "List Activities",
            "GET",
            "activities",
            200
        )
        if success:
            print(f"   Found {len(response)} activities")
        return success

    def test_create_api_key(self):
        """Test creating an API key"""
        api_key_data = {"name": "Test API Key"}
        success, response = self.run_test(
            "Create API Key",
            "POST",
            "api-keys",
            200,
            data=api_key_data
        )
        if success:
            self.api_key = response.get('key')
            print(f"   Created API key: {self.api_key[:12]}...")
        return success

    def test_list_api_keys(self):
        """Test listing API keys"""
        success, response = self.run_test(
            "List API Keys",
            "GET",
            "api-keys",
            200
        )
        if success:
            print(f"   Found {len(response)} API keys")
        return success

    def test_api_key_auth(self):
        """Test API key authentication"""
        if not self.api_key:
            print("❌ Skipped - No API key available")
            return False
        
        # Test using API key instead of cookies
        success, response = self.run_test(
            "API Key Auth - Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            headers={"X-API-Key": self.api_key}
        )
        return success

    def test_ai_lead_score(self):
        """Test AI lead scoring"""
        if not self.contact_id:
            print("❌ Skipped - No contact ID available")
            return False
        
        ai_data = {"contact_id": self.contact_id}
        success, response = self.run_test(
            "AI Lead Score",
            "POST",
            "ai/lead-score",
            200,
            data=ai_data
        )
        if success:
            print(f"   Lead score: {response.get('score', 'N/A')}")
        return success

    def test_ai_draft_email(self):
        """Test AI email drafting"""
        if not self.contact_id:
            print("❌ Skipped - No contact ID available")
            return False
        
        ai_data = {
            "contact_id": self.contact_id,
            "context": "Follow up on property viewing",
            "tone": "professional"
        }
        success, response = self.run_test(
            "AI Draft Email",
            "POST",
            "ai/draft-email",
            200,
            data=ai_data
        )
        if success:
            draft = response.get('draft', '')
            print(f"   Email draft length: {len(draft)} characters")
        return success

    def test_logout(self):
        """Test logout"""
        success, response = self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )
        return success

def main():
    print("🚀 Starting PropFlow CRM API Tests")
    print("=" * 50)
    
    tester = PropFlowAPITester()
    
    # Authentication Tests
    if not tester.test_admin_login():
        print("❌ Admin login failed, stopping tests")
        return 1
    
    tester.test_auth_me()
    
    # Core Feature Tests
    tester.test_dashboard_stats()
    
    # Contact Management
    tester.test_create_contact()
    tester.test_list_contacts()
    tester.test_get_contact()
    
    # Property Management
    tester.test_create_property()
    tester.test_list_properties()
    
    # Pipeline Management
    tester.test_pipeline_stages()
    tester.test_create_deal()
    tester.test_list_deals()
    
    # Task Management
    tester.test_create_task()
    tester.test_list_tasks()
    tester.test_update_task()
    
    # Activity Management
    tester.test_create_activity()
    tester.test_list_activities()
    
    # API Key Management
    tester.test_create_api_key()
    tester.test_list_api_keys()
    tester.test_api_key_auth()
    
    # AI Features (may take longer)
    print("\n🤖 Testing AI Features (may take a few seconds)...")
    tester.test_ai_lead_score()
    tester.test_ai_draft_email()
    
    # Cleanup
    tester.test_logout()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())