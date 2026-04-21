#!/usr/bin/env python3
"""
Twilio SMS Integration Testing
Tests the 3 main Twilio SMS features:
1. GET /api/twilio/status - Verify Twilio credentials and account info
2. POST /api/twilio/inbound-sms - Webhook for receiving SMS messages
3. POST /api/inbox/threads/{contact_id}/reply (channel="sms") - Send SMS messages
Plus light regression testing on existing inbox endpoints.
"""

import requests
import json
import time
import sys
import random
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

# Configuration
BASE_URL = "https://student-rental-hub-2.preview.emergentagent.com/api"
TEST_EMAIL = "admin@propflow.com"
TEST_PASSWORD = "admin123"

def generate_unique_phone(base="+1512555"):
    """Generate a unique phone number for testing"""
    random_num = random.randint(1000, 9999)
    return f"{base}{random_num}"

def generate_unique_email(base="test"):
    """Generate a unique email address for testing"""
    timestamp = int(time.time())
    random_num = random.randint(1000, 9999)
    return f"{base}.{timestamp}.{random_num}@example.com"

class TestSession:
    def __init__(self):
        self.session = requests.Session()
        self.user_id = None
        
    def login(self):
        """Authenticate and get cookies"""
        print("🔐 Logging in...")
        response = self.session.post(f"{BASE_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return False
        
        # Verify auth with /auth/me
        me_response = self.session.get(f"{BASE_URL}/auth/me")
        if me_response.status_code != 200:
            print(f"❌ Auth verification failed: {me_response.status_code}")
            return False
            
        user_data = me_response.json()
        self.user_id = user_data.get("id")
        print(f"✅ Logged in as {user_data.get('email')} (ID: {self.user_id})")
        return True

def test_twilio_status(session):
    """Test 1: GET /api/twilio/status"""
    print("\n" + "="*60)
    print("TEST 1: Twilio Status API")
    print("="*60)
    
    results = []
    
    # Test 1a: Authenticated request should return Twilio account info
    print("\n📞 Testing Twilio status with authentication...")
    response = session.session.get(f"{BASE_URL}/twilio/status")
    if response.status_code != 200:
        print(f"❌ Twilio status failed: {response.status_code} - {response.text}")
        results.append(False)
    else:
        data = response.json()
        print(f"✅ Twilio status response received")
        
        # Verify required fields
        required_fields = ["configured", "account_sid", "account_status", "account_type", 
                          "friendly_name", "from_number", "inbound_webhook_url"]
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            print(f"❌ Missing required fields: {missing_fields}")
            results.append(False)
        else:
            print(f"✅ All required fields present")
            
            # Verify specific values
            if data.get("configured") == True:
                print(f"✅ Twilio configured: {data['configured']}")
                print(f"   Account SID: {data['account_sid']}")
                print(f"   Account Status: {data['account_status']}")
                print(f"   Account Type: {data['account_type']}")
                print(f"   Friendly Name: {data['friendly_name']}")
                print(f"   From Number: {data['from_number']}")
                print(f"   Webhook URL: {data['inbound_webhook_url']}")
                
                # Verify expected values
                if data['account_sid'] == "AC8ef40e924a8b2a946f9f050a419e737a":
                    print("✅ Account SID matches expected value")
                    results.append(True)
                else:
                    print(f"❌ Account SID mismatch. Expected: AC8ef40e924a8b2a946f9f050a419e737a, Got: {data['account_sid']}")
                    results.append(False)
                
                if data['from_number'] == "+17372146128":
                    print("✅ From number matches expected value")
                    results.append(True)
                else:
                    print(f"❌ From number mismatch. Expected: +17372146128, Got: {data['from_number']}")
                    results.append(False)
                
                expected_webhook = "https://student-rental-hub-2.preview.emergentagent.com/api/twilio/inbound-sms"
                if data['inbound_webhook_url'] == expected_webhook:
                    print("✅ Webhook URL matches expected value")
                    results.append(True)
                else:
                    print(f"❌ Webhook URL mismatch. Expected: {expected_webhook}, Got: {data['inbound_webhook_url']}")
                    results.append(False)
                    
            else:
                print(f"❌ Twilio not configured: {data}")
                results.append(False)
    
    # Test 1b: Unauthenticated request should return 401
    print("\n🔒 Testing Twilio status without authentication...")
    unauth_session = requests.Session()
    unauth_response = unauth_session.get(f"{BASE_URL}/twilio/status")
    if unauth_response.status_code == 401:
        print("✅ Unauthenticated request correctly returns 401")
        results.append(True)
    else:
        print(f"❌ Unauthenticated request should return 401, got: {unauth_response.status_code}")
        results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Twilio Status Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_twilio_inbound_sms(session):
    """Test 2: POST /api/twilio/inbound-sms"""
    print("\n" + "="*60)
    print("TEST 2: Twilio Inbound SMS Webhook")
    print("="*60)
    
    results = []
    
    # Test 2a: Create a contact for matched SMS testing
    print("\n👤 Creating test contact for matched SMS...")
    test_phone = "+15125551234"
    contact_data = {
        "name": "SMS Test Contact",
        "email": generate_unique_email("sms.test"),
        "phone": test_phone
    }
    contact_response = session.session.post(f"{BASE_URL}/contacts", json=contact_data)
    if contact_response.status_code not in [200, 201]:
        print(f"❌ Contact creation failed: {contact_response.status_code}")
        return False
    
    contact = contact_response.json()
    contact_id = contact["id"]
    print(f"✅ Created test contact: {contact_id} with phone: {test_phone}")
    
    # Test 2b: Send matched inbound SMS
    print("\n📱 Testing matched inbound SMS...")
    form_data = {
        "From": test_phone,
        "To": "+17372146128",
        "Body": "Hello inbound test",
        "MessageSid": "SMtest_matched_001"
    }
    
    # Use requests without session to avoid auth (webhook should be public)
    webhook_response = requests.post(
        f"{BASE_URL}/twilio/inbound-sms",
        data=form_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if webhook_response.status_code == 200:
        print("✅ Inbound SMS webhook returned 200")
        
        # Verify response is XML
        if webhook_response.headers.get("content-type") == "application/xml":
            print("✅ Response content-type is application/xml")
            results.append(True)
        else:
            print(f"❌ Expected application/xml, got: {webhook_response.headers.get('content-type')}")
            results.append(False)
        
        # Verify response body is TwiML
        if webhook_response.text.strip() == "<Response></Response>":
            print("✅ Response body is correct TwiML")
            results.append(True)
        else:
            print(f"❌ Expected '<Response></Response>', got: {webhook_response.text}")
            results.append(False)
        
        # Wait a moment for database operations
        time.sleep(2)
        
        # Verify message was logged in inbox
        print("\n📧 Checking if message was logged in inbox...")
        thread_response = session.session.get(f"{BASE_URL}/inbox/threads/{contact_id}")
        if thread_response.status_code == 200:
            thread_data = thread_response.json()
            messages = thread_data.get("messages", [])
            
            # Find the inbound SMS message
            inbound_sms = None
            for msg in messages:
                if (msg.get("channel") == "sms" and 
                    msg.get("direction") == "inbound" and 
                    msg.get("body") == "Hello inbound test" and
                    msg.get("external_id") == "SMtest_matched_001"):
                    inbound_sms = msg
                    break
            
            if inbound_sms:
                print("✅ Inbound SMS message found in inbox")
                print(f"   Contact ID: {inbound_sms.get('contact_id')}")
                print(f"   Channel: {inbound_sms.get('channel')}")
                print(f"   Direction: {inbound_sms.get('direction')}")
                print(f"   Body: {inbound_sms.get('body')}")
                print(f"   From: {inbound_sms.get('from_addr')}")
                print(f"   External ID: {inbound_sms.get('external_id')}")
                print(f"   Read: {inbound_sms.get('read')}")
                
                # Verify all expected fields
                if (inbound_sms.get("contact_id") == contact_id and
                    inbound_sms.get("from_addr") == test_phone and
                    inbound_sms.get("read") == False):
                    print("✅ All message fields correct")
                    results.append(True)
                else:
                    print("❌ Some message fields incorrect")
                    results.append(False)
            else:
                print("❌ Inbound SMS message not found in inbox")
                print(f"   Available messages: {len(messages)}")
                for i, msg in enumerate(messages):
                    print(f"   Message {i}: {msg.get('channel')} {msg.get('direction')} - {msg.get('body')[:50]}")
                results.append(False)
        else:
            print(f"❌ Failed to get inbox thread: {thread_response.status_code}")
            results.append(False)
            
    else:
        print(f"❌ Inbound SMS webhook failed: {webhook_response.status_code} - {webhook_response.text}")
        results.append(False)
    
    # Test 2c: Test phone number normalization
    print("\n📞 Testing phone number normalization...")
    # Create contact with formatted phone number
    normalized_phone = "(512) 555-9999"
    norm_contact_data = {
        "name": "Normalized Phone Test",
        "email": generate_unique_email("norm.test"),
        "phone": normalized_phone
    }
    norm_contact_response = session.session.post(f"{BASE_URL}/contacts", json=norm_contact_data)
    if norm_contact_response.status_code in [200, 201]:
        norm_contact = norm_contact_response.json()
        norm_contact_id = norm_contact["id"]
        print(f"✅ Created contact with formatted phone: {normalized_phone}")
        
        # Send SMS from normalized number (should match)
        norm_form_data = {
            "From": "+15125559999",  # Normalized version of (512) 555-9999
            "To": "+17372146128",
            "Body": "Normalized phone test",
            "MessageSid": "SMtest_normalized_001"
        }
        
        norm_webhook_response = requests.post(
            f"{BASE_URL}/twilio/inbound-sms",
            data=norm_form_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if norm_webhook_response.status_code == 200:
            print("✅ Normalized phone SMS webhook returned 200")
            time.sleep(2)
            
            # Check if message was matched to the contact
            norm_thread_response = session.session.get(f"{BASE_URL}/inbox/threads/{norm_contact_id}")
            if norm_thread_response.status_code == 200:
                norm_thread_data = norm_thread_response.json()
                norm_messages = norm_thread_data.get("messages", [])
                
                norm_sms = None
                for msg in norm_messages:
                    if (msg.get("channel") == "sms" and 
                        msg.get("body") == "Normalized phone test"):
                        norm_sms = msg
                        break
                
                if norm_sms:
                    print("✅ Phone normalization works - message matched to contact")
                    results.append(True)
                else:
                    print("❌ Phone normalization failed - message not matched")
                    results.append(False)
            else:
                print(f"❌ Failed to get normalized contact thread: {norm_thread_response.status_code}")
                results.append(False)
        else:
            print(f"❌ Normalized phone webhook failed: {norm_webhook_response.status_code}")
            results.append(False)
    else:
        print(f"❌ Normalized contact creation failed: {norm_contact_response.status_code}")
        results.append(False)
    
    # Test 2d: Test unmatched phone number
    print("\n❓ Testing unmatched phone number...")
    unmatched_form_data = {
        "From": "+19999999999",  # Should not match any contact
        "To": "+17372146128",
        "Body": "Orphan msg",
        "MessageSid": "SMtest_orphan_001"
    }
    
    unmatched_response = requests.post(
        f"{BASE_URL}/twilio/inbound-sms",
        data=unmatched_form_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if unmatched_response.status_code == 200:
        print("✅ Unmatched SMS webhook returned 200")
        
        if unmatched_response.text.strip() == "<Response></Response>":
            print("✅ Unmatched SMS returned correct TwiML")
            results.append(True)
        else:
            print(f"❌ Unmatched SMS TwiML incorrect: {unmatched_response.text}")
            results.append(False)
    else:
        print(f"❌ Unmatched SMS webhook failed: {unmatched_response.status_code}")
        results.append(False)
    
    # Test 2e: Test missing required fields
    print("\n🚫 Testing missing required fields...")
    incomplete_form_data = {
        "From": test_phone,
        # Missing Body and MessageSid
        "To": "+17372146128"
    }
    
    incomplete_response = requests.post(
        f"{BASE_URL}/twilio/inbound-sms",
        data=incomplete_form_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if incomplete_response.status_code == 200:
        print("✅ Incomplete SMS webhook returned 200 (graceful handling)")
        
        if incomplete_response.text.strip() == "<Response></Response>":
            print("✅ Incomplete SMS returned correct TwiML")
            results.append(True)
        else:
            print(f"❌ Incomplete SMS TwiML incorrect: {incomplete_response.text}")
            results.append(False)
    else:
        print(f"❌ Incomplete SMS webhook failed: {incomplete_response.status_code}")
        results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Inbound SMS Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_outbound_sms(session):
    """Test 3: POST /api/inbox/threads/{contact_id}/reply (channel="sms")"""
    print("\n" + "="*60)
    print("TEST 3: Outbound SMS via Inbox Reply")
    print("="*60)
    
    results = []
    
    # Test 3a: Create a contact with Twilio phone number (trial account can send to itself)
    print("\n👤 Creating test contact for outbound SMS...")
    twilio_phone = "+17372146128"  # Use Twilio's own number for trial account
    outbound_contact_data = {
        "name": "Outbound SMS Test",
        "email": generate_unique_email("outbound.test"),
        "phone": twilio_phone
    }
    outbound_contact_response = session.session.post(f"{BASE_URL}/contacts", json=outbound_contact_data)
    if outbound_contact_response.status_code not in [200, 201]:
        print(f"❌ Outbound contact creation failed: {outbound_contact_response.status_code}")
        return False
    
    outbound_contact = outbound_contact_response.json()
    outbound_contact_id = outbound_contact["id"]
    print(f"✅ Created outbound test contact: {outbound_contact_id} with phone: {twilio_phone}")
    
    # Test 3b: Send SMS via inbox reply
    print("\n📤 Testing outbound SMS send...")
    sms_data = {
        "channel": "sms",
        "body": "Test SMS from PropFlow test suite"
    }
    
    sms_response = session.session.post(f"{BASE_URL}/inbox/threads/{outbound_contact_id}/reply", json=sms_data)
    
    if sms_response.status_code == 200:
        print("✅ Outbound SMS API returned 200")
        
        sms_result = sms_response.json()
        if sms_result.get("success") == True:
            print("✅ SMS send marked as successful")
            
            message_data = sms_result.get("message", {})
            external_id = message_data.get("external_id", "")
            
            if external_id and external_id.startswith("SM"):
                print(f"✅ SMS delivered by Twilio - External ID: {external_id}")
                print("   Outcome: (a) Twilio accepted the SMS")
                results.append(True)
            elif external_id == "":
                print("⚠️  SMS logged locally only - External ID empty")
                print("   Outcome: (b) Twilio rejected (graceful degradation)")
                print("   This is acceptable for trial accounts with unverified destinations")
                results.append(True)  # Both outcomes are acceptable
            else:
                print(f"❌ Unexpected external_id format: {external_id}")
                results.append(False)
            
            # Verify message was logged in database
            time.sleep(2)
            thread_response = session.session.get(f"{BASE_URL}/inbox/threads/{outbound_contact_id}")
            if thread_response.status_code == 200:
                thread_data = thread_response.json()
                messages = thread_data.get("messages", [])
                
                # Find the outbound SMS
                outbound_sms = None
                for msg in messages:
                    if (msg.get("channel") == "sms" and 
                        msg.get("direction") == "outbound" and 
                        msg.get("body") == "Test SMS from PropFlow test suite"):
                        outbound_sms = msg
                        break
                
                if outbound_sms:
                    print("✅ Outbound SMS logged in database")
                    print(f"   Direction: {outbound_sms.get('direction')}")
                    print(f"   Channel: {outbound_sms.get('channel')}")
                    print(f"   External ID: {outbound_sms.get('external_id')}")
                    results.append(True)
                else:
                    print("❌ Outbound SMS not found in database")
                    results.append(False)
            else:
                print(f"❌ Failed to verify SMS in database: {thread_response.status_code}")
                results.append(False)
                
        else:
            print(f"❌ SMS send not marked as successful: {sms_result}")
            results.append(False)
    else:
        print(f"❌ Outbound SMS failed: {sms_response.status_code} - {sms_response.text}")
        results.append(False)
    
    # Test 3c: Test SMS to contact without phone number
    print("\n🚫 Testing SMS to contact without phone...")
    no_phone_contact_data = {
        "name": "No Phone Contact",
        "email": generate_unique_email("nophone.test")
        # No phone number
    }
    no_phone_response = session.session.post(f"{BASE_URL}/contacts", json=no_phone_contact_data)
    if no_phone_response.status_code in [200, 201]:
        no_phone_contact = no_phone_response.json()
        no_phone_contact_id = no_phone_contact["id"]
        
        no_phone_sms_data = {
            "channel": "sms",
            "body": "This should fail"
        }
        
        no_phone_sms_response = session.session.post(f"{BASE_URL}/inbox/threads/{no_phone_contact_id}/reply", json=no_phone_sms_data)
        
        if no_phone_sms_response.status_code == 400:
            print("✅ SMS to contact without phone correctly returns 400")
            results.append(True)
        else:
            print(f"❌ SMS to contact without phone should return 400, got: {no_phone_sms_response.status_code}")
            results.append(False)
    else:
        print(f"❌ No phone contact creation failed: {no_phone_response.status_code}")
        results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Outbound SMS Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_inbox_regression(session):
    """Test 4: Light regression testing on existing inbox endpoints"""
    print("\n" + "="*60)
    print("TEST 4: Inbox Regression Testing")
    print("="*60)
    
    results = []
    
    # Test 4a: GET /api/inbox/counts
    print("\n📊 Testing inbox counts...")
    counts_response = session.session.get(f"{BASE_URL}/inbox/counts")
    if counts_response.status_code == 200:
        counts_data = counts_response.json()
        print(f"✅ Inbox counts working: {counts_data}")
        results.append(True)
    else:
        print(f"❌ Inbox counts failed: {counts_response.status_code}")
        results.append(False)
    
    # Test 4b: GET /api/inbox/threads
    print("\n📧 Testing inbox threads list...")
    threads_response = session.session.get(f"{BASE_URL}/inbox/threads")
    if threads_response.status_code == 200:
        threads_data = threads_response.json()
        print(f"✅ Inbox threads working: {len(threads_data.get('threads', []))} threads")
        results.append(True)
    else:
        print(f"❌ Inbox threads failed: {threads_response.status_code}")
        results.append(False)
    
    # Test 4c: Test mark thread as read (if we have any contacts)
    print("\n✅ Testing mark thread as read...")
    # Get first contact to test with
    contacts_response = session.session.get(f"{BASE_URL}/contacts?limit=1")
    if contacts_response.status_code == 200:
        contacts_data = contacts_response.json()
        if contacts_data.get("items"):
            test_contact_id = contacts_data["items"][0]["id"]
            
            read_response = session.session.post(f"{BASE_URL}/inbox/threads/{test_contact_id}/read")
            if read_response.status_code == 200:
                print("✅ Mark thread as read working")
                results.append(True)
            else:
                print(f"❌ Mark thread as read failed: {read_response.status_code}")
                results.append(False)
        else:
            print("⚠️  No contacts available for read test - skipping")
            results.append(True)  # Skip this test
    else:
        print(f"❌ Failed to get contacts for read test: {contacts_response.status_code}")
        results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Inbox Regression Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def main():
    """Run all Twilio SMS integration tests"""
    print("🚀 Starting Twilio SMS Integration Testing")
    print("="*60)
    
    # Initialize session and login
    session = TestSession()
    if not session.login():
        print("❌ Authentication failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run all tests
    test_results = {}
    
    try:
        test_results["twilio_status"] = test_twilio_status(session)
        test_results["inbound_sms"] = test_twilio_inbound_sms(session)
        test_results["outbound_sms"] = test_outbound_sms(session)
        test_results["inbox_regression"] = test_inbox_regression(session)
        
    except Exception as e:
        print(f"\n❌ Test execution failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Final summary
    print("\n" + "="*60)
    print("FINAL TEST SUMMARY")
    print("="*60)
    
    total_tests = len(test_results)
    passed_tests = sum(test_results.values())
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    success_rate = (passed_tests / total_tests) * 100
    print(f"\nOverall Results: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")
    
    if passed_tests == total_tests:
        print("\n🎉 ALL TESTS PASSED! Twilio SMS integration is working correctly.")
        return True
    else:
        print(f"\n⚠️  {total_tests - passed_tests} test(s) failed. Please review the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)