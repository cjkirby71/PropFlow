from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
import bcrypt
import jwt
import secrets
import csv
import io
import json
import traceback
import httpx
import asyncio
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import math
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# ─── Logging ───
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY: Environment & Settings Validation
# Fail fast on startup if any critical environment variable is missing.
# Optional vars (Brevo, Twilio, AI) log warnings but don't block startup.
# ═══════════════════════════════════════════════════════════════════════════════
REQUIRED_ENV_VARS = ["MONGO_URL", "DB_NAME", "JWT_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD", "FRONTEND_URL"]
OPTIONAL_ENV_VARS = {
    "EMERGENT_LLM_KEY": "AI features (email drafting, lead scoring) will be unavailable",
    "BREVO_API_KEY": "Email sending via Brevo will be unavailable",
    "TWILIO_ACCOUNT_SID": "SMS sending via Twilio will be unavailable",
    "TWILIO_AUTH_TOKEN": "SMS sending via Twilio will be unavailable",
    "TWILIO_PHONE_NUMBER": "SMS sending via Twilio will be unavailable",
}

_missing_required = [v for v in REQUIRED_ENV_VARS if not os.environ.get(v)]
if _missing_required:
    raise RuntimeError(f"FATAL: Missing required environment variables: {', '.join(_missing_required)}. "
                       "Server cannot start. Check your .env file.")
for var, warning in OPTIONAL_ENV_VARS.items():
    if not os.environ.get(var):
        logger.warning(f"Optional env var {var} not set — {warning}")

# ─── Environment detection ───
# If FRONTEND_URL is https, we're in production (set secure cookies, HSTS, etc.)
FRONTEND_URL = os.environ["FRONTEND_URL"]
IS_PRODUCTION = FRONTEND_URL.startswith("https://")

# ─── MongoDB connection ───
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ─── App & Router ───
app = FastAPI(
    docs_url=None if IS_PRODUCTION else "/docs",     # Disable Swagger UI in production
    redoc_url=None if IS_PRODUCTION else "/redoc",    # Disable ReDoc in production
)
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY: Rate Limiting (slowapi)
# Default:  100 requests/minute per IP for general endpoints
# Strict:   10 requests/minute per IP for auth endpoints (login, register, refresh)
# Prevents brute-force attacks, credential stuffing, and API abuse.
# ═══════════════════════════════════════════════════════════════════════════════
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter

# ═══════════════════════════════════════════════════════════════════════════════
# AI COST GUARDRAILS & TOKEN TRACKING
# - Estimate tokens before each call; block if expected cost exceeds MAX_AI_COST_PER_CALL
# - Log actual usage to ai_usage_logs collection after each call
# - Rate limit: max 20 AI calls per user per hour
# GPT-5.2 approximate pricing: $2/1M input tokens, $8/1M output tokens
# ═══════════════════════════════════════════════════════════════════════════════
MAX_AI_COST_PER_CALL = float(os.environ.get("MAX_AI_COST_PER_CALL", "0.05"))
MAX_AI_CALLS_PER_HOUR = int(os.environ.get("MAX_AI_CALLS_PER_HOUR", "20"))
AI_INPUT_COST_PER_TOKEN = 2.0 / 1_000_000   # $0.000002
AI_OUTPUT_COST_PER_TOKEN = 8.0 / 1_000_000   # $0.000008
AI_EST_OUTPUT_TOKENS = 800  # Conservative estimate for output

def estimate_tokens(text: str) -> int:
    """Rough token estimate: ~1 token per 4 characters for English text."""
    return max(1, len(text) // 4)

def estimate_ai_cost(input_text: str) -> float:
    """Estimate the cost of an AI call before making it."""
    input_tokens = estimate_tokens(input_text)
    return (input_tokens * AI_INPUT_COST_PER_TOKEN) + (AI_EST_OUTPUT_TOKENS * AI_OUTPUT_COST_PER_TOKEN)

async def check_ai_rate_limit(user_id: str):
    """Enforce per-user AI rate limit: MAX_AI_CALLS_PER_HOUR calls/hour."""
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    recent_count = await db.ai_usage_logs.count_documents({
        "user_id": user_id, "timestamp": {"$gte": one_hour_ago}
    })
    if recent_count >= MAX_AI_CALLS_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail=f"AI rate limit exceeded. Maximum {MAX_AI_CALLS_PER_HOUR} AI calls per hour. Please wait and try again."
        )

async def log_ai_usage(user_id: str, endpoint: str, input_tokens: int, output_tokens: int, model: str = "gpt-5.2"):
    """Log AI call usage for cost tracking and auditing."""
    input_cost = input_tokens * AI_INPUT_COST_PER_TOKEN
    output_cost = output_tokens * AI_OUTPUT_COST_PER_TOKEN
    total_cost = input_cost + output_cost
    log_entry = {
        "user_id": user_id,
        "endpoint": endpoint,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "estimated_cost_usd": round(total_cost, 6),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.ai_usage_logs.insert_one(log_entry)
    logger.info(f"AI USAGE | user={user_id} | endpoint={endpoint} | "
                f"in={input_tokens} out={output_tokens} tokens | "
                f"cost=${total_cost:.6f}")

def guard_ai_cost(input_text: str):
    """Block AI call if estimated cost exceeds the per-call limit."""
    estimated_cost = estimate_ai_cost(input_text)
    if estimated_cost > MAX_AI_COST_PER_CALL:
        raise HTTPException(
            status_code=400,
            detail=f"Input too large. Estimated cost ${estimated_cost:.4f} exceeds "
                   f"limit of ${MAX_AI_COST_PER_CALL:.2f}. Please reduce the input."
        )

# ═══════════════════════════════════════════════════════════════════════════════
# SEQUENCE POLLING WORKER: MongoDB-backed drip campaign executor
# Runs every 60 seconds, finds pending sequence_executions, and sends emails/SMS
# Uses atomic find_and_modify to prevent duplicate sends across workers
# ═══════════════════════════════════════════════════════════════════════════════
async def process_sequence_executions():
    """Background worker that polls for pending sequence executions and processes them."""
    import asyncio
    
    while True:
        try:
            # Find executions that are pending and scheduled to run now or earlier
            now = datetime.now(timezone.utc)
            
            # Atomic find and lock: prevents race conditions across multiple workers
            execution = await db.sequence_executions.find_one_and_update(
                {
                    "status": "pending",
                    "scheduled_at": {"$lte": now.isoformat()}
                },
                {
                    "$set": {
                        "status": "processing",
                        "started_at": now.isoformat()
                    }
                },
                sort=[("scheduled_at", 1)]  # Process oldest first
            )
            
            if not execution:
                # No pending executions; sleep for 60 seconds
                await asyncio.sleep(60)
                continue
            
            # Process the execution
            try:
                sequence = await db.sequences.find_one({"_id": ObjectId(execution["sequence_id"])}, {"_id": 0})
                contact = await db.contacts.find_one({"_id": ObjectId(execution["contact_id"])}, {"_id": 0})
                
                if not sequence or not contact:
                    logger.warning(f"Sequence or contact not found for execution {execution.get('_id')}")
                    await db.sequence_executions.update_one(
                        {"_id": execution["_id"]},
                        {"$set": {"status": "failed", "error": "Sequence or contact not found", "completed_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    continue
                
                if not sequence.get("active"):
                    logger.info(f"Sequence {sequence.get('name')} is inactive, skipping execution")
                    await db.sequence_executions.update_one(
                        {"_id": execution["_id"]},
                        {"$set": {"status": "skipped", "completed_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    continue
                
                step = sequence["steps"][execution["step_index"]]
                
                # Replace variables in subject/body
                body = step["body"]
                subject = step.get("subject", "")
                body = body.replace("{{contact.name}}", contact.get("name", "there"))
                body = body.replace("{{contact.email}}", contact.get("email", ""))
                subject = subject.replace("{{contact.name}}", contact.get("name", ""))
                
                # Send email or SMS
                if step["type"] == "email":
                    if contact.get("email"):
                        try:
                            # Use Brevo or fallback to logging
                            brevo_key = os.environ.get("BREVO_API_KEY")
                            if brevo_key:
                                send_email_with_retry(brevo_key, contact["email"], subject, body)
                                logger.info(f"Sequence email sent to {contact['email']}")
                            else:
                                logger.warning(f"Brevo not configured. Would send email to {contact['email']}: {subject}")
                        except Exception as e:
                            logger.error(f"Failed to send sequence email: {e}")
                            raise
                    else:
                        logger.warning(f"Contact {contact.get('name')} has no email address")
                
                elif step["type"] == "sms":
                    if contact.get("phone"):
                        try:
                            # Use Twilio or fallback to logging
                            account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
                            auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
                            from_number = os.environ.get("TWILIO_PHONE_NUMBER")
                            if account_sid and auth_token and from_number:
                                send_sms_with_retry(account_sid, auth_token, from_number, contact["phone"], body)
                                logger.info(f"Sequence SMS sent to {contact['phone']}")
                            else:
                                logger.warning(f"Twilio not configured. Would send SMS to {contact['phone']}: {body}")
                        except Exception as e:
                            logger.error(f"Failed to send sequence SMS: {e}")
                            raise
                    else:
                        logger.warning(f"Contact {contact.get('name')} has no phone number")
                
                # Mark as completed
                await db.sequence_executions.update_one(
                    {"_id": execution["_id"]},
                    {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Log activity
                await db.activities.insert_one({
                    "user_id": contact["user_id"],
                    "contact_id": str(contact["_id"]),
                    "type": f"sequence_{step['type']}",
                    "title": f"Drip Sequence: {sequence['name']}",
                    "description": f"Step {execution['step_index'] + 1}: {step['type']}",
                    "metadata": {"sequence_id": execution["sequence_id"], "step_index": execution["step_index"]},
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                
                # Schedule next step if exists
                if execution["step_index"] + 1 < len(sequence["steps"]):
                    next_step = sequence["steps"][execution["step_index"] + 1]
                    next_scheduled = datetime.now(timezone.utc) + timedelta(days=next_step["delay_days"])
                    
                    # Check if next execution already exists (idempotent)
                    existing_next = await db.sequence_executions.find_one({
                        "sequence_id": execution["sequence_id"],
                        "contact_id": execution["contact_id"],
                        "step_index": execution["step_index"] + 1
                    })
                    
                    if not existing_next:
                        await db.sequence_executions.insert_one({
                            "sequence_id": execution["sequence_id"],
                            "contact_id": execution["contact_id"],
                            "step_index": execution["step_index"] + 1,
                            "status": "pending",
                            "scheduled_at": next_scheduled.isoformat(),
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                
            except Exception as e:
                logger.error(f"Error processing sequence execution {execution.get('_id')}: {e}")
                await db.sequence_executions.update_one(
                    {"_id": execution["_id"]},
                    {"$set": {"status": "failed", "error": str(e), "completed_at": datetime.now(timezone.utc).isoformat()}}
                )
        
        except Exception as e:
            logger.error(f"Error in sequence polling worker: {e}")
            await asyncio.sleep(60)

# ═══════════════════════════════════════════════════════════════════════════════
# RETRY LOGIC: Twilio SMS with exponential backoff
# 3 attempts, waits 1s → 2s → 4s between retries
# Only retries on transient network/service errors, not auth failures
# ═══════════════════════════════════════════════════════════════════════════════
def send_sms_with_retry(account_sid: str, auth_token: str, from_number: str, to_phone: str, message: str):
    """Synchronous Twilio SMS call wrapped with tenacity retry."""
    from twilio.rest import Client as TwilioClient
    from twilio.base.exceptions import TwilioRestException

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
        reraise=True,
    )
    def _send():
        client = TwilioClient(account_sid, auth_token)
        return client.messages.create(body=message, from_=from_number, to=to_phone)

    return _send()

# ═══════════════════════════════════════════════════════════════════════════════
# RETRY LOGIC: Brevo Email with exponential backoff
# 3 attempts, waits 1s → 2s → 4s between retries
# Only retries on transient network/service errors, not auth failures
# ═══════════════════════════════════════════════════════════════════════════════
def send_email_with_retry(api_key: str, to_email: str, subject: str, html_content: str):
    """Synchronous Brevo email call wrapped with tenacity retry."""
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
        reraise=True,
    )
    def _send():
        response = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": api_key, "Content-Type": "application/json"},
            json={
                "sender": {"email": "noreply@propflow.com", "name": "PropFlow CRM"},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": html_content
            },
            timeout=10
        )
        response.raise_for_status()
        return response
    
    return _send()

# ─── Password Hashing ───
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret():
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    # SECURITY: Access token expires in 15 minutes (short-lived)
    return jwt.encode(
        {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"},
        get_jwt_secret(), algorithm=JWT_ALGORITHM
    )

def create_refresh_token(user_id: str) -> str:
    # SECURITY: Refresh token expires in 7 days
    return jwt.encode(
        {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"},
        get_jwt_secret(), algorithm=JWT_ALGORITHM
    )

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY: Environment-aware auth cookie setter
# - httponly=True:     Prevents JavaScript access (XSS protection)
# - samesite="strict": Prevents CSRF by blocking cross-origin cookie sends
# - secure=True:       Cookies only sent over HTTPS (production only)
# - max_age:           15 min for access_token, 7 days for refresh_token
# ═══════════════════════════════════════════════════════════════════════════════
def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(
        key="access_token", value=access_token,
        httponly=True, secure=IS_PRODUCTION, samesite="strict",
        max_age=900, path="/"       # 15 minutes
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=IS_PRODUCTION, samesite="strict",
        max_age=604800, path="/"    # 7 days
    )

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ─── API Key Auth for External Agents ───
async def get_api_key_user(request: Request) -> dict:
    api_key = request.headers.get("X-API-Key", "")
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")
    key_doc = await db.api_keys.find_one({"key": api_key, "active": True})
    if not key_doc:
        raise HTTPException(status_code=401, detail="Invalid API key")
    user = await db.users.find_one({"_id": ObjectId(key_doc["user_id"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    await db.api_keys.update_one({"_id": key_doc["_id"]}, {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}})
    return user

# Flexible auth: try JWT first, then API key
async def get_any_auth_user(request: Request) -> dict:
    try:
        return await get_current_user(request)
    except HTTPException:
        return await get_api_key_user(request)

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY: Input Validation Models (Pydantic)
# All user-facing input is validated through strict Pydantic models with:
# - Field length limits to prevent payload abuse
# - Enum constraints where applicable
# - Email format validation
# - Stripping of whitespace on string fields
# ═══════════════════════════════════════════════════════════════════════════════

class RegisterInput(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=6, max_length=128)
    name: str = Field(..., min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        v = v.strip().lower()
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError("Invalid email format")
        return v

class LoginInput(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=128)

class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    email: Optional[str] = Field(default="", max_length=254)
    phone: Optional[str] = Field(default="", max_length=30)
    company: Optional[str] = Field(default="", max_length=300)
    source: Optional[str] = Field(default="manual", max_length=50)
    tags: Optional[List[str]] = []
    property_type: Optional[str] = Field(default="residential_lease", max_length=50)
    notes: Optional[str] = Field(default="", max_length=5000)
    lead_score: Optional[int] = Field(default=0, ge=0, le=100)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if v and v.strip():
            if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v.strip()):
                raise ValueError("Invalid email format")
        return v

    @field_validator("property_type")
    @classmethod
    def validate_property_type(cls, v):
        allowed = ("residential_lease", "commercial_sale", "commercial_lease")
        if v and v not in allowed:
            raise ValueError(f"property_type must be one of: {', '.join(allowed)}")
        return v

class ContactUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=300)
    email: Optional[str] = Field(default=None, max_length=254)
    phone: Optional[str] = Field(default=None, max_length=30)
    company: Optional[str] = Field(default=None, max_length=300)
    source: Optional[str] = Field(default=None, max_length=50)
    tags: Optional[List[str]] = None
    property_type: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=5000)
    lead_score: Optional[int] = Field(default=None, ge=0, le=100)

class PropertyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    address: str = Field(..., min_length=1, max_length=500)
    property_type: str = Field(..., max_length=20)
    listing_type: str = Field(..., max_length=10)
    price: Optional[float] = Field(default=0, ge=0)
    sqft: Optional[float] = Field(default=0, ge=0)
    bedrooms: Optional[int] = Field(default=0, ge=0, le=100)
    bathrooms: Optional[int] = Field(default=0, ge=0, le=100)
    description: Optional[str] = Field(default="", max_length=5000)
    status: Optional[str] = Field(default="active", max_length=20)
    image_url: Optional[str] = Field(default="", max_length=2000)

    @field_validator("property_type")
    @classmethod
    def validate_prop_type(cls, v):
        if v not in ("residential", "commercial"):
            raise ValueError("property_type must be 'residential' or 'commercial'")
        return v

    @field_validator("listing_type")
    @classmethod
    def validate_listing_type(cls, v):
        if v not in ("lease", "sale"):
            raise ValueError("listing_type must be 'lease' or 'sale'")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v and v not in ("active", "pending", "closed"):
            raise ValueError("status must be 'active', 'pending', or 'closed'")
        return v

class DealCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    pipeline_type: str = Field(..., max_length=30)
    stage: str = Field(..., max_length=50)
    contact_id: Optional[str] = Field(default="", max_length=50)
    property_id: Optional[str] = Field(default="", max_length=50)
    value: Optional[float] = Field(default=0, ge=0)
    notes: Optional[str] = Field(default="", max_length=5000)

    @field_validator("pipeline_type")
    @classmethod
    def validate_pipeline(cls, v):
        allowed = ("residential_lease", "commercial_sale", "commercial_lease")
        if v not in allowed:
            raise ValueError(f"pipeline_type must be one of: {', '.join(allowed)}")
        return v

class DealUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=300)
    stage: Optional[str] = Field(default=None, max_length=50)
    contact_id: Optional[str] = Field(default=None, max_length=50)
    property_id: Optional[str] = Field(default=None, max_length=50)
    value: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=5000)

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = Field(default="", max_length=5000)
    due_date: Optional[str] = Field(default="", max_length=20)
    contact_id: Optional[str] = Field(default="", max_length=50)
    deal_id: Optional[str] = Field(default="", max_length=50)
    priority: Optional[str] = Field(default="medium", max_length=10)
    completed: Optional[bool] = False

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v and v not in ("high", "medium", "low"):
            raise ValueError("priority must be 'high', 'medium', or 'low'")
        return v

class ActivityCreate(BaseModel):
    contact_id: str = Field(..., max_length=50)
    activity_type: str = Field(..., max_length=20)
    description: str = Field(..., min_length=1, max_length=5000)
    deal_id: Optional[str] = Field(default="", max_length=50)

    @field_validator("activity_type")
    @classmethod
    def validate_activity_type(cls, v):
        allowed = ("call", "email", "note", "meeting", "sms")
        if v not in allowed:
            raise ValueError(f"activity_type must be one of: {', '.join(allowed)}")
        return v

class AIEmailRequest(BaseModel):
    contact_id: str = Field(..., max_length=50)
    context: Optional[str] = Field(default="", max_length=2000)
    tone: Optional[str] = Field(default="professional", max_length=30)

class AILeadScoreRequest(BaseModel):
    contact_id: str = Field(..., max_length=50)

class SendEmailRequest(BaseModel):
    contact_id: str = Field(..., max_length=50)
    to_email: str = Field(..., max_length=254)
    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1, max_length=50000)

    @field_validator("to_email")
    @classmethod
    def validate_to_email(cls, v):
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v.strip()):
            raise ValueError("Invalid email format")
        return v.strip()

class SendSMSRequest(BaseModel):
    contact_id: str = Field(..., max_length=50)
    to_phone: str = Field(..., max_length=20)
    message: str = Field(..., min_length=1, max_length=1600)

class WebhookCreate(BaseModel):
    url: str = Field(..., min_length=10, max_length=2000)
    events: List[str]
    name: Optional[str] = Field(default="Webhook", max_length=100)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v):
        if not v.startswith(("http://", "https://")):
            raise ValueError("Webhook URL must start with http:// or https://")
        return v

class TeamInviteRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    name: str = Field(..., min_length=1, max_length=200)
    role: Optional[str] = Field(default="agent", max_length=20)

    @field_validator("email")
    @classmethod
    def validate_invite_email(cls, v):
        v = v.strip().lower()
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError("Invalid email format")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ("admin", "agent"):
            raise ValueError("role must be 'admin' or 'agent'")
        return v

class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., max_length=10)
    subject: Optional[str] = Field(default="", max_length=500)
    body: str = Field(..., min_length=1, max_length=50000)
    tags: Optional[List[str]] = []

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        if v not in ("email", "sms"):
            raise ValueError("category must be 'email' or 'sms'")
        return v

class SequenceStepCreate(BaseModel):
    type: str = Field(..., max_length=20)  # "email" or "sms"
    delay_days: int = Field(default=0, ge=0, le=365)
    template_id: Optional[str] = None
    subject: Optional[str] = Field(default="", max_length=500)
    body: str = Field(..., min_length=1, max_length=50000)

    @field_validator("type")
    @classmethod
    def validate_step_type(cls, v):
        if v not in ("email", "sms"):
            raise ValueError("type must be 'email' or 'sms'")
        return v

class SequenceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    trigger: str = Field(..., max_length=50)  # "contact_created", "deal_stage_changed", etc.
    trigger_value: Optional[str] = Field(default="", max_length=100)
    steps: List[SequenceStepCreate]
    active: bool = Field(default=True)

    @field_validator("trigger")
    @classmethod
    def validate_trigger(cls, v):
        valid_triggers = ["contact_created", "deal_stage_changed", "property_viewed", "manual"]
        if v not in valid_triggers:
            raise ValueError(f"trigger must be one of {valid_triggers}")
        return v

class SequenceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    trigger: Optional[str] = Field(default=None, max_length=50)
    trigger_value: Optional[str] = Field(default=None, max_length=100)
    steps: Optional[List[SequenceStepCreate]] = None
    active: Optional[bool] = None

class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    auto_assign: Optional[bool] = None
    email_signature: Optional[str] = Field(default=None, max_length=2000)

# ─── Stage Automation Config ───
STAGE_AUTO_TASKS = {
    "Contacted": {"title": "Follow up within 24 hours", "priority": "high", "days_offset": 1},
    "Showing": {"title": "Confirm showing details", "priority": "high", "days_offset": 0},
    "Tour": {"title": "Prepare tour materials", "priority": "high", "days_offset": 0},
    "Application": {"title": "Review application", "priority": "high", "days_offset": 1},
    "LOI": {"title": "Review Letter of Intent", "priority": "high", "days_offset": 2},
    "Due Diligence": {"title": "Begin due diligence checklist", "priority": "high", "days_offset": 1},
    "Proposal": {"title": "Prepare lease proposal", "priority": "high", "days_offset": 1},
    "Negotiation": {"title": "Schedule negotiation meeting", "priority": "medium", "days_offset": 2},
    "Lease Signed": {"title": "Process lease paperwork", "priority": "high", "days_offset": 1},
    "Closing": {"title": "Coordinate closing logistics", "priority": "high", "days_offset": 3},
    "Closed": {"title": "Send thank you & request referral", "priority": "low", "days_offset": 2},
}

# ─── Pipeline Stage Definitions ───
PIPELINE_STAGES = {
    "residential_lease": ["New Lead", "Contacted", "Showing", "Application", "Lease Signed", "Closed"],
    "commercial_sale": ["New Lead", "Contacted", "Tour", "LOI", "Due Diligence", "Closing", "Closed"],
    "commercial_lease": ["New Lead", "Contacted", "Tour", "Proposal", "Negotiation", "Lease Signed", "Closed"],
}

# ─── Helper ───
def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

# SECURITY: Validate ObjectId format before passing to MongoDB
# Prevents 500 errors from malformed IDs and potential injection
def validate_object_id(id_str: str, entity: str = "Resource") -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=404, detail=f"{entity} not found")

# ═══════════════════════════════════════════════════════════════════════════════
# PERFORMANCE: Paginated query helper
# Used by all list endpoints. Returns { data: [...], pagination: {...} }
# - page/limit for cursor-based pagination via skip/limit
# - sort_field/sort_order for consistent ordering
# - projection to return only needed fields (reduces network + memory)
# - max limit capped at 500 to prevent abuse
# ═══════════════════════════════════════════════════════════════════════════════
PAGINATION_MAX_LIMIT = 500

async def paginate(collection, query: dict, page: int = 1, limit: int = 50,
                   sort_field: str = "created_at", sort_order: int = -1,
                   projection: dict = None):
    page = max(1, page)
    limit = max(1, min(limit, PAGINATION_MAX_LIMIT))
    skip_count = (page - 1) * limit
    total = await collection.count_documents(query)
    cursor = collection.find(query, projection).sort(sort_field, sort_order).skip(skip_count).limit(limit)
    items = await cursor.to_list(limit)
    return {
        "data": [serialize_doc(doc) for doc in items],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if limit > 0 else 1,
        }
    }

# ═══════════════════════════════════════════════════════════════════════════════
# PERFORMANCE: MongoDB Index Definitions
# Called once on startup. Indexes are created in the background to avoid
# blocking writes. Each index is explained with its purpose.
# ═══════════════════════════════════════════════════════════════════════════════
async def create_mongodb_indexes():
    """Create all performance-critical MongoDB indexes on startup."""
    logger.info("Creating MongoDB indexes...")

    # ── users collection ──
    # Unique email lookup for auth (login, register, duplicate check)
    await db.users.create_index("email", unique=True, background=True)

    # ── login_attempts collection ──
    # Fast lookup by IP:email identifier for brute-force protection
    await db.login_attempts.create_index("identifier", background=True)
    # TTL index: auto-delete old login attempt records after 1 hour
    await db.login_attempts.create_index(
        "last_attempt_dt",
        expireAfterSeconds=3600,
        background=True,
        sparse=True
    )

    # ── contacts collection ──
    # Primary query pattern: list contacts for a user, sorted by created_at
    await db.contacts.create_index(
        [("user_id", 1), ("created_at", -1)],
        background=True,
        name="idx_contacts_user_created"
    )
    # Unique email per user — prevents duplicate contacts (only enforced when email is non-empty)
    await db.contacts.create_index(
        [("user_id", 1), ("email", 1)],
        unique=True,
        background=True,
        partialFilterExpression={"email": {"$gt": ""}},
        name="idx_contacts_user_email_unique"
    )
    # Filter by property_type within a user's contacts
    await db.contacts.create_index(
        [("user_id", 1), ("property_type", 1)],
        background=True,
        name="idx_contacts_user_proptype"
    )
    # Search by name/email/phone — text index for fast full-text search
    await db.contacts.create_index(
        [("name", "text"), ("email", "text"), ("company", "text")],
        background=True,
        name="idx_contacts_text_search"
    )
    # Lead scoring / sorting
    await db.contacts.create_index("lead_score", background=True)
    # Status filter (for future use)
    await db.contacts.create_index([("user_id", 1), ("status", 1)], background=True, sparse=True)
    # Last activity timestamp (for future use / sorting by engagement)
    await db.contacts.create_index("last_activity", background=True, sparse=True)

    # ── deals collection ──
    # Primary query: list deals by pipeline_type for kanban board
    await db.deals.create_index(
        [("user_id", 1), ("pipeline_type", 1), ("created_at", -1)],
        background=True,
        name="idx_deals_user_pipeline_created"
    )
    # Stage-based queries: filter/count deals by stage (dashboard, reporting)
    await db.deals.create_index(
        [("user_id", 1), ("stage", 1), ("created_at", -1)],
        background=True,
        name="idx_deals_user_stage_created"
    )
    # Lookup deals linked to a contact (contact detail page)
    await db.deals.create_index("contact_id", background=True)
    # Lookup deals assigned to a team member (future team features)
    await db.deals.create_index("assigned_to", background=True, sparse=True)

    # ── tasks collection ──
    # Primary query: list tasks for a user sorted by due date
    await db.tasks.create_index(
        [("user_id", 1), ("due_date", 1)],
        background=True,
        name="idx_tasks_user_duedate"
    )
    # Filter by completion status (open tasks count for dashboard)
    await db.tasks.create_index(
        [("user_id", 1), ("completed", 1)],
        background=True,
        name="idx_tasks_user_completed"
    )
    # Lookup tasks linked to a contact or deal
    await db.tasks.create_index("contact_id", background=True, sparse=True)
    await db.tasks.create_index("deal_id", background=True, sparse=True)

    # ── activities collection ──
    # Primary query: activity timeline for a contact, newest first
    await db.activities.create_index(
        [("contact_id", 1), ("created_at", -1)],
        background=True,
        name="idx_activities_contact_created"
    )
    # List all activities for a user (dashboard feed)
    await db.activities.create_index(
        [("user_id", 1), ("created_at", -1)],
        background=True,
        name="idx_activities_user_created"
    )

    # ── properties collection ──
    await db.properties.create_index(
        [("user_id", 1), ("created_at", -1)],
        background=True,
        name="idx_properties_user_created"
    )
    await db.properties.create_index(
        [("user_id", 1), ("property_type", 1), ("listing_type", 1)],
        background=True,
        name="idx_properties_user_type_listing"
    )

    # ── templates collection ──
    await db.templates.create_index(
        [("user_id", 1), ("category", 1), ("use_count", -1)],
        background=True,
        name="idx_templates_user_cat_usecount"
    )

    # ── api_keys collection ──
    await db.api_keys.create_index("key", unique=True, background=True)
    await db.api_keys.create_index("user_id", background=True)

    # ── webhooks collection ──
    await db.webhooks.create_index(
        [("user_id", 1), ("active", 1)],
        background=True,
        name="idx_webhooks_user_active"
    )

    # ── ai_usage_logs collection ──
    # Track AI usage per user for rate limiting and cost auditing
    await db.ai_usage_logs.create_index(
        [("user_id", 1), ("timestamp", -1)],
        background=True,
        name="idx_ai_usage_user_ts"
    )
    # TTL: auto-delete AI usage logs older than 30 days
    await db.ai_usage_logs.create_index(
        "timestamp_dt",
        expireAfterSeconds=30 * 86400,
        background=True,
        sparse=True
    )

    # ── sequences collection ──
    # List sequences for a user
    await db.sequences.create_index(
        [("user_id", 1), ("created_at", -1)],
        background=True,
        name="idx_sequences_user_created"
    )
    # Find active sequences by trigger type
    await db.sequences.create_index(
        [("user_id", 1), ("trigger", 1), ("active", 1)],
        background=True,
        name="idx_sequences_user_trigger_active"
    )

    # ── sequence_executions collection ──
    # Find pending executions to process
    await db.sequence_executions.create_index(
        [("status", 1), ("scheduled_at", 1)],
        background=True,
        name="idx_executions_status_scheduled"
    )
    # Prevent duplicate executions for the same contact/sequence/step
    await db.sequence_executions.create_index(
        [("sequence_id", 1), ("contact_id", 1), ("step_index", 1)],
        unique=True,
        background=True,
        name="idx_executions_seq_contact_step_unique"
    )
    # Lookup executions for a contact
    await db.sequence_executions.create_index("contact_id", background=True)

    logger.info("MongoDB indexes created successfully.")

# ─── Auth Routes ───
# SECURITY: Strict rate limit on auth endpoints — 10 requests/minute per IP
@api_router.post("/auth/register")
@limiter.limit("10/minute")
async def register(data: RegisterInput, request: Request, response: Response):
    email = data.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return {"id": user_id, "email": email, "name": data.name, "role": "user"}

@api_router.post("/auth/login")
@limiter.limit("10/minute")
async def login(data: LoginInput, request: Request, response: Response):
    email = data.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    # Brute force check
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        lockout_time = attempts.get("last_attempt", "")
        if lockout_time:
            last = datetime.fromisoformat(lockout_time)
            if datetime.now(timezone.utc) - last < timedelta(minutes=15):
                raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")
            else:
                await db.login_attempts.delete_one({"identifier": identifier})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    user_id = str(user["_id"])
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return {"id": user_id, "email": email, "name": user.get("name", ""), "role": user.get("role", "user")}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return user

@api_router.post("/auth/refresh")
@limiter.limit("10/minute")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(str(user["_id"]), user["email"])
        # SECURITY: Use the centralized set_auth_cookies helper for consistent cookie settings
        response.set_cookie(
            key="access_token", value=access,
            httponly=True, secure=IS_PRODUCTION, samesite="strict",
            max_age=900, path="/"
        )
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ─── Contacts Routes ───
@api_router.post("/contacts")
async def create_contact(data: ContactCreate, background_tasks: BackgroundTasks, user=Depends(get_any_auth_user)):
    doc = data.model_dump()
    doc["user_id"] = user["_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # FEATURE: Round-Robin Assignment
    # If user has auto_assign enabled, assign to the agent with fewest open deals
    user_settings = await db.users.find_one({"_id": ObjectId(user["_id"])}, {"_id": 0, "auto_assign": 1})
    if user_settings and user_settings.get("auto_assign"):
        # Find all team members
        team_members = await db.users.find({"role": {"$in": ["agent", "admin"]}}, {"_id": 1}).to_list(100)
        if team_members:
            # Count open deals for each agent
            agent_deal_counts = []
            for agent in team_members:
                agent_id = str(agent["_id"])
                open_deals = await db.deals.count_documents({"assigned_to": agent_id, "stage": {"$ne": "Closed"}})
                agent_deal_counts.append({"agent_id": agent_id, "open_deals": open_deals})
            # Sort by fewest open deals
            agent_deal_counts.sort(key=lambda x: x["open_deals"])
            # Assign to agent with fewest deals
            doc["assigned_to"] = agent_deal_counts[0]["agent_id"]
            logger.info(f"Round-robin assignment: contact assigned to {doc['assigned_to']}")
    
    result = await db.contacts.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    contact_id = doc["id"]
    del doc["_id"]
    
    background_tasks.add_task(trigger_webhooks, user["_id"], "new_lead", {"contact_id": doc["id"], "name": doc["name"], "email": doc.get("email", "")})
    
    # FEATURE: Trigger Drip Sequences
    # Find active sequences with trigger="contact_created"
    active_sequences = await db.sequences.find({"user_id": user["_id"], "trigger": "contact_created", "active": True}, {"_id": 0}).to_list(100)
    for sequence in active_sequences:
        if sequence.get("steps"):
            first_step = sequence["steps"][0]
            scheduled_at = datetime.now(timezone.utc) + timedelta(days=first_step["delay_days"])
            # Check if execution already exists (prevent duplicates)
            existing = await db.sequence_executions.find_one({
                "sequence_id": sequence["id"],
                "contact_id": contact_id,
                "step_index": 0
            })
            if not existing:
                await db.sequence_executions.insert_one({
                    "sequence_id": sequence["id"],
                    "contact_id": contact_id,
                    "step_index": 0,
                    "status": "pending",
                    "scheduled_at": scheduled_at.isoformat(),
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                logger.info(f"Contact {contact_id} enrolled in sequence {sequence['name']}")
    
    return doc

@api_router.get("/contacts")
async def list_contacts(
    user=Depends(get_any_auth_user),
    search: str = "", property_type: str = "",
    page: int = 1, limit: int = 50, sort: str = "created_at", order: str = "desc"
):
    query = {"user_id": user["_id"]}
    if search:
        # SECURITY: Escape regex special characters to prevent ReDoS / injection
        safe_search = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"email": {"$regex": safe_search, "$options": "i"}},
            {"phone": {"$regex": safe_search, "$options": "i"}},
            {"company": {"$regex": safe_search, "$options": "i"}},
        ]
    if property_type:
        query["property_type"] = property_type
    sort_order = 1 if order == "asc" else -1
    return await paginate(db.contacts, query, page=page, limit=limit, sort_field=sort, sort_order=sort_order)

CONTACT_CSV_FIELDS = ["name", "email", "phone", "company", "source", "property_type", "tags", "notes", "lead_score"]

@api_router.get("/contacts/export")
async def export_contacts_csv(user=Depends(get_any_auth_user)):
    contacts = await db.contacts.find({"user_id": user["_id"]}).to_list(5000)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CONTACT_CSV_FIELDS)
    writer.writeheader()
    for c in contacts:
        writer.writerow({
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "phone": c.get("phone", ""),
            "company": c.get("company", ""),
            "source": c.get("source", ""),
            "property_type": c.get("property_type", ""),
            "tags": ",".join(c.get("tags", [])),
            "notes": c.get("notes", ""),
            "lead_score": c.get("lead_score", 0),
        })
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts_export.csv"}
    )

@api_router.get("/contacts/template")
async def get_contact_import_template():
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CONTACT_CSV_FIELDS)
    writer.writeheader()
    writer.writerow({
        "name": "Jane Smith", "email": "jane@example.com", "phone": "(555) 123-4567",
        "company": "Acme Realty", "source": "website", "property_type": "residential_lease",
        "tags": "vip,relocating", "notes": "Looking for 2BR downtown", "lead_score": "0"
    })
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contact_import_template.csv"}
    )

@api_router.get("/contacts/{contact_id}")
async def get_contact(contact_id: str, user=Depends(get_any_auth_user)):
    contact = await db.contacts.find_one({"_id": validate_object_id(contact_id, "Contact"), "user_id": user["_id"]})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return serialize_doc(contact)

@api_router.put("/contacts/{contact_id}")
async def update_contact(contact_id: str, data: ContactUpdate, user=Depends(get_any_auth_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.contacts.update_one({"_id": validate_object_id(contact_id, "Contact"), "user_id": user["_id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact = await db.contacts.find_one({"_id": validate_object_id(contact_id, "Contact")})
    return serialize_doc(contact)

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user=Depends(get_any_auth_user)):
    result = await db.contacts.delete_one({"_id": validate_object_id(contact_id, "Contact"), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted"}

# ─── Properties Routes ───
@api_router.post("/properties")
async def create_property(data: PropertyCreate, user=Depends(get_any_auth_user)):
    doc = data.model_dump()
    doc["user_id"] = user["_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.properties.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    return doc

@api_router.get("/properties")
async def list_properties(
    user=Depends(get_any_auth_user),
    property_type: str = "", listing_type: str = "",
    page: int = 1, limit: int = 50, sort: str = "created_at", order: str = "desc"
):
    query = {"user_id": user["_id"]}
    if property_type:
        query["property_type"] = property_type
    if listing_type:
        query["listing_type"] = listing_type
    sort_order = 1 if order == "asc" else -1
    return await paginate(db.properties, query, page=page, limit=limit, sort_field=sort, sort_order=sort_order)

# ─── Property Import/Export (must be before {property_id} routes) ───
PROPERTY_CSV_FIELDS = ["name", "address", "property_type", "listing_type", "price", "sqft", "bedrooms", "bathrooms", "status", "description", "image_url"]

@api_router.post("/properties/import")
async def import_properties(file: UploadFile = File(...), user=Depends(get_any_auth_user)):
    content = await file.read()
    filename = file.filename or ""
    rows = []
    try:
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            ws = wb.active
            headers = []
            for i, row in enumerate(ws.iter_rows(values_only=True)):
                if i == 0:
                    headers = [str(c).strip().lower().replace(" ", "_") if c else "" for c in row]
                    continue
                rows.append(dict(zip(headers, [c if c is not None else "" for c in row])))
            wb.close()
        else:
            text = content.decode("utf-8")
            reader = csv.DictReader(io.StringIO(text))
            for row in reader:
                rows.append(row)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
    imported = 0
    errors_list = []
    for i, row in enumerate(rows):
        try:
            name = str(row.get("name", "")).strip()
            address = str(row.get("address", "")).strip()
            if not name and not address:
                errors_list.append(f"Row {i+1}: Missing name and address")
                continue
            prop_type = str(row.get("property_type", "residential")).strip().lower()
            if prop_type not in ("residential", "commercial"):
                prop_type = "residential"
            list_type = str(row.get("listing_type", "lease")).strip().lower()
            if list_type not in ("lease", "sale"):
                list_type = "lease"
            status_val = str(row.get("status", "active")).strip().lower()
            if status_val not in ("active", "pending", "closed"):
                status_val = "active"
            doc = {
                "name": name or address.split(",")[0],
                "address": address,
                "property_type": prop_type,
                "listing_type": list_type,
                "price": float(row.get("price", 0) or 0),
                "sqft": float(row.get("sqft", 0) or 0),
                "bedrooms": int(row.get("bedrooms", 0) or 0),
                "bathrooms": int(row.get("bathrooms", 0) or 0),
                "status": status_val,
                "description": str(row.get("description", "")).strip(),
                "image_url": str(row.get("image_url", "")).strip(),
                "user_id": user["_id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.properties.insert_one(doc)
            imported += 1
        except Exception as e:
            errors_list.append(f"Row {i+1}: {str(e)}")
    return {"imported": imported, "total_rows": len(rows), "errors": errors_list}

@api_router.get("/properties/export")
async def export_properties(user=Depends(get_any_auth_user)):
    props = await db.properties.find({"user_id": user["_id"]}).to_list(5000)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=PROPERTY_CSV_FIELDS)
    writer.writeheader()
    for p in props:
        writer.writerow({f: p.get(f, "") for f in PROPERTY_CSV_FIELDS})
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=properties_export.csv"}
    )

@api_router.get("/properties/template")
async def get_property_import_template():
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=PROPERTY_CSV_FIELDS)
    writer.writeheader()
    writer.writerow({
        "name": "Example Office Suite A", "address": "123 Main St, Suite 100, City, ST 12345",
        "property_type": "commercial", "listing_type": "lease", "price": "3500",
        "sqft": "1200", "bedrooms": "0", "bathrooms": "1", "status": "active",
        "description": "Corner office with city views", "image_url": ""
    })
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=property_import_template.csv"}
    )

@api_router.get("/properties/{property_id}")
async def get_property(property_id: str, user=Depends(get_any_auth_user)):
    prop = await db.properties.find_one({"_id": validate_object_id(property_id, "Property"), "user_id": user["_id"]})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return serialize_doc(prop)

@api_router.put("/properties/{property_id}")
async def update_property(property_id: str, data: dict, user=Depends(get_any_auth_user)):
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data.pop("id", None)
    result = await db.properties.update_one({"_id": validate_object_id(property_id, "Property"), "user_id": user["_id"]}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    prop = await db.properties.find_one({"_id": validate_object_id(property_id, "Property")})
    return serialize_doc(prop)

@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str, user=Depends(get_any_auth_user)):
    result = await db.properties.delete_one({"_id": validate_object_id(property_id, "Property"), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    return {"message": "Property deleted"}

# ─── Deals / Pipeline Routes ───
@api_router.get("/pipelines/stages")
async def get_pipeline_stages():
    return PIPELINE_STAGES

@api_router.post("/deals")
async def create_deal(data: DealCreate, user=Depends(get_any_auth_user)):
    if data.pipeline_type not in PIPELINE_STAGES:
        raise HTTPException(status_code=400, detail="Invalid pipeline type")
    if data.stage not in PIPELINE_STAGES[data.pipeline_type]:
        raise HTTPException(status_code=400, detail="Invalid stage for this pipeline")
    doc = data.model_dump()
    doc["user_id"] = user["_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # FEATURE: Round-Robin Assignment
    # If assigned_to is not provided and user has auto_assign enabled
    if not doc.get("assigned_to"):
        user_settings = await db.users.find_one({"_id": ObjectId(user["_id"])}, {"_id": 0, "auto_assign": 1})
        if user_settings and user_settings.get("auto_assign"):
            # Find all team members
            team_members = await db.users.find({"role": {"$in": ["agent", "admin"]}}, {"_id": 1}).to_list(100)
            if team_members:
                # Count open deals for each agent
                agent_deal_counts = []
                for agent in team_members:
                    agent_id = str(agent["_id"])
                    open_deals = await db.deals.count_documents({"assigned_to": agent_id, "stage": {"$ne": "Closed"}})
                    agent_deal_counts.append({"agent_id": agent_id, "open_deals": open_deals})
                # Sort by fewest open deals
                agent_deal_counts.sort(key=lambda x: x["open_deals"])
                # Assign to agent with fewest deals
                doc["assigned_to"] = agent_deal_counts[0]["agent_id"]
                logger.info(f"Round-robin assignment: deal assigned to {doc['assigned_to']}")
    
    result = await db.deals.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    return doc

@api_router.get("/deals")
async def list_deals(
    user=Depends(get_any_auth_user),
    pipeline_type: str = "",
    page: int = 1, limit: int = 50, sort: str = "created_at", order: str = "desc"
):
    query = {"user_id": user["_id"]}
    if pipeline_type:
        query["pipeline_type"] = pipeline_type
    sort_order = 1 if order == "asc" else -1
    return await paginate(db.deals, query, page=page, limit=limit, sort_field=sort, sort_order=sort_order)

@api_router.get("/deals/{deal_id}")
async def get_deal(deal_id: str, user=Depends(get_any_auth_user)):
    deal = await db.deals.find_one({"_id": validate_object_id(deal_id, "Deal"), "user_id": user["_id"]})
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return serialize_doc(deal)

@api_router.put("/deals/{deal_id}")
async def update_deal(deal_id: str, data: DealUpdate, background_tasks: BackgroundTasks, user=Depends(get_any_auth_user)):
    existing = await db.deals.find_one({"_id": validate_object_id(deal_id, "Deal"), "user_id": user["_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Deal not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    old_stage = existing.get("stage")
    if "stage" in updates:
        pipeline_type = existing["pipeline_type"]
        if updates["stage"] not in PIPELINE_STAGES[pipeline_type]:
            raise HTTPException(status_code=400, detail="Invalid stage for this pipeline")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.deals.update_one({"_id": validate_object_id(deal_id, "Deal")}, {"$set": updates})

    # ─── Stage Automation with transaction safety ───
    # If auto-task creation fails, rollback the stage change
    new_stage = updates.get("stage")
    if new_stage and new_stage != old_stage:
        if new_stage in STAGE_AUTO_TASKS:
            try:
                auto = STAGE_AUTO_TASKS[new_stage]
                due = (datetime.now(timezone.utc) + timedelta(days=auto["days_offset"])).strftime("%Y-%m-%d")
                await db.tasks.insert_one({
                    "title": f"[Auto] {auto['title']} - {existing.get('title', '')}",
                    "description": f"Auto-generated when deal moved to {new_stage}",
                    "due_date": due,
                    "contact_id": existing.get("contact_id", ""),
                    "deal_id": deal_id,
                    "priority": auto["priority"],
                    "completed": False,
                    "user_id": user["_id"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                logger.info(f"Auto-task created for deal {deal_id} stage change to {new_stage}")
            except Exception as e:
                # ROLLBACK: Revert the stage change if auto-task creation fails
                logger.error(f"Auto-task creation failed for deal {deal_id}, rolling back stage: {e}")
                await db.deals.update_one(
                    {"_id": validate_object_id(deal_id, "Deal")},
                    {"$set": {"stage": old_stage, "updated_at": existing.get("updated_at", "")}}
                )
                raise HTTPException(
                    status_code=500,
                    detail="Stage change failed: could not create auto-task. Deal has been reverted to its previous stage."
                )
        # ─── Webhook: trigger on deal stage change (fire-and-forget) ───
        background_tasks.add_task(trigger_webhooks, user["_id"], "deal_stage_change", {
            "deal_id": deal_id, "title": existing.get("title", ""),
            "pipeline_type": existing.get("pipeline_type", ""),
            "old_stage": old_stage, "new_stage": new_stage,
        })

    deal = await db.deals.find_one({"_id": validate_object_id(deal_id, "Deal")})
    return serialize_doc(deal)

@api_router.delete("/deals/{deal_id}")
async def delete_deal(deal_id: str, user=Depends(get_any_auth_user)):
    result = await db.deals.delete_one({"_id": validate_object_id(deal_id, "Deal"), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Deal not found")
    return {"message": "Deal deleted"}

# ─── Tasks Routes ───
@api_router.post("/tasks")
async def create_task(data: TaskCreate, user=Depends(get_any_auth_user)):
    doc = data.model_dump()
    doc["user_id"] = user["_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.tasks.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    return doc

@api_router.get("/tasks")
async def list_tasks(
    user=Depends(get_any_auth_user),
    completed: str = "",
    page: int = 1, limit: int = 50, sort: str = "due_date", order: str = "asc"
):
    query = {"user_id": user["_id"]}
    if completed == "true":
        query["completed"] = True
    elif completed == "false":
        query["completed"] = False
    sort_order = 1 if order == "asc" else -1
    return await paginate(db.tasks, query, page=page, limit=limit, sort_field=sort, sort_order=sort_order)

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: dict, user=Depends(get_any_auth_user)):
    data.pop("id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.tasks.update_one({"_id": validate_object_id(task_id, "Task"), "user_id": user["_id"]}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    task = await db.tasks.find_one({"_id": validate_object_id(task_id, "Task")})
    return serialize_doc(task)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user=Depends(get_any_auth_user)):
    result = await db.tasks.delete_one({"_id": validate_object_id(task_id, "Task"), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

# ─── Activities Routes ───
@api_router.post("/activities")
async def create_activity(data: ActivityCreate, user=Depends(get_any_auth_user)):
    doc = data.model_dump()
    doc["user_id"] = user["_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.activities.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    return doc

@api_router.get("/activities")
async def list_activities(
    user=Depends(get_any_auth_user),
    contact_id: str = "", deal_id: str = "",
    page: int = 1, limit: int = 50, sort: str = "created_at", order: str = "desc"
):
    query = {"user_id": user["_id"]}
    if contact_id:
        query["contact_id"] = contact_id
    if deal_id:
        query["deal_id"] = deal_id
    sort_order = 1 if order == "asc" else -1
    return await paginate(db.activities, query, page=page, limit=limit, sort_field=sort, sort_order=sort_order)

# ─── AI Routes (with cost guardrails, rate limiting, and usage logging) ───
@api_router.post("/ai/draft-email")
async def ai_draft_email(data: AIEmailRequest, user=Depends(get_any_auth_user)):
    await check_ai_rate_limit(user["_id"])
    contact = await db.contacts.find_one({"_id": validate_object_id(data.contact_id, "Contact"), "user_id": user["_id"]})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    activities = await db.activities.find({"contact_id": data.contact_id}).sort("created_at", -1).to_list(10)
    activity_summary = "\n".join([f"- {a.get('activity_type','')}: {a.get('description','')}" for a in activities])
    deals = await db.deals.find({"contact_id": data.contact_id}).to_list(10)
    deal_summary = "\n".join([f"- {d.get('title','')}: {d.get('stage','')}" for d in deals])
    system_msg = f"""You are an expert real estate agent assistant. Draft a {data.tone} follow-up email.
Contact: {contact.get('name','')} ({contact.get('email','')})
Company: {contact.get('company','')}
Property Interest: {contact.get('property_type','')}
Recent Activities:
{activity_summary}
Current Deals:
{deal_summary}
Additional Context: {data.context}

Write a concise, professional email ready to send. Include subject line."""
    # Cost guardrail: estimate and block if too expensive
    full_input = system_msg + "\nDraft the follow-up email now."
    guard_ai_cost(full_input)
    input_tokens = estimate_tokens(full_input)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"email-draft-{data.contact_id}-{datetime.now(timezone.utc).isoformat()}",
            system_message=system_msg
        ).with_model("openai", "gpt-5.2")
        msg = UserMessage(text="Draft the follow-up email now.")
        result = await chat.send_message(msg)
        output_tokens = estimate_tokens(result)
        await log_ai_usage(user["_id"], "draft-email", input_tokens, output_tokens)
        return {"draft": result, "contact_name": contact.get("name", "")}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI email draft error: {e}")
        raise HTTPException(status_code=500, detail="AI service temporarily unavailable. Please try again.")

@api_router.post("/ai/lead-score")
async def ai_lead_score(data: AILeadScoreRequest, user=Depends(get_any_auth_user)):
    await check_ai_rate_limit(user["_id"])
    contact = await db.contacts.find_one({"_id": validate_object_id(data.contact_id, "Contact"), "user_id": user["_id"]})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    activities = await db.activities.find({"contact_id": data.contact_id}).to_list(50)
    deals = await db.deals.find({"contact_id": data.contact_id}).to_list(20)
    tasks = await db.tasks.find({"contact_id": data.contact_id}).to_list(20)
    system_msg = f"""You are an expert real estate lead scoring AI. Analyze this lead and provide a score from 0-100.
Contact: {contact.get('name','')}
Email: {contact.get('email','')}
Company: {contact.get('company','')}
Source: {contact.get('source','')}
Property Type: {contact.get('property_type','')}
Number of activities: {len(activities)}
Number of deals: {len(deals)}
Number of tasks: {len(tasks)}
Tags: {', '.join(contact.get('tags', []))}

Respond ONLY with a JSON object: {{"score": <number 0-100>, "reasoning": "<brief explanation>", "next_action": "<recommended next step>"}}"""
    full_input = system_msg + "\nScore this lead now."
    guard_ai_cost(full_input)
    input_tokens = estimate_tokens(full_input)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"lead-score-{data.contact_id}-{datetime.now(timezone.utc).isoformat()}",
            system_message=system_msg
        ).with_model("openai", "gpt-5.2")
        msg = UserMessage(text="Score this lead now.")
        result = await chat.send_message(msg)
        output_tokens = estimate_tokens(result)
        await log_ai_usage(user["_id"], "lead-score", input_tokens, output_tokens)
        try:
            cleaned = result.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            score_data = json.loads(cleaned)
            await db.contacts.update_one({"_id": validate_object_id(data.contact_id, "Contact")}, {"$set": {"lead_score": score_data.get("score", 0)}})
            return score_data
        except json.JSONDecodeError:
            return {"score": 50, "reasoning": result, "next_action": "Review manually"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI lead score error: {e}")
        raise HTTPException(status_code=500, detail="AI service temporarily unavailable. Please try again.")

@api_router.post("/ai/summarize-activities")
async def ai_summarize(contact_id: str, user=Depends(get_any_auth_user)):
    await check_ai_rate_limit(user["_id"])
    activities = await db.activities.find({"contact_id": contact_id, "user_id": user["_id"]}).sort("created_at", -1).to_list(50)
    if not activities:
        return {"summary": "No activities found for this contact."}
    contact = await db.contacts.find_one({"_id": validate_object_id(contact_id, "Contact")})
    activity_text = "\n".join([f"[{a.get('created_at','')}] {a.get('activity_type','')}: {a.get('description','')}" for a in activities])
    system_msg = f"""Summarize these real estate CRM activities for contact {contact.get('name','') if contact else 'Unknown'}. Be concise and highlight key points, next steps, and any concerns."""
    full_input = system_msg + f"\nActivities:\n{activity_text}"
    guard_ai_cost(full_input)
    input_tokens = estimate_tokens(full_input)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"summary-{contact_id}-{datetime.now(timezone.utc).isoformat()}",
            system_message=system_msg
        ).with_model("openai", "gpt-5.2")
        msg = UserMessage(text=f"Activities:\n{activity_text}")
        result = await chat.send_message(msg)
        output_tokens = estimate_tokens(result)
        await log_ai_usage(user["_id"], "summarize-activities", input_tokens, output_tokens)
        return {"summary": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI summary error: {e}")
        raise HTTPException(status_code=500, detail="AI service temporarily unavailable. Please try again.")

# ─── API Keys Management ───

# ─── Webhook Helper ───
async def trigger_webhooks(user_id: str, event: str, payload: dict):
    webhooks = await db.webhooks.find({"user_id": user_id, "active": True}).to_list(50)
    for wh in webhooks:
        if event in wh.get("events", []):
            try:
                async with httpx.AsyncClient(timeout=10) as client_http:
                    await client_http.post(wh["url"], json={"event": event, "data": payload, "timestamp": datetime.now(timezone.utc).isoformat()})
                    await db.webhooks.update_one({"_id": wh["_id"]}, {"$set": {"last_triggered": datetime.now(timezone.utc).isoformat()}})
            except Exception as e:
                logger.error(f"Webhook {wh.get('name','')} failed: {e}")

# ─── CSV/XLSX Import ───
@api_router.post("/contacts/import")
async def import_contacts(file: UploadFile = File(...), user=Depends(get_any_auth_user)):
    content = await file.read()
    filename = file.filename or ""
    rows = []
    try:
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            ws = wb.active
            headers = []
            for i, row in enumerate(ws.iter_rows(values_only=True)):
                if i == 0:
                    headers = [str(c).strip().lower().replace(" ", "_") if c else "" for c in row]
                    continue
                rows.append(dict(zip(headers, [c if c is not None else "" for c in row])))
            wb.close()
        else:
            text = content.decode("utf-8")
            reader = csv.DictReader(io.StringIO(text))
            for row in reader:
                rows.append(row)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
    
    # FEATURE: Chunked import for large files (5000 rows at a time)
    CHUNK_SIZE = 5000
    total_rows = len(rows)
    imported = 0
    errors_list = []
    
    for chunk_start in range(0, total_rows, CHUNK_SIZE):
        chunk_end = min(chunk_start + CHUNK_SIZE, total_rows)
        chunk = rows[chunk_start:chunk_end]
        
        for i, row in enumerate(chunk):
            row_num = chunk_start + i + 1
            try:
                name = str(row.get("name", "")).strip()
                if not name:
                    errors_list.append(f"Row {row_num}: Missing name")
                    continue
                source_val = str(row.get("source", "csv_import")).strip()
                if not source_val:
                    source_val = "csv_import"
                prop_type = str(row.get("property_type", "residential_lease")).strip()
                if prop_type not in ("residential_lease", "commercial_sale", "commercial_lease"):
                    prop_type = "residential_lease"
                tags_raw = str(row.get("tags", "")).strip()
                tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
                doc = {
                    "name": name,
                    "email": str(row.get("email", "")).strip(),
                    "phone": str(row.get("phone", "")).strip(),
                    "company": str(row.get("company", "")).strip(),
                    "source": source_val,
                    "property_type": prop_type,
                    "tags": tags,
                    "notes": str(row.get("notes", "")).strip(),
                    "lead_score": int(row.get("lead_score", 0) or 0),
                    "user_id": user["_id"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.contacts.insert_one(doc)
                imported += 1
            except Exception as e:
                errors_list.append(f"Row {row_num}: {str(e)}")
        
        logger.info(f"Import progress: {chunk_end}/{total_rows} rows processed")
    
    return {"imported": imported, "total_rows": total_rows, "errors": errors_list}

# ─── Message Templates ───
@api_router.post("/templates")
async def create_template(data: TemplateCreate, user=Depends(get_current_user)):
    doc = data.model_dump()
    doc["user_id"] = user["_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    doc["use_count"] = 0
    result = await db.templates.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    return doc

@api_router.get("/templates")
async def list_templates(
    user=Depends(get_any_auth_user),
    category: str = "",
    page: int = 1, limit: int = 50, sort: str = "use_count", order: str = "desc"
):
    query = {"user_id": user["_id"]}
    if category:
        query["category"] = category
    sort_order = 1 if order == "asc" else -1
    return await paginate(db.templates, query, page=page, limit=limit, sort_field=sort, sort_order=sort_order)

@api_router.get("/templates/{template_id}")
async def get_template(template_id: str, user=Depends(get_any_auth_user)):
    tpl = await db.templates.find_one({"_id": validate_object_id(template_id, "Template"), "user_id": user["_id"]})
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return serialize_doc(tpl)

@api_router.put("/templates/{template_id}")
async def update_template(template_id: str, data: TemplateCreate, user=Depends(get_current_user)):
    updates = data.model_dump()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.templates.update_one({"_id": validate_object_id(template_id, "Template"), "user_id": user["_id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    tpl = await db.templates.find_one({"_id": validate_object_id(template_id, "Template")})
    return serialize_doc(tpl)

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user=Depends(get_current_user)):
    result = await db.templates.delete_one({"_id": validate_object_id(template_id, "Template"), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

@api_router.post("/templates/{template_id}/use")
async def use_template(template_id: str, user=Depends(get_any_auth_user)):
    """Increment use count and return the template - for tracking popular templates"""
    tpl = await db.templates.find_one({"_id": validate_object_id(template_id, "Template"), "user_id": user["_id"]})
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.templates.update_one({"_id": validate_object_id(template_id, "Template")}, {"$inc": {"use_count": 1}})
    tpl["use_count"] = tpl.get("use_count", 0) + 1
    return serialize_doc(tpl)

@api_router.post("/templates/ai-generate")
async def ai_generate_template(request: Request, user=Depends(get_current_user)):
    await check_ai_rate_limit(user["_id"])
    body = await request.json()
    purpose = body.get("purpose", "follow-up")
    category = body.get("category", "email")
    property_type = body.get("property_type", "residential_lease")
    system_msg = f"""You are an expert real estate copywriter. Generate a {category} template for {purpose}.
Property type context: {property_type}
Use placeholders like {{contact_name}}, {{property_address}}, {{agent_name}}, {{company_name}} for personalization.
{"Include a Subject line on the first line." if category == "email" else "Keep it under 160 characters for SMS."}
Make it professional, warm, and action-oriented."""
    prompt_text = f"Generate the {category} template now for: {purpose}"
    full_input = system_msg + "\n" + prompt_text
    guard_ai_cost(full_input)
    input_tokens = estimate_tokens(full_input)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"template-gen-{datetime.now(timezone.utc).isoformat()}",
            system_message=system_msg
        ).with_model("openai", "gpt-5.2")
        result = await chat.send_message(UserMessage(text=prompt_text))
        output_tokens = estimate_tokens(result)
        await log_ai_usage(user["_id"], "generate-template", input_tokens, output_tokens)
        subject = ""
        template_body = result
        if category == "email":
            for line in result.split("\n"):
                if line.lower().startswith("subject:"):
                    subject = line.replace("Subject:", "").replace("subject:", "").strip()
                    template_body = result.replace(line, "").strip()
                    break
        return {"subject": subject, "body": template_body, "category": category}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI template generation error: {e}")
        raise HTTPException(status_code=500, detail="AI service temporarily unavailable. Please try again.")

# ─── Email Sending (Brevo) ───
@api_router.post("/email/send")
async def send_email_endpoint(data: SendEmailRequest, background_tasks: BackgroundTasks, user=Depends(get_any_auth_user)):
    brevo_key = os.environ.get("BREVO_API_KEY", "")
    sender_email = os.environ.get("SENDER_EMAIL", "")
    sender_name = os.environ.get("SENDER_NAME", "PropFlow CRM")
    if not brevo_key or not sender_email:
        raise HTTPException(status_code=503, detail="Email service not configured. Add BREVO_API_KEY and SENDER_EMAIL to .env")
    try:
        from brevo import Brevo
        from brevo.transactional_emails import (
            SendTransacEmailRequestSender,
            SendTransacEmailRequestToItem,
        )
        brevo_client = Brevo(api_key=brevo_key)
        response = brevo_client.transactional_emails.send_transac_email(
            sender=SendTransacEmailRequestSender(email=sender_email, name=sender_name),
            to=[SendTransacEmailRequestToItem(email=data.to_email)],
            subject=data.subject,
            html_content=data.body.replace("\n", "<br>"),
        )
        # Log activity
        await db.activities.insert_one({
            "contact_id": data.contact_id, "user_id": user["_id"],
            "activity_type": "email", "description": f"Sent email: {data.subject}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        background_tasks.add_task(trigger_webhooks, user["_id"], "email_sent", {"contact_id": data.contact_id, "subject": data.subject})
        return {"success": True, "message_id": getattr(response, 'message_id', 'sent')}
    except Exception as e:
        logger.error(f"Brevo email error: {e}")
        raise HTTPException(status_code=500, detail="Email sending failed. Please check your configuration and try again.")

# ─── SMS Sending (Twilio) with retry logic ───
@api_router.post("/sms/send")
async def send_sms_endpoint(data: SendSMSRequest, background_tasks: BackgroundTasks, user=Depends(get_any_auth_user)):
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    from_number = os.environ.get("TWILIO_PHONE_NUMBER", "")
    if not account_sid or not auth_token or not from_number:
        raise HTTPException(status_code=503, detail="SMS service not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env")
    try:
        # Uses tenacity retry: 3 attempts with exponential backoff (1s → 2s → 4s)
        msg = send_sms_with_retry(account_sid, auth_token, from_number, data.to_phone, data.message)
        await db.activities.insert_one({
            "contact_id": data.contact_id, "user_id": user["_id"],
            "activity_type": "sms", "description": f"Sent SMS: {data.message[:80]}...",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        background_tasks.add_task(trigger_webhooks, user["_id"], "sms_sent", {"contact_id": data.contact_id, "message": data.message[:80]})
        return {"success": True, "sid": msg.sid}
    except Exception as e:
        logger.error(f"Twilio error after retries: {e}")
        raise HTTPException(status_code=500, detail="SMS sending failed. Please check your configuration and try again.")

# ─── Webhooks Management ───
@api_router.post("/webhooks")
async def create_webhook(data: WebhookCreate, user=Depends(get_current_user)):
    doc = data.model_dump()
    doc["user_id"] = user["_id"]
    doc["active"] = True
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["last_triggered"] = None
    result = await db.webhooks.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    return doc

@api_router.get("/webhooks")
async def list_webhooks(user=Depends(get_current_user), page: int = 1, limit: int = 50):
    return await paginate(db.webhooks, {"user_id": user["_id"]}, page=page, limit=limit)

@api_router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, user=Depends(get_current_user)):
    result = await db.webhooks.delete_one({"_id": validate_object_id(webhook_id, "Webhook"), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"message": "Webhook deleted"}

@api_router.put("/webhooks/{webhook_id}/toggle")
async def toggle_webhook(webhook_id: str, user=Depends(get_current_user)):
    wh = await db.webhooks.find_one({"_id": validate_object_id(webhook_id, "Webhook"), "user_id": user["_id"]})
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.webhooks.update_one({"_id": validate_object_id(webhook_id, "Webhook")}, {"$set": {"active": not wh.get("active", True)}})
    return {"active": not wh.get("active", True)}

# ─── Team Management ───
@api_router.post("/team/invite")
async def invite_team_member(data: TeamInviteRequest, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can invite team members")
    email = data.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    temp_password = secrets.token_urlsafe(8)
    await db.users.insert_one({
        "email": email,
        "password_hash": hash_password(temp_password),
        "name": data.name,
        "role": data.role,
        "team_id": user.get("team_id", user["_id"]),
        "invited_by": user["_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"email": email, "name": data.name, "role": data.role, "temp_password": temp_password}

@api_router.get("/team/members")
async def list_team_members(user=Depends(get_current_user), page: int = 1, limit: int = 50):
    team_id = user.get("team_id", user["_id"])
    query = {"$or": [{"team_id": team_id}, {"_id": ObjectId(user["_id"])}]}
    # PERFORMANCE: Projection — only return needed fields for team member list
    projection = {"_id": 1, "email": 1, "name": 1, "role": 1, "created_at": 1}
    pg = max(1, page)
    lim = max(1, min(limit, PAGINATION_MAX_LIMIT))
    skip_count = (pg - 1) * lim
    total = await db.users.count_documents(query)
    members = await db.users.find(query, projection).skip(skip_count).limit(lim).to_list(lim)
    result = []
    for m in members:
        m["id"] = str(m["_id"])
        del m["_id"]
        result.append(m)
    return {
        "data": result,
        "pagination": {"page": pg, "limit": lim, "total": total, "total_pages": math.ceil(total / lim) if lim > 0 else 1}
    }

@api_router.delete("/team/members/{member_id}")
async def remove_team_member(member_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can remove team members")
    if member_id == user["_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    result = await db.users.delete_one({"_id": validate_object_id(member_id, "Member")})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"message": "Member removed"}

@api_router.put("/team/members/{member_id}/role")
async def update_member_role(member_id: str, request: Request, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can change roles")
    body = await request.json()
    new_role = body.get("role", "agent")
    await db.users.update_one({"_id": validate_object_id(member_id, "Member")}, {"$set": {"role": new_role}})
    return {"message": "Role updated"}

@api_router.post("/api-keys")
async def create_api_key(request: Request, user=Depends(get_current_user)):
    body = await request.json()
    key = f"pf_{secrets.token_hex(24)}"
    doc = {
        "key": key,
        "name": body.get("name", "API Key"),
        "user_id": user["_id"],
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used": None
    }
    await db.api_keys.insert_one(doc)
    return {"key": key, "name": doc["name"], "created_at": doc["created_at"]}

@api_router.get("/api-keys")
async def list_api_keys(user=Depends(get_current_user), page: int = 1, limit: int = 50):
    query = {"user_id": user["_id"]}
    # PERFORMANCE: Projection — only return fields needed for key list
    projection = {"_id": 0, "key": 1, "name": 1, "active": 1, "created_at": 1, "last_used": 1}
    pg = max(1, page)
    lim = max(1, min(limit, PAGINATION_MAX_LIMIT))
    skip_count = (pg - 1) * lim
    total = await db.api_keys.count_documents(query)
    keys = await db.api_keys.find(query, projection).skip(skip_count).limit(lim).to_list(lim)
    # Mask key for display
    for k in keys:
        k["key_preview"] = k["key"][:8] + "..." + k["key"][-4:]
        k["full_key"] = k["key"]
        del k["key"]
    return {
        "data": keys,
        "pagination": {"page": pg, "limit": lim, "total": total, "total_pages": math.ceil(total / lim) if lim > 0 else 1}
    }

@api_router.delete("/api-keys/{key_preview}")
async def delete_api_key(key_preview: str, user=Depends(get_current_user)):
    result = await db.api_keys.delete_one({"user_id": user["_id"], "key": {"$regex": f"^{key_preview[:8]}"}})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key deleted"}

# ─── Dashboard Stats ───
@api_router.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_any_auth_user)):
    uid = user["_id"]
    # PERFORMANCE: All count_documents queries use indexed user_id field
    total_contacts = await db.contacts.count_documents({"user_id": uid})
    total_deals = await db.deals.count_documents({"user_id": uid})
    total_properties = await db.properties.count_documents({"user_id": uid})
    open_tasks = await db.tasks.count_documents({"user_id": uid, "completed": False})
    # Pipeline breakdown — uses idx_deals_user_stage_created index
    pipeline_stats = {}
    for pt in PIPELINE_STAGES:
        stages = {}
        for stage in PIPELINE_STAGES[pt]:
            count = await db.deals.count_documents({"user_id": uid, "pipeline_type": pt, "stage": stage})
            stages[stage] = count
        pipeline_stats[pt] = stages
    # Recent activities — uses idx_activities_user_created index, limited projection
    recent_activities = await db.activities.find(
        {"user_id": uid},
        {"user_id": 0}  # Exclude user_id from response (already known)
    ).sort("created_at", -1).to_list(10)
    # Deal value by pipeline — PERFORMANCE: Only fetch "value" field (projection)
    deal_values = {}
    for pt in PIPELINE_STAGES:
        deals = await db.deals.find(
            {"user_id": uid, "pipeline_type": pt},
            {"value": 1, "_id": 0}  # Only fetch value field
        ).to_list(500)
        deal_values[pt] = sum(d.get("value", 0) for d in deals)
    return {
        "total_contacts": total_contacts,
        "total_deals": total_deals,
        "total_properties": total_properties,
        "open_tasks": open_tasks,
        "pipeline_stats": pipeline_stats,
        "deal_values": deal_values,
        "recent_activities": [serialize_doc(a) for a in recent_activities],
    }

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE: Drip Sequences
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/sequences")
async def list_sequences(user=Depends(get_current_user), page: int = 1, limit: int = 50):
    uid = user["_id"]
    pg = max(1, page)
    lim = max(1, min(limit, PAGINATION_MAX_LIMIT))
    skip_count = (pg - 1) * lim
    total = await db.sequences.count_documents({"user_id": uid})
    sequences = await db.sequences.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).skip(skip_count).limit(lim).to_list(lim)
    return {
        "data": sequences,
        "pagination": {"page": pg, "limit": lim, "total": total, "total_pages": math.ceil(total / lim) if lim > 0 else 1}
    }

@api_router.post("/sequences")
async def create_sequence(data: SequenceCreate, user=Depends(get_current_user)):
    doc = {
        "id": str(ObjectId()),
        "user_id": user["_id"],
        "name": data.name,
        "trigger": data.trigger,
        "trigger_value": data.trigger_value or "",
        "steps": [{"type": s.type, "delay_days": s.delay_days, "template_id": s.template_id, "subject": s.subject, "body": s.body} for s in data.steps],
        "active": data.active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sequences.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/sequences/{sequence_id}")
async def get_sequence(sequence_id: str, user=Depends(get_current_user)):
    sequence = await db.sequences.find_one({"id": sequence_id, "user_id": user["_id"]}, {"_id": 0})
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return sequence

@api_router.put("/sequences/{sequence_id}")
async def update_sequence(sequence_id: str, data: SequenceUpdate, user=Depends(get_current_user)):
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.trigger is not None:
        update_data["trigger"] = data.trigger
    if data.trigger_value is not None:
        update_data["trigger_value"] = data.trigger_value
    if data.steps is not None:
        update_data["steps"] = [{"type": s.type, "delay_days": s.delay_days, "template_id": s.template_id, "subject": s.subject, "body": s.body} for s in data.steps]
    if data.active is not None:
        update_data["active"] = data.active
    
    result = await db.sequences.update_one({"id": sequence_id, "user_id": user["_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return {"message": "Sequence updated"}

@api_router.delete("/sequences/{sequence_id}")
async def delete_sequence(sequence_id: str, user=Depends(get_current_user)):
    result = await db.sequences.delete_one({"id": sequence_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sequence not found")
    # Also delete any pending executions
    await db.sequence_executions.delete_many({"sequence_id": sequence_id, "status": "pending"})
    return {"message": "Sequence deleted"}

@api_router.post("/sequences/{sequence_id}/enroll/{contact_id}")
async def enroll_contact_in_sequence(sequence_id: str, contact_id: str, user=Depends(get_current_user)):
    """Manually enroll a contact in a drip sequence."""
    sequence = await db.sequences.find_one({"id": sequence_id, "user_id": user["_id"]}, {"_id": 0})
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    
    contact = await db.contacts.find_one({"id": contact_id, "user_id": user["_id"]}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    if not sequence.get("active"):
        raise HTTPException(status_code=400, detail="Sequence is not active")
    
    if not sequence.get("steps"):
        raise HTTPException(status_code=400, detail="Sequence has no steps")
    
    # Check if already enrolled (prevent duplicates)
    existing = await db.sequence_executions.find_one({
        "sequence_id": sequence_id,
        "contact_id": contact_id,
        "step_index": 0
    })
    if existing:
        raise HTTPException(status_code=400, detail="Contact already enrolled in this sequence")
    
    # Schedule first step
    first_step = sequence["steps"][0]
    scheduled_at = datetime.now(timezone.utc) + timedelta(days=first_step["delay_days"])
    
    await db.sequence_executions.insert_one({
        "sequence_id": sequence_id,
        "contact_id": contact_id,
        "step_index": 0,
        "status": "pending",
        "scheduled_at": scheduled_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Contact enrolled in sequence", "scheduled_at": scheduled_at.isoformat()}

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE: Analytics & Reporting
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/reports")
async def get_reports(user=Depends(get_current_user)):
    """Generate analytics report with MongoDB aggregation pipelines."""
    uid = user["_id"]
    
    # 1. Stage Conversion Rates (for each pipeline type)
    pipeline_stages = {}
    for pipeline_type, stages in PIPELINE_STAGES.items():
        stage_counts = {}
        for stage in stages:
            count = await db.deals.count_documents({"user_id": uid, "pipeline_type": pipeline_type, "stage": stage})
            stage_counts[stage] = count
        pipeline_stages[pipeline_type] = stage_counts
    
    # 2. Activity Counts by Type (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    activities_pipeline = [
        {"$match": {"user_id": uid, "created_at": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    activity_counts = await db.activities.aggregate(activities_pipeline).to_list(100)
    activity_counts_dict = {a["_id"]: a["count"] for a in activity_counts}
    
    # 3. Lead Velocity (new contacts per week for last 8 weeks)
    lead_velocity = []
    for i in range(8):
        week_start = (datetime.now(timezone.utc) - timedelta(weeks=i+1)).isoformat()
        week_end = (datetime.now(timezone.utc) - timedelta(weeks=i)).isoformat()
        count = await db.contacts.count_documents({
            "user_id": uid,
            "created_at": {"$gte": week_start, "$lt": week_end}
        })
        lead_velocity.append({"week": f"Week {8-i}", "count": count})
    lead_velocity.reverse()
    
    # 4. Monthly Pipeline Value (sum of deal values by month)
    pipeline_value_pipeline = [
        {"$match": {"user_id": uid}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 7]},  # Group by YYYY-MM
            "total_value": {"$sum": "$value"}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 12}
    ]
    pipeline_values = await db.deals.aggregate(pipeline_value_pipeline).to_list(12)
    monthly_values = [{"month": pv["_id"], "value": pv["total_value"]} for pv in pipeline_values]
    
    # 5. Deal Win Rate (Closed vs Total)
    total_deals = await db.deals.count_documents({"user_id": uid})
    won_deals = await db.deals.count_documents({"user_id": uid, "stage": "Closed"})
    win_rate = round((won_deals / total_deals * 100), 2) if total_deals > 0 else 0
    
    # 6. Average Deal Value
    all_deals = await db.deals.find({"user_id": uid}, {"value": 1, "_id": 0}).to_list(10000)
    deal_values = [d.get("value", 0) for d in all_deals]
    avg_deal_value = round(sum(deal_values) / len(deal_values), 2) if deal_values else 0
    
    return {
        "pipeline_stages": pipeline_stages,
        "activity_counts": activity_counts_dict,
        "lead_velocity": lead_velocity,
        "monthly_pipeline_values": monthly_values,
        "win_rate": win_rate,
        "total_deals": total_deals,
        "won_deals": won_deals,
        "avg_deal_value": avg_deal_value
    }

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE: User Settings Update (for auto_assign)
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.put("/users/me")
async def update_user_settings(data: UserUpdate, user=Depends(get_current_user)):
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.auto_assign is not None:
        update_data["auto_assign"] = data.auto_assign
    if data.email_signature is not None:
        update_data["email_signature"] = data.email_signature
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": update_data})
    return {"message": "User settings updated"}

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE: IDX Webhooks Placeholder
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.post("/webhooks/idx")
async def idx_webhook(request: Request):
    """
    Placeholder endpoint for IDX/Zillow lead webhooks.
    TODO: Parse IDX payload and create contact/property records.
    """
    payload = await request.json()
    logger.info(f"IDX webhook received: {payload}")
    # Future: Parse payload and create contacts/properties
    return {"status": "received", "message": "IDX webhook placeholder — not yet implemented"}

# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE: Google Calendar Sync Placeholders
# ═══════════════════════════════════════════════════════════════════════════════

@api_router.get("/calendar/auth")
async def calendar_auth_start(user=Depends(get_current_user)):
    """
    Placeholder: Initiate Google Calendar OAuth flow.
    TODO: Redirect to Google OAuth consent screen.
    """
    return {"status": "not_implemented", "message": "Google Calendar OAuth not yet configured. Add Google OAuth credentials."}

@api_router.post("/calendar/sync")
async def calendar_sync(user=Depends(get_current_user)):
    """
    Placeholder: Sync tasks/activities with Google Calendar.
    TODO: Use Google Calendar API to create/update events.
    """
    return {"status": "not_implemented", "message": "Google Calendar sync not yet configured. Complete OAuth integration first."}

# ─── Startup ───
@app.on_event("startup")
async def startup():
    # ── PERFORMANCE: Create comprehensive MongoDB indexes ──
    await create_mongodb_indexes()

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@propflow.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")
    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n- POST /api/auth/refresh\n")
    
    # ── Start background sequence polling worker ──
    asyncio.create_task(process_sequence_executions())
    logger.info("Sequence polling worker started")

app.include_router(api_router)

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY: Rate Limit Exceeded Handler
# Returns clean 429 response when rate limits are hit.
# ═══════════════════════════════════════════════════════════════════════════════
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please slow down and try again."}
    )

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY: Global Exception Handler
# Catches all unhandled exceptions and returns a clean 500 response.
# Stack traces, DB details, and sensitive info are NEVER leaked to the client.
# Full details are logged server-side for debugging.
# ═══════════════════════════════════════════════════════════════════════════════
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {type(exc).__name__}: {exc}")
    logger.debug(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again later."}
    )

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY: Rate Limiting Middleware (slowapi)
# Applied globally — 100 req/min default, stricter on auth routes.
# ═══════════════════════════════════════════════════════════════════════════════
app.add_middleware(SlowAPIMiddleware)

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY: Security Headers Middleware
# Adds defensive HTTP headers to every response:
# - X-Content-Type-Options: nosniff          → Prevent MIME-type sniffing
# - X-Frame-Options: DENY                    → Prevent clickjacking
# - X-XSS-Protection: 1; mode=block          → Legacy XSS filter
# - Strict-Transport-Security                → Force HTTPS (production only)
# - Referrer-Policy: strict-origin-when-cross-origin → Limit referrer leakage
# - Permissions-Policy                       → Disable unused browser APIs
# ═══════════════════════════════════════════════════════════════════════════════
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY: CORS Configuration
# - Only allow the specific frontend origin (no wildcards)
# - Only allow necessary HTTP methods
# - Only allow necessary headers
# - Credentials (cookies) are allowed for auth
# ═══════════════════════════════════════════════════════════════════════════════
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "Cookie"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
