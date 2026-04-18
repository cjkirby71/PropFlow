#!/usr/bin/env python3
"""
Focused test for specific issues found in regression testing
"""

import asyncio
import aiohttp
import json

BASE_URL = "https://drip-sequences.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@propflow.com"
ADMIN_PASSWORD = "admin123"

async def test_specific_issues():
    jar = aiohttp.CookieJar(unsafe=True)
    async with aiohttp.ClientSession(cookie_jar=jar, timeout=aiohttp.ClientTimeout(total=30)) as session:
        
        # Login first
        print("1. Logging in...")
        async with session.post(f"{BASE_URL}/auth/login", 
                               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}) as response:
            if response.status == 200:
                print("✅ Login successful")
            else:
                print(f"❌ Login failed: {response.status}")
                return
        
        # Test 1: Security Headers
        print("\n2. Testing Security Headers...")
        async with session.get(f"{BASE_URL}/auth/me") as response:
            headers = response.headers
            print(f"Permissions-Policy header: {headers.get('Permissions-Policy', 'MISSING')}")
            expected = "geolocation=(), microphone=(), camera=()"
            actual = headers.get('Permissions-Policy', '')
            if actual == expected:
                print("✅ Permissions-Policy header correct")
            else:
                print(f"❌ Permissions-Policy mismatch. Expected: {expected}, Got: {actual}")
        
        # Test 2: Input Validation - Invalid Email
        print("\n3. Testing Input Validation - Invalid Email...")
        async with session.post(f"{BASE_URL}/contacts", 
                               json={"name": "Test", "email": "invalid-email", "property_type": "residential_lease"}) as response:
            print(f"Status: {response.status}")
            if response.status == 422:
                print("✅ Invalid email properly rejected")
            else:
                response_data = await response.json()
                print(f"❌ Invalid email accepted. Response: {response_data}")
        
        # Test 3: Error Response Security - Invalid Contact ID
        print("\n4. Testing Error Response Security...")
        async with session.get(f"{BASE_URL}/contacts/invalid_id") as response:
            print(f"Status: {response.status}")
            if response.status == 404:
                response_data = await response.json()
                response_str = str(response_data).lower()
                stack_trace_indicators = ["traceback", "file \"", "line ", "in ", "raise", "exception"]
                has_stack_trace = any(indicator in response_str for indicator in stack_trace_indicators)
                
                if not has_stack_trace:
                    print("✅ No stack traces in error responses")
                else:
                    print(f"❌ Stack trace found in error: {response_data}")
            else:
                print(f"❌ Unexpected status: {response.status}")

if __name__ == "__main__":
    asyncio.run(test_specific_issues())