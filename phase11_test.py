#!/usr/bin/env python3
"""
Phase 11 Backend Testing - Dashboard Leasing Overview
Tests the new GET /api/dashboard/leasing-overview endpoint with comprehensive validation
"""

import requests
import json
import time
import sys
import random
from datetime import datetime, timezone, timedelta

# Configuration
BASE_URL = "https://propflow-crm-4.preview.emergentagent.com/api"
TEST_EMAIL = "admin@propflow.com"
TEST_PASSWORD = "admin123"

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

def test_leasing_overview_shape_and_defaults(session):
    """Test 1: Basic shape and default parameters"""
    print("\n" + "="*60)
    print("TEST 1: Shape & Defaults")
    print("="*60)
    
    results = []
    
    # Test 1a: Default parameters (no query params)
    print("\n📊 Testing default parameters...")
    response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview")
    if response.status_code != 200:
        print(f"❌ Default request failed: {response.status_code} - {response.text}")
        results.append(False)
        return False
    
    data = response.json()
    print(f"✅ Default request successful: {response.status_code}")
    
    # Verify basic structure
    expected_keys = ["range", "scope", "granularity", "kpis", "todays_action_items", "recent_activity"]
    for key in expected_keys:
        if key not in data:
            print(f"❌ Missing key: {key}")
            results.append(False)
        else:
            print(f"✅ Found key: {key}")
            results.append(True)
    
    # Verify defaults
    if data.get("range") == "30d":
        print("✅ Default range is 30d")
        results.append(True)
    else:
        print(f"❌ Expected range=30d, got: {data.get('range')}")
        results.append(False)
    
    if data.get("scope") == "me":
        print("✅ Default scope is me")
        results.append(True)
    else:
        print(f"❌ Expected scope=me, got: {data.get('scope')}")
        results.append(False)
    
    if data.get("granularity") == "day":
        print("✅ Default granularity is day")
        results.append(True)
    else:
        print(f"❌ Expected granularity=day, got: {data.get('granularity')}")
        results.append(False)
    
    # Verify KPIs structure
    kpis = data.get("kpis", {})
    expected_kpis = ["new_inquiries", "avg_speed_to_first_contact", "lease_up_velocity", 
                     "current_occupancy_rate", "upcoming_renewals"]
    
    for kpi in expected_kpis:
        if kpi not in kpis:
            print(f"❌ Missing KPI: {kpi}")
            results.append(False)
        else:
            print(f"✅ Found KPI: {kpi}")
            results.append(True)
    
    # Verify new_inquiries structure
    new_inq = kpis.get("new_inquiries", {})
    expected_inq_fields = ["value", "previous", "growth_pct", "lower_is_better", "sparkline"]
    for field in expected_inq_fields:
        if field not in new_inq:
            print(f"❌ new_inquiries missing field: {field}")
            results.append(False)
        else:
            print(f"✅ new_inquiries has field: {field}")
            results.append(True)
    
    # Verify speed to first contact structure
    speed = kpis.get("avg_speed_to_first_contact", {})
    expected_speed_fields = ["value_hours", "previous_hours", "growth_pct", "lower_is_better", "sample_size", "sparkline"]
    for field in expected_speed_fields:
        if field not in speed:
            print(f"❌ avg_speed_to_first_contact missing field: {field}")
            results.append(False)
        else:
            print(f"✅ avg_speed_to_first_contact has field: {field}")
            results.append(True)
    
    # Verify lease up velocity structure
    velocity = kpis.get("lease_up_velocity", {})
    expected_velocity_fields = ["value_days", "previous_days", "growth_pct", "lower_is_better", "sample_size", "sparkline"]
    for field in expected_velocity_fields:
        if field not in velocity:
            print(f"❌ lease_up_velocity missing field: {field}")
            results.append(False)
        else:
            print(f"✅ lease_up_velocity has field: {field}")
            results.append(True)
    
    # Verify occupancy rate structure
    occupancy = kpis.get("current_occupancy_rate", {})
    expected_occ_fields = ["value_pct", "units_occupied", "units_total", "lower_is_better", "sparkline"]
    for field in expected_occ_fields:
        if field not in occupancy:
            print(f"❌ current_occupancy_rate missing field: {field}")
            results.append(False)
        else:
            print(f"✅ current_occupancy_rate has field: {field}")
            results.append(True)
    
    # Verify upcoming renewals structure
    renewals = kpis.get("upcoming_renewals", {})
    expected_renewal_fields = ["d30", "d60", "d90"]
    for field in expected_renewal_fields:
        if field not in renewals:
            print(f"❌ upcoming_renewals missing field: {field}")
            results.append(False)
        else:
            print(f"✅ upcoming_renewals has field: {field}")
            results.append(True)
    
    # Verify today's action items structure
    action_items = data.get("todays_action_items", {})
    if "tours" not in action_items or "tasks" not in action_items:
        print(f"❌ todays_action_items missing tours or tasks")
        results.append(False)
    else:
        print(f"✅ todays_action_items has tours and tasks")
        results.append(True)
    
    # Verify recent activity is a list
    recent_activity = data.get("recent_activity", [])
    if not isinstance(recent_activity, list):
        print(f"❌ recent_activity is not a list")
        results.append(False)
    else:
        print(f"✅ recent_activity is a list with {len(recent_activity)} items")
        results.append(True)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Shape & Defaults Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_range_variations(session):
    """Test 2: Range parameter variations"""
    print("\n" + "="*60)
    print("TEST 2: Range Variations")
    print("="*60)
    
    results = []
    
    # Test each range parameter
    ranges_to_test = [
        ("7d", "day", 7, 8),    # 7d -> granularity=day, ~7-8 buckets
        ("30d", "day", 30, 31), # 30d -> granularity=day, ~30-31 buckets
        ("90d", "week", 12, 14), # 90d -> granularity=week, ~13 buckets
        ("all", "week", 50, 55)  # all -> granularity=week, ~52 buckets
    ]
    
    for range_param, expected_granularity, min_buckets, max_buckets in ranges_to_test:
        print(f"\n📅 Testing range={range_param}...")
        response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range={range_param}")
        
        if response.status_code != 200:
            print(f"❌ Range {range_param} failed: {response.status_code}")
            results.append(False)
            continue
        
        data = response.json()
        
        # Check granularity
        if data.get("granularity") == expected_granularity:
            print(f"✅ Range {range_param} has correct granularity: {expected_granularity}")
            results.append(True)
        else:
            print(f"❌ Range {range_param} wrong granularity. Expected: {expected_granularity}, Got: {data.get('granularity')}")
            results.append(False)
        
        # Check sparkline length
        sparkline = data.get("kpis", {}).get("new_inquiries", {}).get("sparkline", [])
        sparkline_len = len(sparkline)
        
        if min_buckets <= sparkline_len <= max_buckets:
            print(f"✅ Range {range_param} sparkline length {sparkline_len} is within expected range [{min_buckets}, {max_buckets}]")
            results.append(True)
        else:
            print(f"❌ Range {range_param} sparkline length {sparkline_len} outside expected range [{min_buckets}, {max_buckets}]")
            results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Range Variations Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_validation_errors(session):
    """Test 3: Validation errors"""
    print("\n" + "="*60)
    print("TEST 3: Validation Errors")
    print("="*60)
    
    results = []
    
    # Test invalid range
    print("\n🚫 Testing invalid range...")
    response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=foo")
    if response.status_code == 400:
        print("✅ Invalid range correctly returns 400")
        results.append(True)
    else:
        print(f"❌ Invalid range should return 400, got: {response.status_code}")
        results.append(False)
    
    # Test invalid scope
    print("\n🚫 Testing invalid scope...")
    response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?scope=foo")
    if response.status_code == 400:
        print("✅ Invalid scope correctly returns 400")
        results.append(True)
    else:
        print(f"❌ Invalid scope should return 400, got: {response.status_code}")
        results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Validation Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_authentication(session):
    """Test 4: Authentication requirement"""
    print("\n" + "="*60)
    print("TEST 4: Authentication")
    print("="*60)
    
    results = []
    
    # Test unauthenticated request
    print("\n🔒 Testing unauthenticated access...")
    unauth_session = requests.Session()
    response = unauth_session.get(f"{BASE_URL}/dashboard/leasing-overview")
    if response.status_code == 401:
        print("✅ Unauthenticated request correctly returns 401")
        results.append(True)
    else:
        print(f"❌ Unauthenticated request should return 401, got: {response.status_code}")
        results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Authentication Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_kpi_math_validation(session):
    """Test 5: KPI math validation - create data and verify calculations"""
    print("\n" + "="*60)
    print("TEST 5: KPI Math Validation")
    print("="*60)
    
    results = []
    
    # Get baseline new_inquiries count
    print("\n📊 Getting baseline new_inquiries count...")
    baseline_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
    if baseline_response.status_code != 200:
        print(f"❌ Failed to get baseline: {baseline_response.status_code}")
        return False
    
    baseline_data = baseline_response.json()
    baseline_inquiries = baseline_data.get("kpis", {}).get("new_inquiries", {}).get("value", 0)
    baseline_sparkline = baseline_data.get("kpis", {}).get("new_inquiries", {}).get("sparkline", [])
    baseline_today_value = baseline_sparkline[-1]["value"] if baseline_sparkline else 0
    
    print(f"✅ Baseline new_inquiries: {baseline_inquiries}")
    print(f"✅ Baseline today's sparkline value: {baseline_today_value}")
    
    # Create a test contact first
    print("\n👤 Creating test contact...")
    contact_data = {
        "name": "Test Inquiry Contact",
        "email": generate_unique_email("inquiry.test"),
        "phone": "+1-555-0199"
    }
    contact_response = session.session.post(f"{BASE_URL}/contacts", json=contact_data)
    if contact_response.status_code not in [200, 201]:
        print(f"❌ Contact creation failed: {contact_response.status_code}")
        return False
    
    contact = contact_response.json()
    contact_id = contact["id"]
    print(f"✅ Created test contact: {contact_id}")
    
    # Create a new lease_applications deal (should increment new_inquiries)
    print("\n🏠 Creating test lease_applications deal...")
    deal_data = {
        "title": "Test Inquiry Deal",
        "pipeline_type": "lease_applications",
        "stage": "Inquiry",
        "contact_id": contact_id,
        "desired_rent": 2500
    }
    deal_response = session.session.post(f"{BASE_URL}/deals", json=deal_data)
    if deal_response.status_code not in [200, 201]:
        print(f"❌ Deal creation failed: {deal_response.status_code} - {deal_response.text}")
        results.append(False)
    else:
        deal = deal_response.json()
        deal_id = deal["id"]
        print(f"✅ Created test deal: {deal_id}")
        results.append(True)
        
        # Wait a moment for data consistency
        time.sleep(2)
        
        # Check updated new_inquiries count
        print("\n📈 Checking updated new_inquiries count...")
        updated_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
        if updated_response.status_code == 200:
            updated_data = updated_response.json()
            updated_inquiries = updated_data.get("kpis", {}).get("new_inquiries", {}).get("value", 0)
            updated_sparkline = updated_data.get("kpis", {}).get("new_inquiries", {}).get("sparkline", [])
            updated_today_value = updated_sparkline[-1]["value"] if updated_sparkline else 0
            
            if updated_inquiries == baseline_inquiries + 1:
                print(f"✅ new_inquiries incremented correctly: {baseline_inquiries} → {updated_inquiries}")
                results.append(True)
            else:
                print(f"❌ new_inquiries not incremented. Expected: {baseline_inquiries + 1}, Got: {updated_inquiries}")
                results.append(False)
            
            if updated_today_value == baseline_today_value + 1:
                print(f"✅ Today's sparkline incremented correctly: {baseline_today_value} → {updated_today_value}")
                results.append(True)
            else:
                print(f"❌ Today's sparkline not incremented. Expected: {baseline_today_value + 1}, Got: {updated_today_value}")
                results.append(False)
            
            # Check growth percentage
            growth_pct = updated_data.get("kpis", {}).get("new_inquiries", {}).get("growth_pct", 0)
            if growth_pct > 0:  # Should be positive since current > previous
                print(f"✅ Growth percentage is positive: {growth_pct}%")
                results.append(True)
            else:
                print(f"❌ Growth percentage should be positive, got: {growth_pct}%")
                results.append(False)
        else:
            print(f"❌ Failed to get updated data: {updated_response.status_code}")
            results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 KPI Math Validation Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_speed_to_first_contact(session):
    """Test 6: Speed to first contact calculation"""
    print("\n" + "="*60)
    print("TEST 6: Speed to First Contact")
    print("="*60)
    
    results = []
    
    # Get baseline
    print("\n📊 Getting baseline speed to first contact...")
    baseline_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
    if baseline_response.status_code != 200:
        print(f"❌ Failed to get baseline: {baseline_response.status_code}")
        return False
    
    baseline_data = baseline_response.json()
    baseline_sample_size = baseline_data.get("kpis", {}).get("avg_speed_to_first_contact", {}).get("sample_size", 0)
    print(f"✅ Baseline sample size: {baseline_sample_size}")
    
    # Create a fresh contact
    print("\n👤 Creating fresh contact...")
    contact_data = {
        "name": "Speed Test Contact",
        "email": generate_unique_email("speed.test"),
        "phone": "+1-555-0188"
    }
    contact_response = session.session.post(f"{BASE_URL}/contacts", json=contact_data)
    if contact_response.status_code not in [200, 201]:
        print(f"❌ Contact creation failed: {contact_response.status_code}")
        return False
    
    contact = contact_response.json()
    contact_id = contact["id"]
    print(f"✅ Created fresh contact: {contact_id}")
    
    # Wait a moment, then create an activity (simulating quick response)
    time.sleep(1)
    
    print("\n📞 Creating activity for speed test...")
    activity_data = {
        "contact_id": contact_id,
        "activity_type": "call",
        "description": "Quick follow-up call for speed test"
    }
    activity_response = session.session.post(f"{BASE_URL}/activities", json=activity_data)
    if activity_response.status_code not in [200, 201]:
        print(f"❌ Activity creation failed: {activity_response.status_code} - {activity_response.text}")
        results.append(False)
    else:
        print(f"✅ Created activity")
        results.append(True)
        
        # Wait for data consistency
        time.sleep(2)
        
        # Check updated speed to first contact
        print("\n⏱️ Checking updated speed to first contact...")
        updated_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
        if updated_response.status_code == 200:
            updated_data = updated_response.json()
            speed_data = updated_data.get("kpis", {}).get("avg_speed_to_first_contact", {})
            updated_sample_size = speed_data.get("sample_size", 0)
            value_hours = speed_data.get("value_hours", 0)
            
            if updated_sample_size == baseline_sample_size + 1:
                print(f"✅ Sample size incremented: {baseline_sample_size} → {updated_sample_size}")
                results.append(True)
            else:
                print(f"❌ Sample size not incremented. Expected: {baseline_sample_size + 1}, Got: {updated_sample_size}")
                results.append(False)
            
            if value_hours < 1:  # Should be very small since we responded quickly
                print(f"✅ Speed to first contact is reasonable: {value_hours} hours")
                results.append(True)
            else:
                print(f"❌ Speed to first contact seems high: {value_hours} hours")
                results.append(False)
        else:
            print(f"❌ Failed to get updated data: {updated_response.status_code}")
            results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Speed to First Contact Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_lease_up_velocity(session):
    """Test 7: Lease-up velocity calculation"""
    print("\n" + "="*60)
    print("TEST 7: Lease-Up Velocity")
    print("="*60)
    
    results = []
    
    # Get baseline
    print("\n📊 Getting baseline lease-up velocity...")
    baseline_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
    if baseline_response.status_code != 200:
        print(f"❌ Failed to get baseline: {baseline_response.status_code}")
        return False
    
    baseline_data = baseline_response.json()
    baseline_sample_size = baseline_data.get("kpis", {}).get("lease_up_velocity", {}).get("sample_size", 0)
    print(f"✅ Baseline sample size: {baseline_sample_size}")
    
    # Create a contact and deal
    print("\n👤 Creating contact for velocity test...")
    contact_data = {
        "name": "Velocity Test Contact",
        "email": generate_unique_email("velocity.test"),
        "phone": "+1-555-0177"
    }
    contact_response = session.session.post(f"{BASE_URL}/contacts", json=contact_data)
    if contact_response.status_code not in [200, 201]:
        print(f"❌ Contact creation failed: {contact_response.status_code}")
        return False
    
    contact = contact_response.json()
    contact_id = contact["id"]
    print(f"✅ Created contact: {contact_id}")
    
    # Create a deal
    print("\n🏠 Creating deal for velocity test...")
    deal_data = {
        "title": "Velocity Test Deal",
        "pipeline_type": "lease_applications",
        "stage": "Inquiry",
        "contact_id": contact_id,
        "desired_rent": 2000
    }
    deal_response = session.session.post(f"{BASE_URL}/deals", json=deal_data)
    if deal_response.status_code not in [200, 201]:
        print(f"❌ Deal creation failed: {deal_response.status_code}")
        return False
    
    deal = deal_response.json()
    deal_id = deal["id"]
    print(f"✅ Created deal: {deal_id}")
    
    # Update deal to "Lease Signed" stage
    print("\n📝 Moving deal to 'Lease Signed' stage...")
    update_data = {"stage": "Lease Signed"}
    update_response = session.session.put(f"{BASE_URL}/deals/{deal_id}", json=update_data)
    if update_response.status_code != 200:
        print(f"❌ Deal update failed: {update_response.status_code} - {update_response.text}")
        results.append(False)
    else:
        print(f"✅ Deal moved to 'Lease Signed'")
        results.append(True)
        
        # Wait for data consistency
        time.sleep(2)
        
        # Check updated lease-up velocity
        print("\n📈 Checking updated lease-up velocity...")
        updated_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
        if updated_response.status_code == 200:
            updated_data = updated_response.json()
            velocity_data = updated_data.get("kpis", {}).get("lease_up_velocity", {})
            updated_sample_size = velocity_data.get("sample_size", 0)
            value_days = velocity_data.get("value_days", 0)
            
            if updated_sample_size >= baseline_sample_size + 1:
                print(f"✅ Sample size incremented: {baseline_sample_size} → {updated_sample_size}")
                results.append(True)
            else:
                print(f"❌ Sample size not incremented. Expected: >= {baseline_sample_size + 1}, Got: {updated_sample_size}")
                results.append(False)
            
            if value_days >= 0:  # Should be a reasonable number of days
                print(f"✅ Lease-up velocity is reasonable: {value_days} days")
                results.append(True)
            else:
                print(f"❌ Lease-up velocity seems invalid: {value_days} days")
                results.append(False)
        else:
            print(f"❌ Failed to get updated data: {updated_response.status_code}")
            results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Lease-Up Velocity Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_occupancy_rate(session):
    """Test 8: Occupancy rate calculation"""
    print("\n" + "="*60)
    print("TEST 8: Occupancy Rate")
    print("="*60)
    
    results = []
    
    # Get baseline occupancy
    print("\n📊 Getting baseline occupancy rate...")
    baseline_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
    if baseline_response.status_code != 200:
        print(f"❌ Failed to get baseline: {baseline_response.status_code}")
        return False
    
    baseline_data = baseline_response.json()
    occupancy_data = baseline_data.get("kpis", {}).get("current_occupancy_rate", {})
    baseline_occupied = occupancy_data.get("units_occupied", 0)
    baseline_total = occupancy_data.get("units_total", 0)
    baseline_pct = occupancy_data.get("value_pct", 0)
    
    print(f"✅ Baseline occupancy: {baseline_occupied}/{baseline_total} = {baseline_pct}%")
    
    # Create a contact for lease test
    print("\n👤 Creating contact for lease test...")
    contact_data = {
        "name": "Occupancy Test Contact",
        "email": generate_unique_email("occupancy.test"),
        "phone": "+1-555-0166"
    }
    contact_response = session.session.post(f"{BASE_URL}/contacts", json=contact_data)
    if contact_response.status_code not in [200, 201]:
        print(f"❌ Contact creation failed: {contact_response.status_code}")
        return False
    
    contact = contact_response.json()
    contact_id = contact["id"]
    print(f"✅ Created contact: {contact_id}")
    
    # Create an active lease
    print("\n🏠 Creating active lease...")
    today = datetime.now(timezone.utc).date()
    lease_end = (today + timedelta(days=365)).isoformat()
    
    lease_data = {
        "contact_id": contact_id,
        "unit_number": "Test-101",
        "monthly_rent": 1800,
        "lease_start": today.isoformat(),
        "lease_end": lease_end,
        "status": "active"
    }
    lease_response = session.session.post(f"{BASE_URL}/contacts/{contact_id}/lease", json=lease_data)
    if lease_response.status_code not in [200, 201]:
        print(f"❌ Lease creation failed: {lease_response.status_code} - {lease_response.text}")
        results.append(False)
    else:
        print(f"✅ Created active lease")
        results.append(True)
        
        # Wait for data consistency
        time.sleep(2)
        
        # Check updated occupancy rate
        print("\n📈 Checking updated occupancy rate...")
        updated_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
        if updated_response.status_code == 200:
            updated_data = updated_response.json()
            updated_occupancy = updated_data.get("kpis", {}).get("current_occupancy_rate", {})
            updated_occupied = updated_occupancy.get("units_occupied", 0)
            updated_total = updated_occupancy.get("units_total", 0)
            updated_pct = updated_occupancy.get("value_pct", 0)
            
            if updated_total > baseline_total:
                print(f"✅ Total units increased: {baseline_total} → {updated_total}")
                results.append(True)
            else:
                print(f"❌ Total units not increased. Expected: > {baseline_total}, Got: {updated_total}")
                results.append(False)
            
            if updated_occupied > baseline_occupied:
                print(f"✅ Occupied units increased: {baseline_occupied} → {updated_occupied}")
                results.append(True)
            else:
                print(f"❌ Occupied units not increased. Expected: > {baseline_occupied}, Got: {updated_occupied}")
                results.append(False)
            
            # If we only have 1 lease and it's active, occupancy should be 100%
            if updated_total == 1 and updated_occupied == 1:
                if updated_pct == 100.0:
                    print(f"✅ Occupancy rate is 100% with 1 active lease")
                    results.append(True)
                else:
                    print(f"❌ Expected 100% occupancy with 1 active lease, got: {updated_pct}%")
                    results.append(False)
            else:
                print(f"✅ Occupancy rate calculated: {updated_occupied}/{updated_total} = {updated_pct}%")
                results.append(True)
        else:
            print(f"❌ Failed to get updated data: {updated_response.status_code}")
            results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Occupancy Rate Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_upcoming_renewals(session):
    """Test 9: Upcoming renewals calculation"""
    print("\n" + "="*60)
    print("TEST 9: Upcoming Renewals")
    print("="*60)
    
    results = []
    
    # Get baseline renewals
    print("\n📊 Getting baseline upcoming renewals...")
    baseline_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
    if baseline_response.status_code != 200:
        print(f"❌ Failed to get baseline: {baseline_response.status_code}")
        return False
    
    baseline_data = baseline_response.json()
    renewals_data = baseline_data.get("kpis", {}).get("upcoming_renewals", {})
    baseline_d30 = renewals_data.get("d30", {})
    baseline_d60 = renewals_data.get("d60", {})
    baseline_d90 = renewals_data.get("d90", {})
    
    print(f"✅ Baseline d30 renewals: {baseline_d30}")
    print(f"✅ Baseline d60 renewals: {baseline_d60}")
    print(f"✅ Baseline d90 renewals: {baseline_d90}")
    
    # Create a contact for renewal test
    print("\n👤 Creating contact for renewal test...")
    contact_data = {
        "name": "Renewal Test Contact",
        "email": generate_unique_email("renewal.test"),
        "phone": "+1-555-0155"
    }
    contact_response = session.session.post(f"{BASE_URL}/contacts", json=contact_data)
    if contact_response.status_code not in [200, 201]:
        print(f"❌ Contact creation failed: {contact_response.status_code}")
        return False
    
    contact = contact_response.json()
    contact_id = contact["id"]
    print(f"✅ Created contact: {contact_id}")
    
    # Create an active lease with lease_end = today + 20 days (within 30 days)
    print("\n🏠 Creating lease expiring in 20 days...")
    today = datetime.now(timezone.utc).date()
    lease_end = (today + timedelta(days=20)).isoformat()
    
    lease_data = {
        "contact_id": contact_id,
        "unit_number": "Renewal-201",
        "monthly_rent": 1800,
        "lease_start": (today - timedelta(days=345)).isoformat(),
        "lease_end": lease_end,
        "status": "active"
    }
    lease_response = session.session.post(f"{BASE_URL}/contacts/{contact_id}/lease", json=lease_data)
    if lease_response.status_code not in [200, 201]:
        print(f"❌ Lease creation failed: {lease_response.status_code} - {lease_response.text}")
        results.append(False)
    else:
        print(f"✅ Created lease expiring in 20 days")
        results.append(True)
        
        # Wait for data consistency
        time.sleep(2)
        
        # Check updated renewals
        print("\n📈 Checking updated upcoming renewals...")
        updated_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
        if updated_response.status_code == 200:
            updated_data = updated_response.json()
            updated_renewals = updated_data.get("kpis", {}).get("upcoming_renewals", {})
            updated_d30 = updated_renewals.get("d30", {})
            updated_d60 = updated_renewals.get("d60", {})
            updated_d90 = updated_renewals.get("d90", {})
            
            # d30 should include our lease (within 30 days)
            d30_count = updated_d30.get("count", 0)
            d30_rent = updated_d30.get("monthly_rent_total", 0)
            baseline_d30_count = baseline_d30.get("count", 0)
            baseline_d30_rent = baseline_d30.get("monthly_rent_total", 0)
            
            if d30_count == baseline_d30_count + 1:
                print(f"✅ d30 count incremented: {baseline_d30_count} → {d30_count}")
                results.append(True)
            else:
                print(f"❌ d30 count not incremented. Expected: {baseline_d30_count + 1}, Got: {d30_count}")
                results.append(False)
            
            if d30_rent == baseline_d30_rent + 1800:
                print(f"✅ d30 rent incremented: ${baseline_d30_rent} → ${d30_rent}")
                results.append(True)
            else:
                print(f"❌ d30 rent not incremented. Expected: ${baseline_d30_rent + 1800}, Got: ${d30_rent}")
                results.append(False)
            
            # d60 and d90 should also include our lease (since it's within all windows)
            d60_count = updated_d60.get("count", 0)
            d90_count = updated_d90.get("count", 0)
            baseline_d60_count = baseline_d60.get("count", 0)
            baseline_d90_count = baseline_d90.get("count", 0)
            
            if d60_count >= baseline_d60_count + 1:
                print(f"✅ d60 count includes lease: {baseline_d60_count} → {d60_count}")
                results.append(True)
            else:
                print(f"❌ d60 count should include lease. Expected: >= {baseline_d60_count + 1}, Got: {d60_count}")
                results.append(False)
            
            if d90_count >= baseline_d90_count + 1:
                print(f"✅ d90 count includes lease: {baseline_d90_count} → {d90_count}")
                results.append(True)
            else:
                print(f"❌ d90 count should include lease. Expected: >= {baseline_d90_count + 1}, Got: {d90_count}")
                results.append(False)
        else:
            print(f"❌ Failed to get updated data: {updated_response.status_code}")
            results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Upcoming Renewals Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_todays_action_items(session):
    """Test 10: Today's action items (tours and tasks)"""
    print("\n" + "="*60)
    print("TEST 10: Today's Action Items")
    print("="*60)
    
    results = []
    
    # Get baseline action items
    print("\n📊 Getting baseline action items...")
    baseline_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
    if baseline_response.status_code != 200:
        print(f"❌ Failed to get baseline: {baseline_response.status_code}")
        return False
    
    baseline_data = baseline_response.json()
    baseline_tours = len(baseline_data.get("todays_action_items", {}).get("tours", []))
    baseline_tasks = len(baseline_data.get("todays_action_items", {}).get("tasks", []))
    
    print(f"✅ Baseline tours: {baseline_tours}")
    print(f"✅ Baseline tasks: {baseline_tasks}")
    
    # Create a contact for action items test
    print("\n👤 Creating contact for action items test...")
    contact_data = {
        "name": "Action Items Test Contact",
        "email": generate_unique_email("action.test"),
        "phone": "+1-555-0144"
    }
    contact_response = session.session.post(f"{BASE_URL}/contacts", json=contact_data)
    if contact_response.status_code not in [200, 201]:
        print(f"❌ Contact creation failed: {contact_response.status_code}")
        return False
    
    contact = contact_response.json()
    contact_id = contact["id"]
    print(f"✅ Created contact: {contact_id}")
    
    # Create a calendar event for today (tour)
    print("\n📅 Creating calendar event for today...")
    today = datetime.now(timezone.utc)
    today_start = today.replace(hour=14, minute=0, second=0, microsecond=0)  # 2 PM today
    today_end = today_start + timedelta(hours=1)
    
    event_data = {
        "title": "Property Tour",
        "start": today_start.isoformat(),
        "end": today_end.isoformat(),
        "location": "123 Test St",
        "event_type": "tour",
        "contact_id": contact_id
    }
    event_response = session.session.post(f"{BASE_URL}/contacts/{contact_id}/events", json=event_data)
    if event_response.status_code not in [200, 201]:
        print(f"❌ Event creation failed: {event_response.status_code} - {event_response.text}")
        results.append(False)
    else:
        print(f"✅ Created calendar event for today")
        results.append(True)
    
    # Create a task due today
    print("\n📋 Creating task due today...")
    today_date = today.date().isoformat()
    
    task_data = {
        "title": "Follow up with prospect",
        "description": "Call to schedule tour",
        "due_date": today_date,
        "contact_id": contact_id,
        "priority": "high",
        "completed": False
    }
    task_response = session.session.post(f"{BASE_URL}/tasks", json=task_data)
    if task_response.status_code not in [200, 201]:
        print(f"❌ Task creation failed: {task_response.status_code} - {task_response.text}")
        results.append(False)
    else:
        print(f"✅ Created task due today")
        results.append(True)
    
    # Wait for data consistency
    time.sleep(2)
    
    # Check updated action items
    print("\n📈 Checking updated action items...")
    updated_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
    if updated_response.status_code == 200:
        updated_data = updated_response.json()
        action_items = updated_data.get("todays_action_items", {})
        updated_tours = action_items.get("tours", [])
        updated_tasks = action_items.get("tasks", [])
        
        # Check tours
        if len(updated_tours) == baseline_tours + 1:
            print(f"✅ Tours count incremented: {baseline_tours} → {len(updated_tours)}")
            results.append(True)
            
            # Check if our tour appears in the list
            our_tour = next((t for t in updated_tours if t.get("contact_id") == contact_id), None)
            if our_tour:
                print(f"✅ Our tour appears in tours list: {our_tour.get('title')}")
                results.append(True)
            else:
                print(f"❌ Our tour not found in tours list")
                results.append(False)
        else:
            print(f"❌ Tours count not incremented. Expected: {baseline_tours + 1}, Got: {len(updated_tours)}")
            results.append(False)
        
        # Check tasks
        if len(updated_tasks) == baseline_tasks + 1:
            print(f"✅ Tasks count incremented: {baseline_tasks} → {len(updated_tasks)}")
            results.append(True)
            
            # Check if our task appears in the list
            our_task = next((t for t in updated_tasks if t.get("contact_id") == contact_id), None)
            if our_task:
                print(f"✅ Our task appears in tasks list: {our_task.get('title')}")
                results.append(True)
                
                # Check if tasks are sorted by priority (high first)
                if our_task.get("priority") == "high" and updated_tasks[0].get("priority") == "high":
                    print(f"✅ Tasks are sorted by priority (high first)")
                    results.append(True)
                else:
                    print(f"❌ Tasks not properly sorted by priority")
                    results.append(False)
            else:
                print(f"❌ Our task not found in tasks list")
                results.append(False)
        else:
            print(f"❌ Tasks count not incremented. Expected: {baseline_tasks + 1}, Got: {len(updated_tasks)}")
            results.append(False)
    else:
        print(f"❌ Failed to get updated data: {updated_response.status_code}")
        results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Today's Action Items Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_recent_activity_enrichment(session):
    """Test 11: Recent activity enrichment"""
    print("\n" + "="*60)
    print("TEST 11: Recent Activity Enrichment")
    print("="*60)
    
    results = []
    
    # Create a contact for activity test
    print("\n👤 Creating contact for activity test...")
    contact_data = {
        "name": "Activity Test Contact",
        "email": generate_unique_email("activity.test"),
        "phone": "+1-555-0133",
        "leasing_stage": "Tour Scheduled"
    }
    contact_response = session.session.post(f"{BASE_URL}/contacts", json=contact_data)
    if contact_response.status_code not in [200, 201]:
        print(f"❌ Contact creation failed: {contact_response.status_code}")
        return False
    
    contact = contact_response.json()
    contact_id = contact["id"]
    print(f"✅ Created contact: {contact_id}")
    
    # Create a deal with unit information
    print("\n🏠 Creating deal with unit info...")
    deal_data = {
        "title": "Activity Test Deal",
        "pipeline_type": "lease_applications",
        "stage": "Application Submitted",
        "contact_id": contact_id,
        "unit_number": "Unit-301",
        "unit_address": "123 Test Building, Unit 301",
        "desired_rent": 2200
    }
    deal_response = session.session.post(f"{BASE_URL}/deals", json=deal_data)
    if deal_response.status_code not in [200, 201]:
        print(f"❌ Deal creation failed: {deal_response.status_code}")
        return False
    
    deal = deal_response.json()
    deal_id = deal["id"]
    print(f"✅ Created deal: {deal_id}")
    
    # Create an activity
    print("\n📝 Creating activity...")
    activity_data = {
        "contact_id": contact_id,
        "activity_type": "call",
        "description": "Discussed application status and next steps"
    }
    activity_response = session.session.post(f"{BASE_URL}/activities", json=activity_data)
    if activity_response.status_code not in [200, 201]:
        print(f"❌ Activity creation failed: {activity_response.status_code} - {activity_response.text}")
        results.append(False)
    else:
        print(f"✅ Created activity")
        results.append(True)
        
        # Wait for data consistency
        time.sleep(2)
        
        # Check recent activity enrichment
        print("\n📈 Checking recent activity enrichment...")
        response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?range=30d")
        if response.status_code == 200:
            data = response.json()
            recent_activities = data.get("recent_activity", [])
            
            # Find our activity
            our_activity = next((a for a in recent_activities if a.get("contact_id") == contact_id), None)
            if our_activity:
                print(f"✅ Our activity found in recent activity list")
                results.append(True)
                
                # Check enrichment fields
                enrichment_checks = [
                    ("contact_name", "Activity Test Contact"),
                    ("contact_email", contact_data["email"]),
                    ("contact_phone", "+1-555-0133"),
                    ("stage", "Application Submitted"),  # Should come from deal stage
                    ("unit", "Unit-301"),  # Should come from deal unit_number
                ]
                
                for field, expected in enrichment_checks:
                    actual = our_activity.get(field, "")
                    if expected in actual or actual == expected:
                        print(f"✅ {field} enriched correctly: {actual}")
                        results.append(True)
                    else:
                        print(f"❌ {field} not enriched correctly. Expected: {expected}, Got: {actual}")
                        results.append(False)
                
                # Check assigned_to_name (should be the current user's name)
                assigned_to = our_activity.get("assigned_to_name", "")
                if assigned_to:
                    print(f"✅ assigned_to_name enriched: {assigned_to}")
                    results.append(True)
                else:
                    print(f"❌ assigned_to_name not enriched")
                    results.append(False)
            else:
                print(f"❌ Our activity not found in recent activity list")
                results.append(False)
        else:
            print(f"❌ Failed to get data: {response.status_code}")
            results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Recent Activity Enrichment Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def test_scope_parameter(session):
    """Test 12: Scope parameter (me vs everyone)"""
    print("\n" + "="*60)
    print("TEST 12: Scope Parameter")
    print("="*60)
    
    results = []
    
    # Test scope=me
    print("\n👤 Testing scope=me...")
    me_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?scope=me")
    if me_response.status_code == 200:
        me_data = me_response.json()
        if me_data.get("scope") == "me":
            print("✅ scope=me returns correct scope in response")
            results.append(True)
        else:
            print(f"❌ scope=me wrong scope in response: {me_data.get('scope')}")
            results.append(False)
    else:
        print(f"❌ scope=me failed: {me_response.status_code}")
        results.append(False)
    
    # Test scope=everyone
    print("\n👥 Testing scope=everyone...")
    everyone_response = session.session.get(f"{BASE_URL}/dashboard/leasing-overview?scope=everyone")
    if everyone_response.status_code == 200:
        everyone_data = everyone_response.json()
        if everyone_data.get("scope") == "everyone":
            print("✅ scope=everyone returns correct scope in response")
            results.append(True)
        else:
            print(f"❌ scope=everyone wrong scope in response: {everyone_data.get('scope')}")
            results.append(False)
        
        # Compare data - everyone scope should include same or more data than me scope
        me_inquiries = me_data.get("kpis", {}).get("new_inquiries", {}).get("value", 0)
        everyone_inquiries = everyone_data.get("kpis", {}).get("new_inquiries", {}).get("value", 0)
        
        if everyone_inquiries >= me_inquiries:
            print(f"✅ scope=everyone includes same or more data: me={me_inquiries}, everyone={everyone_inquiries}")
            results.append(True)
        else:
            print(f"❌ scope=everyone has less data than me: me={me_inquiries}, everyone={everyone_inquiries}")
            results.append(False)
    else:
        print(f"❌ scope=everyone failed: {everyone_response.status_code}")
        results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"\n📈 Scope Parameter Test Results: {sum(results)}/{len(results)} ({success_rate:.1f}%)")
    return all(results)

def main():
    """Run all Phase 11 backend tests"""
    print("🚀 Starting Phase 11 Backend Testing - Dashboard Leasing Overview")
    print("="*80)
    
    # Initialize session and login
    session = TestSession()
    if not session.login():
        print("❌ Authentication failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run all tests
    test_results = {}
    
    try:
        test_results["shape_and_defaults"] = test_leasing_overview_shape_and_defaults(session)
        test_results["range_variations"] = test_range_variations(session)
        test_results["validation_errors"] = test_validation_errors(session)
        test_results["authentication"] = test_authentication(session)
        test_results["kpi_math_validation"] = test_kpi_math_validation(session)
        test_results["speed_to_first_contact"] = test_speed_to_first_contact(session)
        test_results["lease_up_velocity"] = test_lease_up_velocity(session)
        test_results["occupancy_rate"] = test_occupancy_rate(session)
        test_results["upcoming_renewals"] = test_upcoming_renewals(session)
        test_results["todays_action_items"] = test_todays_action_items(session)
        test_results["recent_activity_enrichment"] = test_recent_activity_enrichment(session)
        test_results["scope_parameter"] = test_scope_parameter(session)
        
    except Exception as e:
        print(f"\n❌ Test execution failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Final summary
    print("\n" + "="*80)
    print("FINAL TEST SUMMARY - PHASE 11 DASHBOARD LEASING OVERVIEW")
    print("="*80)
    
    total_tests = len(test_results)
    passed_tests = sum(test_results.values())
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    success_rate = (passed_tests / total_tests) * 100
    print(f"\nOverall Results: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")
    
    if passed_tests == total_tests:
        print("\n🎉 ALL TESTS PASSED! Phase 11 dashboard leasing overview endpoint is working correctly.")
        return True
    else:
        print(f"\n⚠️  {total_tests - passed_tests} test(s) failed. Please review the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)