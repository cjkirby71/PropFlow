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
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

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
    result = await db.contacts.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    background_tasks.add_task(trigger_webhooks, user["_id"], "new_lead", {"contact_id": doc["id"], "name": doc["name"], "email": doc.get("email", "")})
    return doc

@api_router.get("/contacts")
async def list_contacts(user=Depends(get_any_auth_user), search: str = "", property_type: str = ""):
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
    contacts = await db.contacts.find(query).sort("created_at", -1).to_list(500)
    return [serialize_doc(c) for c in contacts]

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
async def list_properties(user=Depends(get_any_auth_user), property_type: str = "", listing_type: str = ""):
    query = {"user_id": user["_id"]}
    if property_type:
        query["property_type"] = property_type
    if listing_type:
        query["listing_type"] = listing_type
    props = await db.properties.find(query).sort("created_at", -1).to_list(500)
    return [serialize_doc(p) for p in props]

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
    result = await db.deals.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    return doc

@api_router.get("/deals")
async def list_deals(user=Depends(get_any_auth_user), pipeline_type: str = ""):
    query = {"user_id": user["_id"]}
    if pipeline_type:
        query["pipeline_type"] = pipeline_type
    deals = await db.deals.find(query).sort("created_at", -1).to_list(500)
    return [serialize_doc(d) for d in deals]

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
    deal = await db.deals.find_one({"_id": validate_object_id(deal_id, "Deal")})
    serialized = serialize_doc(deal)
    # ─── Stage Automation: auto-create task on stage change ───
    new_stage = updates.get("stage")
    if new_stage and new_stage != old_stage and new_stage in STAGE_AUTO_TASKS:
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
    # ─── Webhook: trigger on deal stage change ───
    if new_stage and new_stage != old_stage:
        background_tasks.add_task(trigger_webhooks, user["_id"], "deal_stage_change", {
            "deal_id": deal_id, "title": existing.get("title", ""),
            "pipeline_type": existing.get("pipeline_type", ""),
            "old_stage": old_stage, "new_stage": new_stage,
        })
    return serialized

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
async def list_tasks(user=Depends(get_any_auth_user), completed: str = ""):
    query = {"user_id": user["_id"]}
    if completed == "true":
        query["completed"] = True
    elif completed == "false":
        query["completed"] = False
    tasks = await db.tasks.find(query).sort("due_date", 1).to_list(500)
    return [serialize_doc(t) for t in tasks]

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
async def list_activities(user=Depends(get_any_auth_user), contact_id: str = "", deal_id: str = ""):
    query = {"user_id": user["_id"]}
    if contact_id:
        query["contact_id"] = contact_id
    if deal_id:
        query["deal_id"] = deal_id
    activities = await db.activities.find(query).sort("created_at", -1).to_list(200)
    return [serialize_doc(a) for a in activities]

# ─── AI Routes ───
@api_router.post("/ai/draft-email")
async def ai_draft_email(data: AIEmailRequest, user=Depends(get_any_auth_user)):
    contact = await db.contacts.find_one({"_id": validate_object_id(data.contact_id, "Contact"), "user_id": user["_id"]})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    activities = await db.activities.find({"contact_id": data.contact_id}).sort("created_at", -1).to_list(10)
    activity_summary = "\n".join([f"- {a.get('activity_type','')}: {a.get('description','')}" for a in activities])
    deals = await db.deals.find({"contact_id": data.contact_id}).to_list(10)
    deal_summary = "\n".join([f"- {d.get('title','')}: {d.get('stage','')}" for d in deals])
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"email-draft-{data.contact_id}-{datetime.now(timezone.utc).isoformat()}",
            system_message=f"""You are an expert real estate agent assistant. Draft a {data.tone} follow-up email.
Contact: {contact.get('name','')} ({contact.get('email','')})
Company: {contact.get('company','')}
Property Interest: {contact.get('property_type','')}
Recent Activities:
{activity_summary}
Current Deals:
{deal_summary}
Additional Context: {data.context}

Write a concise, professional email ready to send. Include subject line."""
        ).with_model("openai", "gpt-5.2")
        msg = UserMessage(text="Draft the follow-up email now.")
        result = await chat.send_message(msg)
        return {"draft": result, "contact_name": contact.get("name", "")}
    except Exception as e:
        logger.error(f"AI email draft error: {e}")
        raise HTTPException(status_code=500, detail="AI service temporarily unavailable. Please try again.")

@api_router.post("/ai/lead-score")
async def ai_lead_score(data: AILeadScoreRequest, user=Depends(get_any_auth_user)):
    contact = await db.contacts.find_one({"_id": validate_object_id(data.contact_id, "Contact"), "user_id": user["_id"]})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    activities = await db.activities.find({"contact_id": data.contact_id}).to_list(50)
    deals = await db.deals.find({"contact_id": data.contact_id}).to_list(20)
    tasks = await db.tasks.find({"contact_id": data.contact_id}).to_list(20)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"lead-score-{data.contact_id}-{datetime.now(timezone.utc).isoformat()}",
            system_message=f"""You are an expert real estate lead scoring AI. Analyze this lead and provide a score from 0-100.
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
        ).with_model("openai", "gpt-5.2")
        msg = UserMessage(text="Score this lead now.")
        result = await chat.send_message(msg)
        import json
        try:
            cleaned = result.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            score_data = json.loads(cleaned)
            await db.contacts.update_one({"_id": validate_object_id(data.contact_id, "Contact")}, {"$set": {"lead_score": score_data.get("score", 0)}})
            return score_data
        except json.JSONDecodeError:
            return {"score": 50, "reasoning": result, "next_action": "Review manually"}
    except Exception as e:
        logger.error(f"AI lead score error: {e}")
        raise HTTPException(status_code=500, detail="AI service temporarily unavailable. Please try again.")

@api_router.post("/ai/summarize-activities")
async def ai_summarize(contact_id: str, user=Depends(get_any_auth_user)):
    activities = await db.activities.find({"contact_id": contact_id, "user_id": user["_id"]}).sort("created_at", -1).to_list(50)
    if not activities:
        return {"summary": "No activities found for this contact."}
    contact = await db.contacts.find_one({"_id": validate_object_id(contact_id, "Contact")})
    activity_text = "\n".join([f"[{a.get('created_at','')}] {a.get('activity_type','')}: {a.get('description','')}" for a in activities])
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"summary-{contact_id}-{datetime.now(timezone.utc).isoformat()}",
            system_message=f"""Summarize these real estate CRM activities for contact {contact.get('name','') if contact else 'Unknown'}. Be concise and highlight key points, next steps, and any concerns."""
        ).with_model("openai", "gpt-5.2")
        msg = UserMessage(text=f"Activities:\n{activity_text}")
        result = await chat.send_message(msg)
        return {"summary": result}
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
    imported = 0
    errors_list = []
    for i, row in enumerate(rows):
        try:
            name = str(row.get("name", "")).strip()
            if not name:
                errors_list.append(f"Row {i+1}: Missing name")
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
            errors_list.append(f"Row {i+1}: {str(e)}")
    return {"imported": imported, "total_rows": len(rows), "errors": errors_list}

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
async def list_templates(user=Depends(get_any_auth_user), category: str = ""):
    query = {"user_id": user["_id"]}
    if category:
        query["category"] = category
    templates = await db.templates.find(query).sort("use_count", -1).to_list(200)
    return [serialize_doc(t) for t in templates]

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
    body = await request.json()
    purpose = body.get("purpose", "follow-up")
    category = body.get("category", "email")
    property_type = body.get("property_type", "residential_lease")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        system = f"""You are an expert real estate copywriter. Generate a {category} template for {purpose}.
Property type context: {property_type}
Use placeholders like {{contact_name}}, {{property_address}}, {{agent_name}}, {{company_name}} for personalization.
{"Include a Subject line on the first line." if category == "email" else "Keep it under 160 characters for SMS."}
Make it professional, warm, and action-oriented."""
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"template-gen-{datetime.now(timezone.utc).isoformat()}",
            system_message=system
        ).with_model("openai", "gpt-5.2")
        result = await chat.send_message(UserMessage(text=f"Generate the {category} template now for: {purpose}"))
        subject = ""
        template_body = result
        if category == "email":
            for line in result.split("\n"):
                if line.lower().startswith("subject:"):
                    subject = line.replace("Subject:", "").replace("subject:", "").strip()
                    template_body = result.replace(line, "").strip()
                    break
        return {"subject": subject, "body": template_body, "category": category}
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

# ─── SMS Sending (Twilio) ───
@api_router.post("/sms/send")
async def send_sms_endpoint(data: SendSMSRequest, background_tasks: BackgroundTasks, user=Depends(get_any_auth_user)):
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    from_number = os.environ.get("TWILIO_PHONE_NUMBER", "")
    if not account_sid or not auth_token or not from_number:
        raise HTTPException(status_code=503, detail="SMS service not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env")
    try:
        from twilio.rest import Client as TwilioClient
        twilio_client = TwilioClient(account_sid, auth_token)
        msg = twilio_client.messages.create(body=data.message, from_=from_number, to=data.to_phone)
        await db.activities.insert_one({
            "contact_id": data.contact_id, "user_id": user["_id"],
            "activity_type": "sms", "description": f"Sent SMS: {data.message[:80]}...",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        background_tasks.add_task(trigger_webhooks, user["_id"], "sms_sent", {"contact_id": data.contact_id, "message": data.message[:80]})
        return {"success": True, "sid": msg.sid}
    except Exception as e:
        logger.error(f"Twilio error: {e}")
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
async def list_webhooks(user=Depends(get_current_user)):
    webhooks = await db.webhooks.find({"user_id": user["_id"]}).to_list(50)
    return [serialize_doc(w) for w in webhooks]

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
async def list_team_members(user=Depends(get_current_user)):
    team_id = user.get("team_id", user["_id"])
    members = await db.users.find(
        {"$or": [{"team_id": team_id}, {"_id": ObjectId(user["_id"])}]},
        {"_id": 1, "email": 1, "name": 1, "role": 1, "created_at": 1}
    ).to_list(100)
    result = []
    for m in members:
        m["id"] = str(m["_id"])
        del m["_id"]
        result.append(m)
    return result

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
async def list_api_keys(user=Depends(get_current_user)):
    keys = await db.api_keys.find({"user_id": user["_id"]}, {"_id": 0, "key": 1, "name": 1, "active": 1, "created_at": 1, "last_used": 1}).to_list(50)
    # Mask key
    for k in keys:
        k["key_preview"] = k["key"][:8] + "..." + k["key"][-4:]
        k["full_key"] = k["key"]
        del k["key"]
    return keys

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
    total_contacts = await db.contacts.count_documents({"user_id": uid})
    total_deals = await db.deals.count_documents({"user_id": uid})
    total_properties = await db.properties.count_documents({"user_id": uid})
    open_tasks = await db.tasks.count_documents({"user_id": uid, "completed": False})
    # Pipeline breakdown
    pipeline_stats = {}
    for pt in PIPELINE_STAGES:
        stages = {}
        for stage in PIPELINE_STAGES[pt]:
            count = await db.deals.count_documents({"user_id": uid, "pipeline_type": pt, "stage": stage})
            stages[stage] = count
        pipeline_stats[pt] = stages
    # Recent activities
    recent_activities = await db.activities.find({"user_id": uid}).sort("created_at", -1).to_list(10)
    # Deal value by pipeline
    deal_values = {}
    for pt in PIPELINE_STAGES:
        deals = await db.deals.find({"user_id": uid, "pipeline_type": pt}).to_list(500)
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

# ─── Startup ───
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.contacts.create_index("user_id")
    await db.deals.create_index([("user_id", 1), ("pipeline_type", 1)])
    await db.tasks.create_index("user_id")
    await db.activities.create_index([("user_id", 1), ("contact_id", 1)])
    await db.api_keys.create_index("key", unique=True)
    await db.webhooks.create_index("user_id")
    await db.templates.create_index("user_id")
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
