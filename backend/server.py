from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import bcrypt
import jwt
import secrets
import csv
import io
import json
import httpx
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Password Hashing ───
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret():
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    return jwt.encode({"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

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

# ─── Pydantic Models ───
class RegisterInput(BaseModel):
    email: str
    password: str
    name: str

class LoginInput(BaseModel):
    email: str
    password: str

class ContactCreate(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    company: Optional[str] = ""
    source: Optional[str] = "manual"
    tags: Optional[List[str]] = []
    property_type: Optional[str] = "residential_lease"
    notes: Optional[str] = ""
    lead_score: Optional[int] = 0

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    source: Optional[str] = None
    tags: Optional[List[str]] = None
    property_type: Optional[str] = None
    notes: Optional[str] = None
    lead_score: Optional[int] = None

class PropertyCreate(BaseModel):
    name: str
    address: str
    property_type: str  # residential, commercial
    listing_type: str   # lease, sale
    price: Optional[float] = 0
    sqft: Optional[float] = 0
    bedrooms: Optional[int] = 0
    bathrooms: Optional[int] = 0
    description: Optional[str] = ""
    status: Optional[str] = "active"
    image_url: Optional[str] = ""

class DealCreate(BaseModel):
    title: str
    pipeline_type: str  # residential_lease, commercial_sale, commercial_lease
    stage: str
    contact_id: Optional[str] = ""
    property_id: Optional[str] = ""
    value: Optional[float] = 0
    notes: Optional[str] = ""

class DealUpdate(BaseModel):
    title: Optional[str] = None
    stage: Optional[str] = None
    contact_id: Optional[str] = None
    property_id: Optional[str] = None
    value: Optional[float] = None
    notes: Optional[str] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    due_date: Optional[str] = ""
    contact_id: Optional[str] = ""
    deal_id: Optional[str] = ""
    priority: Optional[str] = "medium"
    completed: Optional[bool] = False

class ActivityCreate(BaseModel):
    contact_id: str
    activity_type: str  # call, email, note, meeting
    description: str
    deal_id: Optional[str] = ""

class AIEmailRequest(BaseModel):
    contact_id: str
    context: Optional[str] = ""
    tone: Optional[str] = "professional"

class AILeadScoreRequest(BaseModel):
    contact_id: str

class SendEmailRequest(BaseModel):
    contact_id: str
    to_email: str
    subject: str
    body: str

class SendSMSRequest(BaseModel):
    contact_id: str
    to_phone: str
    message: str

class WebhookCreate(BaseModel):
    url: str
    events: List[str]  # new_lead, deal_stage_change, new_activity, etc.
    name: Optional[str] = "Webhook"

class TeamInviteRequest(BaseModel):
    email: str
    name: str
    role: Optional[str] = "agent"

class TemplateCreate(BaseModel):
    name: str
    category: str  # email, sms
    subject: Optional[str] = ""
    body: str
    tags: Optional[List[str]] = []

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

# ─── Auth Routes ───
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
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
        response.set_cookie(key="access_token", value=access, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
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
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
        ]
    if property_type:
        query["property_type"] = property_type
    contacts = await db.contacts.find(query).sort("created_at", -1).to_list(500)
    return [serialize_doc(c) for c in contacts]

@api_router.get("/contacts/export")
async def export_contacts_csv(user=Depends(get_any_auth_user)):
    contacts = await db.contacts.find({"user_id": user["_id"]}).to_list(5000)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["name", "email", "phone", "company", "source", "property_type", "tags", "notes", "lead_score"])
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

@api_router.get("/contacts/{contact_id}")
async def get_contact(contact_id: str, user=Depends(get_any_auth_user)):
    contact = await db.contacts.find_one({"_id": ObjectId(contact_id), "user_id": user["_id"]})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return serialize_doc(contact)

@api_router.put("/contacts/{contact_id}")
async def update_contact(contact_id: str, data: ContactUpdate, user=Depends(get_any_auth_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.contacts.update_one({"_id": ObjectId(contact_id), "user_id": user["_id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact = await db.contacts.find_one({"_id": ObjectId(contact_id)})
    return serialize_doc(contact)

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user=Depends(get_any_auth_user)):
    result = await db.contacts.delete_one({"_id": ObjectId(contact_id), "user_id": user["_id"]})
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

@api_router.get("/properties/{property_id}")
async def get_property(property_id: str, user=Depends(get_any_auth_user)):
    prop = await db.properties.find_one({"_id": ObjectId(property_id), "user_id": user["_id"]})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return serialize_doc(prop)

@api_router.put("/properties/{property_id}")
async def update_property(property_id: str, data: dict, user=Depends(get_any_auth_user)):
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data.pop("id", None)
    result = await db.properties.update_one({"_id": ObjectId(property_id), "user_id": user["_id"]}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    prop = await db.properties.find_one({"_id": ObjectId(property_id)})
    return serialize_doc(prop)

@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str, user=Depends(get_any_auth_user)):
    result = await db.properties.delete_one({"_id": ObjectId(property_id), "user_id": user["_id"]})
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
    deal = await db.deals.find_one({"_id": ObjectId(deal_id), "user_id": user["_id"]})
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return serialize_doc(deal)

@api_router.put("/deals/{deal_id}")
async def update_deal(deal_id: str, data: DealUpdate, background_tasks: BackgroundTasks, user=Depends(get_any_auth_user)):
    existing = await db.deals.find_one({"_id": ObjectId(deal_id), "user_id": user["_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Deal not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    old_stage = existing.get("stage")
    if "stage" in updates:
        pipeline_type = existing["pipeline_type"]
        if updates["stage"] not in PIPELINE_STAGES[pipeline_type]:
            raise HTTPException(status_code=400, detail="Invalid stage for this pipeline")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.deals.update_one({"_id": ObjectId(deal_id)}, {"$set": updates})
    deal = await db.deals.find_one({"_id": ObjectId(deal_id)})
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
    result = await db.deals.delete_one({"_id": ObjectId(deal_id), "user_id": user["_id"]})
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
    result = await db.tasks.update_one({"_id": ObjectId(task_id), "user_id": user["_id"]}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return serialize_doc(task)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user=Depends(get_any_auth_user)):
    result = await db.tasks.delete_one({"_id": ObjectId(task_id), "user_id": user["_id"]})
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
    contact = await db.contacts.find_one({"_id": ObjectId(data.contact_id), "user_id": user["_id"]})
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
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

@api_router.post("/ai/lead-score")
async def ai_lead_score(data: AILeadScoreRequest, user=Depends(get_any_auth_user)):
    contact = await db.contacts.find_one({"_id": ObjectId(data.contact_id), "user_id": user["_id"]})
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
            await db.contacts.update_one({"_id": ObjectId(data.contact_id)}, {"$set": {"lead_score": score_data.get("score", 0)}})
            return score_data
        except json.JSONDecodeError:
            return {"score": 50, "reasoning": result, "next_action": "Review manually"}
    except Exception as e:
        logger.error(f"AI lead score error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

@api_router.post("/ai/summarize-activities")
async def ai_summarize(contact_id: str, user=Depends(get_any_auth_user)):
    activities = await db.activities.find({"contact_id": contact_id, "user_id": user["_id"]}).sort("created_at", -1).to_list(50)
    if not activities:
        return {"summary": "No activities found for this contact."}
    contact = await db.contacts.find_one({"_id": ObjectId(contact_id)})
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
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

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

# ─── CSV Import/Export ───
@api_router.post("/contacts/import")
async def import_contacts_csv(file: UploadFile = File(...), user=Depends(get_any_auth_user)):
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    errors_list = []
    for i, row in enumerate(reader):
        try:
            doc = {
                "name": row.get("name", "").strip(),
                "email": row.get("email", "").strip(),
                "phone": row.get("phone", "").strip(),
                "company": row.get("company", "").strip(),
                "source": row.get("source", "csv_import").strip(),
                "property_type": row.get("property_type", "residential_lease").strip(),
                "tags": [t.strip() for t in row.get("tags", "").split(",") if t.strip()],
                "notes": row.get("notes", "").strip(),
                "lead_score": int(row.get("lead_score", 0) or 0),
                "user_id": user["_id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if not doc["name"]:
                errors_list.append(f"Row {i+1}: Missing name")
                continue
            await db.contacts.insert_one(doc)
            imported += 1
        except Exception as e:
            errors_list.append(f"Row {i+1}: {str(e)}")
    return {"imported": imported, "errors": errors_list}

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
    tpl = await db.templates.find_one({"_id": ObjectId(template_id), "user_id": user["_id"]})
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return serialize_doc(tpl)

@api_router.put("/templates/{template_id}")
async def update_template(template_id: str, data: TemplateCreate, user=Depends(get_current_user)):
    updates = data.model_dump()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.templates.update_one({"_id": ObjectId(template_id), "user_id": user["_id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    tpl = await db.templates.find_one({"_id": ObjectId(template_id)})
    return serialize_doc(tpl)

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user=Depends(get_current_user)):
    result = await db.templates.delete_one({"_id": ObjectId(template_id), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

@api_router.post("/templates/{template_id}/use")
async def use_template(template_id: str, user=Depends(get_any_auth_user)):
    """Increment use count and return the template - for tracking popular templates"""
    tpl = await db.templates.find_one({"_id": ObjectId(template_id), "user_id": user["_id"]})
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.templates.update_one({"_id": ObjectId(template_id)}, {"$inc": {"use_count": 1}})
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
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

# ─── Email Sending (SendGrid) ───
@api_router.post("/email/send")
async def send_email_endpoint(data: SendEmailRequest, background_tasks: BackgroundTasks, user=Depends(get_any_auth_user)):
    sg_key = os.environ.get("SENDGRID_API_KEY", "")
    sender = os.environ.get("SENDER_EMAIL", "")
    if not sg_key or not sender:
        raise HTTPException(status_code=503, detail="Email service not configured. Add SENDGRID_API_KEY and SENDER_EMAIL to .env")
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        message = Mail(from_email=sender, to_emails=data.to_email, subject=data.subject, html_content=data.body.replace("\n", "<br>"))
        sg = SendGridAPIClient(sg_key)
        response = sg.send(message)
        # Log activity
        await db.activities.insert_one({
            "contact_id": data.contact_id, "user_id": user["_id"],
            "activity_type": "email", "description": f"Sent email: {data.subject}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        background_tasks.add_task(trigger_webhooks, user["_id"], "email_sent", {"contact_id": data.contact_id, "subject": data.subject})
        return {"success": True, "status_code": response.status_code}
    except Exception as e:
        logger.error(f"SendGrid error: {e}")
        raise HTTPException(status_code=500, detail=f"Email sending failed: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"SMS sending failed: {str(e)}")

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
    result = await db.webhooks.delete_one({"_id": ObjectId(webhook_id), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"message": "Webhook deleted"}

@api_router.put("/webhooks/{webhook_id}/toggle")
async def toggle_webhook(webhook_id: str, user=Depends(get_current_user)):
    wh = await db.webhooks.find_one({"_id": ObjectId(webhook_id), "user_id": user["_id"]})
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.webhooks.update_one({"_id": ObjectId(webhook_id)}, {"$set": {"active": not wh.get("active", True)}})
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
    result = await db.users.delete_one({"_id": ObjectId(member_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"message": "Member removed"}

@api_router.put("/team/members/{member_id}/role")
async def update_member_role(member_id: str, request: Request, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can change roles")
    body = await request.json()
    new_role = body.get("role", "agent")
    await db.users.update_one({"_id": ObjectId(member_id)}, {"$set": {"role": new_role}})
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
