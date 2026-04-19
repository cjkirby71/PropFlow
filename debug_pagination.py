#!/usr/bin/env python3
"""
Debug pagination responses to understand the total_pages calculation issue
"""

import asyncio
import aiohttp
import json

BASE_URL = "https://propflow-crm-3.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@propflow.com"
ADMIN_PASSWORD = "admin123"

async def debug_pagination():
    jar = aiohttp.CookieJar(unsafe=True)
    async with aiohttp.ClientSession(cookie_jar=jar, timeout=aiohttp.ClientTimeout(total=30)) as session:
        # Login first
        async with session.post(f"{BASE_URL}/auth/login", 
                               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}) as response:
            if response.status != 200:
                print("Login failed")
                return
            print("✅ Logged in successfully")
        
        # Test endpoints that are failing
        endpoints = [
            "/properties?page=1&limit=50",
            "/deals?page=1&limit=50", 
            "/tasks?page=1&limit=50",
            "/activities?page=1&limit=50",
            "/templates?page=1&limit=50",
            "/webhooks?page=1&limit=50",
            "/api-keys?page=1&limit=50"
        ]
        
        for endpoint in endpoints:
            async with session.get(f"{BASE_URL}{endpoint}") as response:
                data = await response.json()
                print(f"\n{endpoint}:")
                print(f"Status: {response.status}")
                print(f"Response: {json.dumps(data, indent=2)}")

if __name__ == "__main__":
    asyncio.run(debug_pagination())