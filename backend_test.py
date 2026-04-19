#!/usr/bin/env python3
"""
Phase 9 Contact Profile Page Backend Testing
Tests all NEW endpoints for PropFlow CRM contact profile functionality.
"""

import requests
import json
import sys
import time
from datetime import datetime, timezone

# Configuration
BASE_URL = "https://propflow-crm-2.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@propflow.com"
ADMIN_PASSWORD = "admin123"

class TestRunner:
    def __init__(self):
        self.session = requests.Session()
        self.contact_id = None
        self.team_member_id = None
        self.test_results = []
        
    def log_result(self, test_name, status, details=""):
        """Log test result"""
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "status": status,
            "details": details
        })
    
    def login_admin(self):
        """Login as admin and setup session"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            if response.status_code == 200:
                self.log_result("Admin Login", "PASS")
                return True
            else:
                self.log_result("Admin Login", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Admin Login", "FAIL", f"Exception: {str(e)}")
            return False
    
    def setup_test_data(self):
        """Create test contact and get team member ID"""
        try:
            # Create test contact with unique email
            timestamp = int(time.time())
            contact_data = {
                "name": "Sarah Test Tenant",
                "email": f"sarah.test.{timestamp}@example.com",
                "phone": "+15551234567",
                "tags": ["test"]
            }
            response = self.session.post(f"{BASE_URL}/contacts", json=contact_data)
            if response.status_code in [200, 201]:
                contact_data = response.json()
                self.contact_id = contact_data.get("id") or contact_data.get("_id")
                if self.contact_id:
                    self.log_result("Create Test Contact", "PASS", f"Contact ID: {self.contact_id}")
                else:
                    self.log_result("Create Test Contact", "FAIL", f"No ID in response: {contact_data}")
                    return False
            else:
                self.log_result("Create Test Contact", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
            
            # Get team member ID
            response = self.session.get(f"{BASE_URL}/team/members")
            if response.status_code == 200:
                data = response.json()
                members = data.get("data", [])
                if members:
                    self.team_member_id = members[0]["id"]
                    self.log_result("Get Team Member", "PASS", f"Member ID: {self.team_member_id}")
                else:
                    self.log_result("Get Team Member", "FAIL", "No team members found")
                    return False
            else:
                self.log_result("Get Team Member", "FAIL", f"Status: {response.status_code}")
                return False
            
            return True
        except Exception as e:
            self.log_result("Setup Test Data", "FAIL", f"Exception: {str(e)}")
            return False
    
    def test_client_types(self):
        """Test 1: GET /api/client-types"""
        try:
            response = self.session.get(f"{BASE_URL}/client-types")
            if response.status_code == 200:
                data = response.json()
                if "types" in data and "stages" in data:
                    types = data["types"]
                    stages = data["stages"]
                    
                    # Check we have 5 types
                    if len(types) == 5:
                        # Check stage counts
                        expected_counts = {
                            "leasing_tenant": 13,
                            "sales_buyer": 10,
                            "sales_seller": 9,
                            "commercial": 8,
                            "other": 6
                        }
                        
                        all_counts_correct = True
                        for stage_type, expected_count in expected_counts.items():
                            if stage_type in stages and len(stages[stage_type]) == expected_count:
                                continue
                            else:
                                all_counts_correct = False
                                break
                        
                        if all_counts_correct:
                            self.log_result("Test 1: GET /api/client-types", "PASS")
                        else:
                            self.log_result("Test 1: GET /api/client-types", "FAIL", "Stage counts don't match expected")
                    else:
                        self.log_result("Test 1: GET /api/client-types", "FAIL", f"Expected 5 types, got {len(types)}")
                else:
                    self.log_result("Test 1: GET /api/client-types", "FAIL", "Missing 'types' or 'stages' in response")
            else:
                self.log_result("Test 1: GET /api/client-types", "FAIL", f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 1: GET /api/client-types", "FAIL", f"Exception: {str(e)}")
    
    def test_contact_photo(self):
        """Test 2: Contact photo upload/delete"""
        try:
            # Test photo upload
            photo_data = {
                "photo_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            }
            response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/photo", json=photo_data)
            if response.status_code == 200:
                # Verify photo is in contact
                response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}")
                if response.status_code == 200:
                    contact = response.json()
                    if "photo_url" in contact:
                        # Test photo deletion
                        response = self.session.delete(f"{BASE_URL}/contacts/{self.contact_id}/photo")
                        if response.status_code == 200:
                            # Verify photo is removed
                            response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}")
                            if response.status_code == 200:
                                contact = response.json()
                                if "photo_url" not in contact or not contact.get("photo_url"):
                                    # Test invalid photo URL rejection
                                    invalid_data = {"photo_url": "ftp://bad"}
                                    response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/photo", json=invalid_data)
                                    if response.status_code == 422:
                                        self.log_result("Test 2: Contact Photo", "PASS")
                                    else:
                                        self.log_result("Test 2: Contact Photo", "FAIL", f"Invalid URL not rejected, status: {response.status_code}")
                                else:
                                    self.log_result("Test 2: Contact Photo", "FAIL", "Photo not removed after delete")
                            else:
                                self.log_result("Test 2: Contact Photo", "FAIL", "Failed to get contact after delete")
                        else:
                            self.log_result("Test 2: Contact Photo", "FAIL", f"Delete failed, status: {response.status_code}")
                    else:
                        self.log_result("Test 2: Contact Photo", "FAIL", "Photo not found in contact after upload")
                else:
                    self.log_result("Test 2: Contact Photo", "FAIL", "Failed to get contact after upload")
            else:
                self.log_result("Test 2: Contact Photo", "FAIL", f"Upload failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 2: Contact Photo", "FAIL", f"Exception: {str(e)}")
    
    def test_contact_stage(self):
        """Test 3: Contact stage update"""
        try:
            # Test valid stage update
            stage_data = {
                "leasing_stage": "Tour Scheduled",
                "client_type": "leasing_tenant"
            }
            response = self.session.put(f"{BASE_URL}/contacts/{self.contact_id}/stage", json=stage_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("leasing_stage") == "Tour Scheduled" and "stage_updated_at" in data:
                    # Verify in contact
                    response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}")
                    if response.status_code == 200:
                        contact = response.json()
                        if contact.get("leasing_stage") == "Tour Scheduled":
                            # Test invalid stage
                            invalid_stage_data = {
                                "leasing_stage": "Bogus Stage",
                                "client_type": "leasing_tenant"
                            }
                            response = self.session.put(f"{BASE_URL}/contacts/{self.contact_id}/stage", json=invalid_stage_data)
                            if response.status_code == 400:
                                # Test switching client type
                                switch_data = {
                                    "leasing_stage": "Pre-Approved",
                                    "client_type": "sales_buyer"
                                }
                                response = self.session.put(f"{BASE_URL}/contacts/{self.contact_id}/stage", json=switch_data)
                                if response.status_code == 200:
                                    # Check activity was logged
                                    response = self.session.get(f"{BASE_URL}/activities?contact_id={self.contact_id}")
                                    if response.status_code == 200:
                                        data = response.json()
                                        activities = data.get("data", [])
                                        stage_activity = any("Stage changed" in act.get("description", "") for act in activities)
                                        if stage_activity:
                                            self.log_result("Test 3: Contact Stage", "PASS")
                                        else:
                                            self.log_result("Test 3: Contact Stage", "FAIL", "Stage change activity not logged")
                                    else:
                                        self.log_result("Test 3: Contact Stage", "FAIL", "Failed to get activities")
                                else:
                                    self.log_result("Test 3: Contact Stage", "FAIL", f"Client type switch failed, status: {response.status_code}")
                            else:
                                self.log_result("Test 3: Contact Stage", "FAIL", f"Invalid stage not rejected, status: {response.status_code}")
                        else:
                            self.log_result("Test 3: Contact Stage", "FAIL", "Stage not updated in contact")
                    else:
                        self.log_result("Test 3: Contact Stage", "FAIL", "Failed to get contact after stage update")
                else:
                    self.log_result("Test 3: Contact Stage", "FAIL", "Invalid response data")
            else:
                self.log_result("Test 3: Contact Stage", "FAIL", f"Stage update failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 3: Contact Stage", "FAIL", f"Exception: {str(e)}")
    
    def test_contact_tags(self):
        """Test 4: Contact tags"""
        try:
            # Add tag
            tag_data = {"tag": "VIP"}
            response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/tags", json=tag_data)
            if response.status_code == 200:
                data = response.json()
                if "VIP" in data.get("tags", []):
                    # Add same tag again (should be idempotent)
                    response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/tags", json=tag_data)
                    if response.status_code == 200:
                        data = response.json()
                        vip_count = data.get("tags", []).count("VIP")
                        if vip_count == 1:
                            # Remove tag
                            response = self.session.delete(f"{BASE_URL}/contacts/{self.contact_id}/tags/VIP")
                            if response.status_code == 200:
                                data = response.json()
                                if "VIP" not in data.get("tags", []):
                                    self.log_result("Test 4: Contact Tags", "PASS")
                                else:
                                    self.log_result("Test 4: Contact Tags", "FAIL", "Tag not removed")
                            else:
                                self.log_result("Test 4: Contact Tags", "FAIL", f"Tag removal failed, status: {response.status_code}")
                        else:
                            self.log_result("Test 4: Contact Tags", "FAIL", f"Tag not idempotent, count: {vip_count}")
                    else:
                        self.log_result("Test 4: Contact Tags", "FAIL", f"Second tag add failed, status: {response.status_code}")
                else:
                    self.log_result("Test 4: Contact Tags", "FAIL", "Tag not added")
            else:
                self.log_result("Test 4: Contact Tags", "FAIL", f"Tag add failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 4: Contact Tags", "FAIL", f"Exception: {str(e)}")
    
    def test_contact_files(self):
        """Test 5: Contact files"""
        try:
            # Upload file
            file_data = {
                "name": "lease.pdf",
                "mime_type": "application/pdf",
                "category": "lease",
                "data": "SGVsbG8gV29ybGQ=",
                "size": 11
            }
            response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/files", json=file_data)
            if response.status_code == 200:
                file_info = response.json()
                file_id = file_info.get("id")
                if file_id:
                    # Get file list (should NOT contain data field)
                    response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}/files")
                    if response.status_code == 200:
                        files = response.json()
                        if len(files) > 0 and "data" not in files[0]:
                            # Get specific file (SHOULD contain data field)
                            response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}/files/{file_id}")
                            if response.status_code == 200:
                                file_detail = response.json()
                                if file_detail.get("data") == "SGVsbG8gV29ybGQ=":
                                    # Delete file
                                    response = self.session.delete(f"{BASE_URL}/contacts/{self.contact_id}/files/{file_id}")
                                    if response.status_code == 200:
                                        # Verify file is gone
                                        response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}/files")
                                        if response.status_code == 200:
                                            files = response.json()
                                            if len(files) == 0:
                                                self.log_result("Test 5: Contact Files", "PASS")
                                            else:
                                                self.log_result("Test 5: Contact Files", "FAIL", "File not deleted")
                                        else:
                                            self.log_result("Test 5: Contact Files", "FAIL", "Failed to get files after delete")
                                    else:
                                        self.log_result("Test 5: Contact Files", "FAIL", f"File delete failed, status: {response.status_code}")
                                else:
                                    self.log_result("Test 5: Contact Files", "FAIL", "File data not correct in detail view")
                            else:
                                self.log_result("Test 5: Contact Files", "FAIL", f"File detail failed, status: {response.status_code}")
                        else:
                            self.log_result("Test 5: Contact Files", "FAIL", "File list contains data field or empty")
                    else:
                        self.log_result("Test 5: Contact Files", "FAIL", f"File list failed, status: {response.status_code}")
                else:
                    self.log_result("Test 5: Contact Files", "FAIL", "No file ID returned")
            else:
                self.log_result("Test 5: Contact Files", "FAIL", f"File upload failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 5: Contact Files", "FAIL", f"Exception: {str(e)}")
    
    def test_contact_lease(self):
        """Test 6: Contact lease"""
        try:
            # Get initial lease (should be empty)
            response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}/lease")
            if response.status_code == 200:
                data = response.json()
                if data.get("current") is None and data.get("history") == []:
                    # Create lease
                    lease_data = {
                        "unit": "4B",
                        "monthly_rent": 2500,
                        "security_deposit": 2500,
                        "lease_start": "2025-01-01",
                        "lease_end": "2026-01-01",
                        "move_in_date": "2025-01-01",
                        "lease_term_months": 12,
                        "status": "active",
                        "notes": "pet deposit paid"
                    }
                    response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/lease", json=lease_data)
                    if response.status_code == 200:
                        lease_info = response.json()
                        if lease_info.get("monthly_rent") == 2500:
                            # Update lease (should upsert)
                            update_data = {
                                "unit": "4B",
                                "monthly_rent": 2600,
                                "status": "active"
                            }
                            response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/lease", json=update_data)
                            if response.status_code == 200:
                                # Verify rent is updated
                                response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}/lease")
                                if response.status_code == 200:
                                    data = response.json()
                                    if data.get("current", {}).get("monthly_rent") == 2600:
                                        self.log_result("Test 6: Contact Lease", "PASS")
                                    else:
                                        self.log_result("Test 6: Contact Lease", "FAIL", "Lease not updated correctly")
                                else:
                                    self.log_result("Test 6: Contact Lease", "FAIL", "Failed to get lease after update")
                            else:
                                self.log_result("Test 6: Contact Lease", "FAIL", f"Lease update failed, status: {response.status_code}")
                        else:
                            self.log_result("Test 6: Contact Lease", "FAIL", "Lease creation data incorrect")
                    else:
                        self.log_result("Test 6: Contact Lease", "FAIL", f"Lease creation failed, status: {response.status_code}")
                else:
                    self.log_result("Test 6: Contact Lease", "FAIL", "Initial lease state not empty")
            else:
                self.log_result("Test 6: Contact Lease", "FAIL", f"Initial lease get failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 6: Contact Lease", "FAIL", f"Exception: {str(e)}")
    
    def test_maintenance_tickets(self):
        """Test 7: Maintenance tickets"""
        try:
            # Create maintenance ticket
            ticket_data = {
                "title": "Leaking faucet",
                "description": "Kitchen sink drips",
                "priority": "high",
                "category": "plumbing"
            }
            response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/maintenance", json=ticket_data)
            if response.status_code == 200:
                ticket_info = response.json()
                ticket_id = ticket_info.get("id")
                if ticket_id:
                    # Get maintenance list
                    response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}/maintenance")
                    if response.status_code == 200:
                        tickets = response.json()
                        if len(tickets) == 1:
                            # Check activity was created
                            response = self.session.get(f"{BASE_URL}/activities?contact_id={self.contact_id}")
                            if response.status_code == 200:
                                data = response.json()
                                activities = data.get("data", [])
                                maintenance_activity = any("Maintenance ticket opened: Leaking faucet (high)" in act.get("description", "") for act in activities)
                                if maintenance_activity:
                                    # Update ticket status
                                    update_data = {"status": "resolved"}
                                    response = self.session.put(f"{BASE_URL}/contacts/{self.contact_id}/maintenance/{ticket_id}", json=update_data)
                                    if response.status_code == 200:
                                        updated_ticket = response.json()
                                        if "resolved_at" in updated_ticket:
                                            # Test invalid priority
                                            invalid_data = {
                                                "title": "x",
                                                "priority": "URGENT"
                                            }
                                            response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/maintenance", json=invalid_data)
                                            if response.status_code == 422:
                                                # Delete ticket
                                                response = self.session.delete(f"{BASE_URL}/contacts/{self.contact_id}/maintenance/{ticket_id}")
                                                if response.status_code == 200:
                                                    self.log_result("Test 7: Maintenance Tickets", "PASS")
                                                else:
                                                    self.log_result("Test 7: Maintenance Tickets", "FAIL", f"Ticket delete failed, status: {response.status_code}")
                                            else:
                                                self.log_result("Test 7: Maintenance Tickets", "FAIL", f"Invalid priority not rejected, status: {response.status_code}")
                                        else:
                                            self.log_result("Test 7: Maintenance Tickets", "FAIL", "resolved_at not set")
                                    else:
                                        self.log_result("Test 7: Maintenance Tickets", "FAIL", f"Ticket update failed, status: {response.status_code}")
                                else:
                                    self.log_result("Test 7: Maintenance Tickets", "FAIL", "Maintenance activity not created")
                            else:
                                self.log_result("Test 7: Maintenance Tickets", "FAIL", "Failed to get activities")
                        else:
                            self.log_result("Test 7: Maintenance Tickets", "FAIL", f"Expected 1 ticket, got {len(tickets)}")
                    else:
                        self.log_result("Test 7: Maintenance Tickets", "FAIL", f"Get tickets failed, status: {response.status_code}")
                else:
                    self.log_result("Test 7: Maintenance Tickets", "FAIL", "No ticket ID returned")
            else:
                self.log_result("Test 7: Maintenance Tickets", "FAIL", f"Ticket creation failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 7: Maintenance Tickets", "FAIL", f"Exception: {str(e)}")
    
    def test_events(self):
        """Test 8: Events"""
        try:
            # Create event
            event_data = {
                "title": "Property Tour",
                "start": "2025-12-15T14:00:00Z",
                "end": "2025-12-15T15:00:00Z",
                "location": "Unit 4B",
                "event_type": "meeting"
            }
            response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/events", json=event_data)
            if response.status_code == 200:
                event_info = response.json()
                event_id = event_info.get("id")
                if event_id:
                    # Get events list
                    response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}/events")
                    if response.status_code == 200:
                        events = response.json()
                        if len(events) == 1:
                            # Update event
                            update_data = {"location": "Updated location"}
                            response = self.session.put(f"{BASE_URL}/contacts/{self.contact_id}/events/{event_id}", json=update_data)
                            if response.status_code == 200:
                                # Delete event
                                response = self.session.delete(f"{BASE_URL}/contacts/{self.contact_id}/events/{event_id}")
                                if response.status_code == 200:
                                    self.log_result("Test 8: Events", "PASS")
                                else:
                                    self.log_result("Test 8: Events", "FAIL", f"Event delete failed, status: {response.status_code}")
                            else:
                                self.log_result("Test 8: Events", "FAIL", f"Event update failed, status: {response.status_code}")
                        else:
                            self.log_result("Test 8: Events", "FAIL", f"Expected 1 event, got {len(events)}")
                    else:
                        self.log_result("Test 8: Events", "FAIL", f"Get events failed, status: {response.status_code}")
                else:
                    self.log_result("Test 8: Events", "FAIL", "No event ID returned")
            else:
                self.log_result("Test 8: Events", "FAIL", f"Event creation failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 8: Events", "FAIL", f"Exception: {str(e)}")
    
    def test_collaborators(self):
        """Test 9: Collaborators"""
        try:
            # Add collaborator
            collab_data = {"user_id": self.team_member_id}
            response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/collaborators", json=collab_data)
            if response.status_code == 200:
                collab_info = response.json()
                if collab_info.get("id") == self.team_member_id:
                    # Get collaborators list
                    response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}/collaborators")
                    if response.status_code == 200:
                        collaborators = response.json()
                        if len(collaborators) == 1:
                            # Test invalid user
                            invalid_data = {"user_id": "000000000000000000000000"}
                            response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/collaborators", json=invalid_data)
                            if response.status_code == 404:
                                # Remove collaborator
                                response = self.session.delete(f"{BASE_URL}/contacts/{self.contact_id}/collaborators/{self.team_member_id}")
                                if response.status_code == 200:
                                    # Verify empty list
                                    response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}/collaborators")
                                    if response.status_code == 200:
                                        collaborators = response.json()
                                        if len(collaborators) == 0:
                                            self.log_result("Test 9: Collaborators", "PASS")
                                        else:
                                            self.log_result("Test 9: Collaborators", "FAIL", "Collaborator not removed")
                                    else:
                                        self.log_result("Test 9: Collaborators", "FAIL", "Failed to get collaborators after delete")
                                else:
                                    self.log_result("Test 9: Collaborators", "FAIL", f"Collaborator delete failed, status: {response.status_code}")
                            else:
                                self.log_result("Test 9: Collaborators", "FAIL", f"Invalid user not rejected, status: {response.status_code}")
                        else:
                            self.log_result("Test 9: Collaborators", "FAIL", f"Expected 1 collaborator, got {len(collaborators)}")
                    else:
                        self.log_result("Test 9: Collaborators", "FAIL", f"Get collaborators failed, status: {response.status_code}")
                else:
                    self.log_result("Test 9: Collaborators", "FAIL", "Collaborator ID mismatch")
            else:
                self.log_result("Test 9: Collaborators", "FAIL", f"Add collaborator failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 9: Collaborators", "FAIL", f"Exception: {str(e)}")
    
    def test_ai_retention_summary(self):
        """Test 10: AI Retention Summary"""
        try:
            # First call
            ai_data = {"contact_id": self.contact_id}
            response = self.session.post(f"{BASE_URL}/ai/retention-summary", json=ai_data)
            if response.status_code == 200:
                data = response.json()
                if (data.get("summary") and 
                    isinstance(data.get("retention_score"), int) and 
                    0 <= data.get("retention_score") <= 100 and
                    data.get("cached") == False):
                    
                    # Second call (should be cached)
                    response = self.session.post(f"{BASE_URL}/ai/retention-summary", json=ai_data)
                    if response.status_code == 200:
                        data2 = response.json()
                        if data2.get("cached") == True and data2.get("summary") == data.get("summary"):
                            # Check contact has retention data
                            response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}")
                            if response.status_code == 200:
                                contact = response.json()
                                if "retention_score" in contact and "retention_summary" in contact:
                                    self.log_result("Test 10: AI Retention Summary", "PASS")
                                else:
                                    self.log_result("Test 10: AI Retention Summary", "FAIL", "Retention data not persisted in contact")
                            else:
                                self.log_result("Test 10: AI Retention Summary", "FAIL", "Failed to get contact")
                        else:
                            self.log_result("Test 10: AI Retention Summary", "FAIL", "Second call not cached properly")
                    else:
                        self.log_result("Test 10: AI Retention Summary", "FAIL", f"Second call failed, status: {response.status_code}")
                else:
                    self.log_result("Test 10: AI Retention Summary", "FAIL", "Invalid response format")
            else:
                self.log_result("Test 10: AI Retention Summary", "FAIL", f"AI call failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 10: AI Retention Summary", "FAIL", f"Exception: {str(e)}")
    
    def test_ai_email_analysis(self):
        """Test 11: AI Email Thread Analysis"""
        try:
            # Test with no email activities
            ai_data = {"contact_id": self.contact_id}
            response = self.session.post(f"{BASE_URL}/ai/analyze-email-thread", json=ai_data)
            if response.status_code == 200:
                data = response.json()
                if "No email history found for this contact." in data.get("analysis", ""):
                    # Create an email activity
                    activity_data = {
                        "contact_id": self.contact_id,
                        "activity_type": "email",
                        "description": "Sent lease renewal inquiry"
                    }
                    response = self.session.post(f"{BASE_URL}/activities", json=activity_data)
                    if response.status_code in [200, 201]:
                        # Test again with email activity
                        response = self.session.post(f"{BASE_URL}/ai/analyze-email-thread", json=ai_data)
                        if response.status_code == 200:
                            data = response.json()
                            if data.get("analysis") and data.get("email_count") == 1:
                                self.log_result("Test 11: AI Email Analysis", "PASS")
                            else:
                                self.log_result("Test 11: AI Email Analysis", "FAIL", "Invalid analysis response")
                        else:
                            self.log_result("Test 11: AI Email Analysis", "FAIL", f"Second analysis failed, status: {response.status_code}")
                    else:
                        self.log_result("Test 11: AI Email Analysis", "FAIL", f"Activity creation failed, status: {response.status_code}")
                else:
                    self.log_result("Test 11: AI Email Analysis", "FAIL", "Expected 'No email history' message")
            else:
                self.log_result("Test 11: AI Email Analysis", "FAIL", f"AI analysis failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 11: AI Email Analysis", "FAIL", f"Exception: {str(e)}")
    
    def test_convert_to_tenant(self):
        """Test 12: Convert to Tenant"""
        try:
            response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/convert-to-tenant")
            if response.status_code == 200:
                data = response.json()
                if (data.get("is_tenant") == True and 
                    data.get("leasing_stage") == "Active Tenant" and
                    "stage_updated_at" in data):
                    
                    # Verify in contact
                    response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}")
                    if response.status_code == 200:
                        contact = response.json()
                        if (contact.get("is_tenant") == True and
                            contact.get("client_type") == "leasing_tenant" and
                            contact.get("leasing_stage") == "Active Tenant"):
                            
                            # Check activity was logged
                            response = self.session.get(f"{BASE_URL}/activities?contact_id={self.contact_id}")
                            if response.status_code == 200:
                                data = response.json()
                                activities = data.get("data", [])
                                convert_activity = any("Converted from prospect to active tenant" in act.get("description", "") for act in activities)
                                if convert_activity:
                                    self.log_result("Test 12: Convert to Tenant", "PASS")
                                else:
                                    self.log_result("Test 12: Convert to Tenant", "FAIL", "Convert activity not logged")
                            else:
                                self.log_result("Test 12: Convert to Tenant", "FAIL", "Failed to get activities")
                        else:
                            self.log_result("Test 12: Convert to Tenant", "FAIL", "Contact not updated correctly")
                    else:
                        self.log_result("Test 12: Convert to Tenant", "FAIL", "Failed to get contact")
                else:
                    self.log_result("Test 12: Convert to Tenant", "FAIL", "Invalid response data")
            else:
                self.log_result("Test 12: Convert to Tenant", "FAIL", f"Convert failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 12: Convert to Tenant", "FAIL", f"Exception: {str(e)}")
    
    def test_send_renewal_offer(self):
        """Test 13: Send Renewal Offer"""
        try:
            response = self.session.post(f"{BASE_URL}/contacts/{self.contact_id}/send-renewal-offer")
            if response.status_code == 200:
                data = response.json()
                if (data.get("draft") and 
                    "Subject:" in data.get("draft", "") and
                    data.get("leasing_stage") == "Renewal Offered"):
                    
                    # Verify stage in contact
                    response = self.session.get(f"{BASE_URL}/contacts/{self.contact_id}")
                    if response.status_code == 200:
                        contact = response.json()
                        if contact.get("leasing_stage") == "Renewal Offered":
                            self.log_result("Test 13: Send Renewal Offer", "PASS")
                        else:
                            self.log_result("Test 13: Send Renewal Offer", "FAIL", "Stage not updated")
                    else:
                        self.log_result("Test 13: Send Renewal Offer", "FAIL", "Failed to get contact")
                else:
                    self.log_result("Test 13: Send Renewal Offer", "FAIL", "Invalid response data")
            else:
                self.log_result("Test 13: Send Renewal Offer", "FAIL", f"Renewal offer failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 13: Send Renewal Offer", "FAIL", f"Exception: {str(e)}")
    
    def test_ownership_enforcement(self):
        """Test 14: Ownership Enforcement"""
        try:
            # Register second user with unique email
            timestamp = int(time.time())
            user_data = {
                "name": "Other",
                "email": f"other-phase9-{timestamp}@test.com",
                "password": "OtherPass123!"
            }
            response = self.session.post(f"{BASE_URL}/auth/register", json=user_data)
            if response.status_code in [200, 201]:
                # Login as second user
                other_session = requests.Session()
                login_data = {
                    "email": f"other-phase9-{timestamp}@test.com",
                    "password": "OtherPass123!"
                }
                response = other_session.post(f"{BASE_URL}/auth/login", json=login_data)
                if response.status_code == 200:
                    # Test stage update (should return 404)
                    stage_data = {
                        "leasing_stage": "Tour Scheduled",
                        "client_type": "leasing_tenant"
                    }
                    response = other_session.put(f"{BASE_URL}/contacts/{self.contact_id}/stage", json=stage_data)
                    if response.status_code == 404:
                        # Test file upload (should return 404)
                        file_data = {
                            "name": "test.pdf",
                            "mime_type": "application/pdf",
                            "category": "lease",
                            "data": "SGVsbG8gV29ybGQ=",
                            "size": 11
                        }
                        response = other_session.post(f"{BASE_URL}/contacts/{self.contact_id}/files", json=file_data)
                        if response.status_code == 404:
                            # Test lease get (should return 404)
                            response = other_session.get(f"{BASE_URL}/contacts/{self.contact_id}/lease")
                            if response.status_code == 404:
                                # Test AI retention summary (should return 404)
                                ai_data = {"contact_id": self.contact_id}
                                response = other_session.post(f"{BASE_URL}/ai/retention-summary", json=ai_data)
                                if response.status_code == 404:
                                    self.log_result("Test 14: Ownership Enforcement", "PASS")
                                else:
                                    self.log_result("Test 14: Ownership Enforcement", "FAIL", f"AI endpoint accessible, status: {response.status_code}")
                            else:
                                self.log_result("Test 14: Ownership Enforcement", "FAIL", f"Lease endpoint accessible, status: {response.status_code}")
                        else:
                            self.log_result("Test 14: Ownership Enforcement", "FAIL", f"Files endpoint accessible, status: {response.status_code}")
                    else:
                        self.log_result("Test 14: Ownership Enforcement", "FAIL", f"Stage endpoint accessible, status: {response.status_code}")
                else:
                    self.log_result("Test 14: Ownership Enforcement", "FAIL", f"Second user login failed, status: {response.status_code}")
            else:
                self.log_result("Test 14: Ownership Enforcement", "FAIL", f"Second user registration failed, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 14: Ownership Enforcement", "FAIL", f"Exception: {str(e)}")
    
    def test_auth_enforcement(self):
        """Test 15: Auth Enforcement"""
        try:
            # Test without authentication
            no_auth_session = requests.Session()
            
            # Test client-types endpoint
            response = no_auth_session.get(f"{BASE_URL}/client-types")
            if response.status_code in [401, 403]:
                # Test contact photo endpoint
                photo_data = {"photo_url": "data:image/png;base64,test"}
                response = no_auth_session.post(f"{BASE_URL}/contacts/{self.contact_id}/photo", json=photo_data)
                if response.status_code in [401, 403]:
                    # Test AI endpoint
                    ai_data = {"contact_id": self.contact_id}
                    response = no_auth_session.post(f"{BASE_URL}/ai/retention-summary", json=ai_data)
                    if response.status_code in [401, 403]:
                        self.log_result("Test 15: Auth Enforcement", "PASS")
                    else:
                        self.log_result("Test 15: Auth Enforcement", "FAIL", f"AI endpoint accessible without auth, status: {response.status_code}")
                else:
                    self.log_result("Test 15: Auth Enforcement", "FAIL", f"Photo endpoint accessible without auth, status: {response.status_code}")
            else:
                self.log_result("Test 15: Auth Enforcement", "FAIL", f"Client-types endpoint accessible without auth, status: {response.status_code}")
        except Exception as e:
            self.log_result("Test 15: Auth Enforcement", "FAIL", f"Exception: {str(e)}")
    
    def cleanup(self):
        """Cleanup test data"""
        try:
            if self.contact_id:
                response = self.session.delete(f"{BASE_URL}/contacts/{self.contact_id}")
                if response.status_code == 200:
                    self.log_result("Cleanup", "PASS", "Test contact deleted")
                elif response.status_code == 404:
                    self.log_result("Cleanup", "PASS", "Test contact already deleted")
                else:
                    self.log_result("Cleanup", "FAIL", f"Failed to delete test contact, status: {response.status_code}")
        except Exception as e:
            self.log_result("Cleanup", "FAIL", f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all Phase 9 tests"""
        print("=== Phase 9 Contact Profile Page Backend Testing ===\n")
        
        # Setup
        if not self.login_admin():
            return
        
        if not self.setup_test_data():
            return
        
        # Run all tests
        self.test_client_types()
        self.test_contact_photo()
        self.test_contact_stage()
        self.test_contact_tags()
        self.test_contact_files()
        self.test_contact_lease()
        self.test_maintenance_tickets()
        self.test_events()
        self.test_collaborators()
        self.test_ai_retention_summary()
        self.test_ai_email_analysis()
        self.test_convert_to_tenant()
        self.test_send_renewal_offer()
        self.test_ownership_enforcement()
        self.test_auth_enforcement()
        
        # Cleanup
        self.cleanup()
        
        # Summary
        print("\n=== TEST SUMMARY ===")
        passed = sum(1 for r in self.test_results if r["status"] == "PASS")
        failed = sum(1 for r in self.test_results if r["status"] == "FAIL")
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        
        if failed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if result["status"] == "FAIL":
                    print(f"❌ {result['test']}: {result['details']}")
        
        return failed == 0

if __name__ == "__main__":
    runner = TestRunner()
    success = runner.run_all_tests()
    sys.exit(0 if success else 1)