"""Weddly backend - FastAPI + MongoDB."""
from __future__ import annotations

import os
import re
import uuid
import secrets
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Header, Depends, status
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("weddly")

app = FastAPI(title="Weddly API", version="1.0.0")
api = APIRouter(prefix="/api")


# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def make_uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def generate_token_code() -> str:
    """WDL-XXXX-XXXX-XXXX using cryptographically secure alphabet."""
    alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # avoid ambiguous
    parts = ["".join(secrets.choice(alpha) for _ in range(4)) for _ in range(3)]
    return "WDL-" + "-".join(parts)


TOKEN_RE = re.compile(r"^WDL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$")


def normalize_token(raw: str) -> str:
    return re.sub(r"\s+", "", raw or "").upper()


# ---------- Auth ----------
async def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    token = request.cookies.get("session_token")
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: Dict[str, Any] = Depends(get_current_user), x_admin_key: Optional[str] = Header(None)) -> Dict[str, Any]:
    if x_admin_key and ADMIN_API_KEY and x_admin_key == ADMIN_API_KEY:
        return user
    if user.get("email", "").lower() in ADMIN_EMAILS:
        return user
    raise HTTPException(status_code=403, detail="Admin access required")


async def get_active_membership(user: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return await db.wedding_members.find_one(
        {"user_id": user["user_id"], "status": "active"}, {"_id": 0}
    )


async def require_wedding(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    m = await get_active_membership(user)
    if not m:
        raise HTTPException(status_code=403, detail="No active wedding workspace")
    w = await db.wedding_workspaces.find_one({"wedding_id": m["wedding_id"]}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Wedding not found")
    return {"user": user, "membership": m, "wedding": w}


# ---------- Models ----------
class TokenActivate(BaseModel):
    token_code: str


class WeddingSetup(BaseModel):
    partner1_name: Optional[str] = None
    partner1_nickname: Optional[str] = None
    partner2_name: Optional[str] = None
    partner2_nickname: Optional[str] = None
    wedding_date: Optional[str] = None  # ISO date
    date_status: Optional[str] = None  # confirmed|target|undecided
    country: Optional[str] = None
    city: Optional[str] = None
    venue_ceremony: Optional[str] = None
    venue_reception: Optional[str] = None
    venue_mode: Optional[str] = None  # same|different|undecided
    budget_amount: Optional[float] = None
    budget_currency: Optional[str] = "IDR"
    guest_count: Optional[int] = None
    wedding_types: Optional[List[str]] = None
    wedding_styles: Optional[List[str]] = None
    wedding_colors: Optional[List[str]] = None
    completed_items: Optional[List[str]] = None
    challenges: Optional[List[str]] = None
    priorities: Optional[List[str]] = None
    theme_id: Optional[str] = None
    setup_step: Optional[int] = None
    setup_complete: Optional[bool] = None


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    category: Optional[str] = "Planning"
    due_date: Optional[str] = None
    priority: Optional[str] = "medium"
    status: Optional[str] = "todo"
    assigned_partner: Optional[int] = None
    notes: Optional[str] = ""


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_partner: Optional[int] = None
    notes: Optional[str] = None


class BudgetItemCreate(BaseModel):
    category: str
    name: str
    planned: float = 0
    actual: float = 0
    paid: float = 0
    status: Optional[str] = "quotation"  # quotation|dp_paid|paid|pending
    vendor: Optional[str] = ""
    due_date: Optional[str] = None
    notes: Optional[str] = ""


class BudgetItemUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    planned: Optional[float] = None
    actual: Optional[float] = None
    paid: Optional[float] = None
    status: Optional[str] = None
    vendor: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None


class GuestCreate(BaseModel):
    name: str
    group: Optional[str] = "Friends"
    phone: Optional[str] = ""
    email: Optional[str] = ""
    plus_one: Optional[bool] = False
    number_of_guests: Optional[int] = 1
    rsvp: Optional[str] = "pending"  # pending|attending|declined
    table: Optional[str] = ""
    dietary: Optional[str] = ""
    notes: Optional[str] = ""


class GuestUpdate(BaseModel):
    name: Optional[str] = None
    group: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    plus_one: Optional[bool] = None
    number_of_guests: Optional[int] = None
    rsvp: Optional[str] = None
    table: Optional[str] = None
    dietary: Optional[str] = None
    notes: Optional[str] = None


class VendorCreate(BaseModel):
    name: str
    category: str
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    price: Optional[float] = 0
    booking_status: Optional[str] = "researching"
    payment_status: Optional[str] = "pending"
    notes: Optional[str] = ""


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    price: Optional[float] = None
    booking_status: Optional[str] = None
    payment_status: Optional[str] = None
    notes: Optional[str] = None


class EventCreate(BaseModel):
    title: str
    date: str  # ISO date
    start_time: Optional[str] = ""
    end_time: Optional[str] = ""
    location: Optional[str] = ""
    category: Optional[str] = "general"
    notes: Optional[str] = ""


class EventUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None


class AIChatIn(BaseModel):
    message: str
    model: Optional[str] = "claude-sonnet-4-6"  # or gemini-3-flash


class ThemeUpdate(BaseModel):
    theme_id: str


# ---------- Auth routes ----------
@api.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")

    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name"), "picture": data.get("picture")}},
        )
    else:
        user_id = make_uid("user")
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "created_at": now_utc().isoformat(),
        })

    session_token = data["session_token"]
    expires = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires.isoformat(),
        "created_at": now_utc().isoformat(),
    })
    response.set_cookie(
        "session_token", session_token,
        httponly=True, secure=True, samesite="none",
        path="/", max_age=7 * 24 * 60 * 60,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user}


@api.get("/auth/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    member = await get_active_membership(user)
    wedding = None
    if member:
        wedding = await db.wedding_workspaces.find_one({"wedding_id": member["wedding_id"]}, {"_id": 0})
    return {
        "user": user,
        "membership": member,
        "wedding": wedding,
        "is_admin": user.get("email", "").lower() in ADMIN_EMAILS,
    }


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------- Admin: tokens ----------
@api.post("/admin/tokens/generate")
async def admin_generate_tokens(request: Request, user: Dict[str, Any] = Depends(require_admin)):
    body = await request.json()
    count = max(1, min(int(body.get("count", 1)), 100))
    package = body.get("package", "weddly-standard")
    created = []
    for _ in range(count):
        # unique retry loop
        while True:
            code = generate_token_code()
            exists = await db.access_tokens.find_one({"token_code": code})
            if not exists:
                break
        doc = {
            "token_id": make_uid("tok"),
            "token_code": code,
            "status": "unused",
            "package": package,
            "max_members": 2,
            "current_member_count": 0,
            "wedding_id": None,
            "created_at": now_utc().isoformat(),
            "activated_at": None,
            "expires_at": None,
            "revoked_at": None,
            "metadata": {"created_by": user["user_id"]},
        }
        await db.access_tokens.insert_one(doc)
        created.append({k: v for k, v in doc.items() if k != "_id"})
    return {"tokens": created}


@api.get("/admin/tokens")
async def admin_list_tokens(user: Dict[str, Any] = Depends(require_admin)):
    rows = await db.access_tokens.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"tokens": rows}


# ---------- Token activation ----------
@api.post("/wedding/activate")
async def activate_token(payload: TokenActivate, user: Dict[str, Any] = Depends(get_current_user)):
    code = normalize_token(payload.token_code)
    if not TOKEN_RE.match(code):
        raise HTTPException(status_code=400, detail="Invalid token format. Expected WDL-XXXX-XXXX-XXXX.")

    token = await db.access_tokens.find_one({"token_code": code}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="The access token is invalid. Please check the code and try again.")
    if token["status"] == "revoked":
        raise HTTPException(status_code=403, detail="This access token is no longer active.")
    if token["status"] == "expired":
        raise HTTPException(status_code=403, detail="This Weddly access has expired.")

    # Idempotent: if user is already an active member of this token's wedding, return that
    if token.get("wedding_id"):
        existing_member = await db.wedding_members.find_one({
            "wedding_id": token["wedding_id"],
            "user_id": user["user_id"],
            "status": "active",
        }, {"_id": 0})
        if existing_member:
            wed = await db.wedding_workspaces.find_one({"wedding_id": token["wedding_id"]}, {"_id": 0})
            return {"wedding": wed, "membership": existing_member, "reused": True}

    # Also: ensure user not already in another wedding (business rule: one active wedding per user)
    other = await db.wedding_members.find_one({"user_id": user["user_id"], "status": "active"}, {"_id": 0})
    if other and other.get("wedding_id") != token.get("wedding_id"):
        raise HTTPException(status_code=409, detail="You already belong to another wedding workspace.")

    # Concurrency guard: atomic increment on current_member_count, but only if under limit
    # Use findOneAndUpdate with conditional filter
    if token["status"] == "unused":
        # Try to claim: transition to active, create wedding, then add first member
        wedding_id = make_uid("wed")
        now_iso = now_utc().isoformat()
        # Atomic claim: only if status is still 'unused'
        claimed = await db.access_tokens.find_one_and_update(
            {"token_code": code, "status": "unused"},
            {"$set": {
                "status": "active",
                "wedding_id": wedding_id,
                "activated_at": now_iso,
                "current_member_count": 1,
            }},
            return_document=True,
        )
        if claimed:
            wed_doc = {
                "wedding_id": wedding_id,
                "token_id": token["token_id"],
                "token_code": code,
                "partner1_name": "",
                "partner1_nickname": "",
                "partner2_name": "",
                "partner2_nickname": "",
                "wedding_date": None,
                "date_status": "undecided",
                "country": "",
                "city": "",
                "venue_ceremony": "",
                "venue_reception": "",
                "venue_mode": "undecided",
                "budget_amount": 0,
                "budget_currency": "IDR",
                "guest_count": 0,
                "wedding_types": [],
                "wedding_styles": [],
                "wedding_colors": [],
                "completed_items": [],
                "challenges": [],
                "priorities": [],
                "theme_id": "ivory_champagne",
                "setup_step": 1,
                "setup_complete": False,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            await db.wedding_workspaces.insert_one(wed_doc)
            member_doc = {
                "member_id": make_uid("mem"),
                "wedding_id": wedding_id,
                "user_id": user["user_id"],
                "role": "partner",
                "partner_number": 1,
                "joined_at": now_iso,
                "status": "active",
            }
            await db.wedding_members.insert_one(member_doc)
            wed_doc.pop("_id", None)
            member_doc.pop("_id", None)
            return {"wedding": wed_doc, "membership": member_doc, "reused": False}
        # Someone else claimed it just now — refetch and fall through
        token = await db.access_tokens.find_one({"token_code": code}, {"_id": 0})

    # Token is now 'active' -> try to join as partner 2
    if token and token["status"] == "active":
        # Atomic: increment only if count < max_members
        updated = await db.access_tokens.find_one_and_update(
            {"token_code": code, "current_member_count": {"$lt": token["max_members"]}},
            {"$inc": {"current_member_count": 1}},
            return_document=True,
        )
        if not updated:
            raise HTTPException(status_code=409, detail="This wedding access is already connected to two accounts.")
        # Assign partner_number (2 since first was 1)
        existing = await db.wedding_members.find_one({"wedding_id": token["wedding_id"], "partner_number": 1, "status": "active"}, {"_id": 0})
        partner_number = 2 if existing else 1
        member_doc = {
            "member_id": make_uid("mem"),
            "wedding_id": token["wedding_id"],
            "user_id": user["user_id"],
            "role": "partner",
            "partner_number": partner_number,
            "joined_at": now_utc().isoformat(),
            "status": "active",
        }
        await db.wedding_members.insert_one(member_doc)
        member_doc.pop("_id", None)
        wed = await db.wedding_workspaces.find_one({"wedding_id": token["wedding_id"]}, {"_id": 0})
        return {"wedding": wed, "membership": member_doc, "reused": False}

    raise HTTPException(status_code=400, detail="Token cannot be activated right now.")


# ---------- Wedding setup ----------
@api.get("/wedding")
async def get_wedding(ctx: Dict[str, Any] = Depends(require_wedding)):
    # Attach members
    members = await db.wedding_members.find({"wedding_id": ctx["wedding"]["wedding_id"], "status": "active"}, {"_id": 0}).to_list(10)
    users = {}
    for m in members:
        u = await db.users.find_one({"user_id": m["user_id"]}, {"_id": 0})
        if u:
            users[m["user_id"]] = {"user_id": u["user_id"], "email": u.get("email"), "name": u.get("name"), "picture": u.get("picture")}
    return {"wedding": ctx["wedding"], "membership": ctx["membership"], "members": members, "member_users": users}


@api.patch("/wedding")
async def update_wedding(payload: WeddingSetup, ctx: Dict[str, Any] = Depends(require_wedding)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = now_utc().isoformat()
    await db.wedding_workspaces.update_one({"wedding_id": ctx["wedding"]["wedding_id"]}, {"$set": updates})
    # If setup just completed, generate checklist idempotently
    if payload.setup_complete:
        await _ensure_checklist(ctx["wedding"]["wedding_id"])
        await _ensure_budget_categories(ctx["wedding"]["wedding_id"])
    wed = await db.wedding_workspaces.find_one({"wedding_id": ctx["wedding"]["wedding_id"]}, {"_id": 0})
    return {"wedding": wed}


@api.patch("/wedding/theme")
async def update_theme(payload: ThemeUpdate, ctx: Dict[str, Any] = Depends(require_wedding)):
    await db.wedding_workspaces.update_one(
        {"wedding_id": ctx["wedding"]["wedding_id"]},
        {"$set": {"theme_id": payload.theme_id, "updated_at": now_utc().isoformat()}}
    )
    wed = await db.wedding_workspaces.find_one({"wedding_id": ctx["wedding"]["wedding_id"]}, {"_id": 0})
    return {"wedding": wed}


# ---------- Checklist ----------
CHECKLIST_TEMPLATE = [
    # (months_before, category, title, priority)
    (12, "Planning", "Set overall wedding vision & priorities", "high"),
    (12, "Planning", "Draft rough guest count", "high"),
    (10, "Venue", "Research and shortlist venues", "high"),
    (9, "Venue", "Book ceremony & reception venue", "high"),
    (9, "Photography", "Book photographer", "high"),
    (9, "Videography", "Book videographer", "medium"),
    (8, "Catering", "Confirm catering package & menu", "high"),
    (7, "Attire", "Order wedding dress / kebaya", "high"),
    (7, "Attire", "Order suit / traditional attire", "medium"),
    (6, "Decoration", "Book decorator / florist", "high"),
    (6, "Makeup", "Book MUA (hair & makeup)", "high"),
    (5, "Invitations", "Design & print invitations", "medium"),
    (4, "Entertainment", "Book MC & band/DJ", "medium"),
    (4, "Documents", "Prepare KUA / civil documents", "high"),
    (3, "Guests", "Send invitations", "high"),
    (3, "Transportation", "Arrange wedding day transport", "medium"),
    (2, "Reception", "Finalize seating chart", "medium"),
    (1, "Final Week", "Confirm all vendors", "high"),
    (1, "Final Week", "Rehearsal (Gladi resik)", "high"),
    (0, "Wedding Day", "Wedding day rundown briefing", "high"),
]


async def _ensure_checklist(wedding_id: str):
    existing = await db.checklist_tasks.count_documents({"wedding_id": wedding_id, "auto_generated": True})
    if existing > 0:
        return
    wed = await db.wedding_workspaces.find_one({"wedding_id": wedding_id}, {"_id": 0})
    if not wed:
        return
    wedding_date_str = wed.get("wedding_date")
    base = None
    if wedding_date_str:
        try:
            base = datetime.fromisoformat(wedding_date_str.replace("Z", "+00:00"))
        except Exception:
            base = None
    completed_map = {c.lower(): True for c in (wed.get("completed_items") or [])}
    docs = []
    for months, category, title, priority in CHECKLIST_TEMPLATE:
        due = None
        if base:
            due = (base - timedelta(days=months * 30)).date().isoformat()
        status_val = "completed" if any(k in title.lower() for k in completed_map.keys()) else "todo"
        docs.append({
            "task_id": make_uid("task"),
            "wedding_id": wedding_id,
            "title": title,
            "description": "",
            "category": category,
            "due_date": due,
            "priority": priority,
            "status": status_val,
            "assigned_partner": None,
            "notes": "",
            "auto_generated": True,
            "created_at": now_utc().isoformat(),
            "updated_at": now_utc().isoformat(),
        })
    if docs:
        await db.checklist_tasks.insert_many(docs)


@api.get("/checklist")
async def list_tasks(ctx: Dict[str, Any] = Depends(require_wedding)):
    tasks = await db.checklist_tasks.find({"wedding_id": ctx["wedding"]["wedding_id"]}, {"_id": 0}).sort("due_date", 1).to_list(1000)
    return {"tasks": tasks}


@api.post("/checklist")
async def add_task(payload: TaskCreate, ctx: Dict[str, Any] = Depends(require_wedding)):
    doc = payload.model_dump()
    doc.update({
        "task_id": make_uid("task"),
        "wedding_id": ctx["wedding"]["wedding_id"],
        "auto_generated": False,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    })
    await db.checklist_tasks.insert_one(doc)
    doc.pop("_id", None)
    return {"task": doc}


@api.patch("/checklist/{task_id}")
async def update_task(task_id: str, payload: TaskUpdate, ctx: Dict[str, Any] = Depends(require_wedding)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = now_utc().isoformat()
    res = await db.checklist_tasks.update_one(
        {"task_id": task_id, "wedding_id": ctx["wedding"]["wedding_id"]},
        {"$set": updates},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    task = await db.checklist_tasks.find_one({"task_id": task_id}, {"_id": 0})
    return {"task": task}


@api.delete("/checklist/{task_id}")
async def delete_task(task_id: str, ctx: Dict[str, Any] = Depends(require_wedding)):
    res = await db.checklist_tasks.delete_one({"task_id": task_id, "wedding_id": ctx["wedding"]["wedding_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


# ---------- Budget ----------
DEFAULT_BUDGET_CATS = [
    "Venue", "Catering", "Decoration", "Photography", "Videography",
    "Makeup", "Attire", "Entertainment", "Invitation", "Souvenir",
    "Transportation", "Wedding Organizer", "Miscellaneous",
]


async def _ensure_budget_categories(wedding_id: str):
    exists = await db.budget_categories.count_documents({"wedding_id": wedding_id})
    if exists > 0:
        return
    for c in DEFAULT_BUDGET_CATS:
        await db.budget_categories.insert_one({
            "cat_id": make_uid("bcat"),
            "wedding_id": wedding_id,
            "name": c,
            "created_at": now_utc().isoformat(),
        })


@api.get("/budget")
async def list_budget(ctx: Dict[str, Any] = Depends(require_wedding)):
    items = await db.budget_items.find({"wedding_id": ctx["wedding"]["wedding_id"]}, {"_id": 0}).to_list(1000)
    total_planned = sum(float(i.get("planned", 0) or 0) for i in items)
    total_actual = sum(float(i.get("actual", 0) or 0) for i in items)
    total_paid = sum(float(i.get("paid", 0) or 0) for i in items)
    return {
        "items": items,
        "categories": DEFAULT_BUDGET_CATS,
        "totals": {
            "planned": total_planned,
            "actual": total_actual,
            "paid": total_paid,
            "budget": float(ctx["wedding"].get("budget_amount") or 0),
            "remaining": float(ctx["wedding"].get("budget_amount") or 0) - total_actual,
        },
    }


@api.post("/budget")
async def add_budget_item(payload: BudgetItemCreate, ctx: Dict[str, Any] = Depends(require_wedding)):
    for f in ("planned", "actual", "paid"):
        v = getattr(payload, f)
        if v is not None and v < 0:
            raise HTTPException(status_code=400, detail=f"{f} cannot be negative")
    doc = payload.model_dump()
    doc.update({
        "item_id": make_uid("bitem"),
        "wedding_id": ctx["wedding"]["wedding_id"],
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    })
    await db.budget_items.insert_one(doc)
    doc.pop("_id", None)
    return {"item": doc}


@api.patch("/budget/{item_id}")
async def update_budget_item(item_id: str, payload: BudgetItemUpdate, ctx: Dict[str, Any] = Depends(require_wedding)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    for f in ("planned", "actual", "paid"):
        if f in updates and updates[f] < 0:
            raise HTTPException(status_code=400, detail=f"{f} cannot be negative")
    updates["updated_at"] = now_utc().isoformat()
    res = await db.budget_items.update_one(
        {"item_id": item_id, "wedding_id": ctx["wedding"]["wedding_id"]}, {"$set": updates}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    item = await db.budget_items.find_one({"item_id": item_id}, {"_id": 0})
    return {"item": item}


@api.delete("/budget/{item_id}")
async def delete_budget_item(item_id: str, ctx: Dict[str, Any] = Depends(require_wedding)):
    res = await db.budget_items.delete_one({"item_id": item_id, "wedding_id": ctx["wedding"]["wedding_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


# ---------- Guests ----------
@api.get("/guests")
async def list_guests(ctx: Dict[str, Any] = Depends(require_wedding)):
    rows = await db.guests.find({"wedding_id": ctx["wedding"]["wedding_id"]}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    counts = {"total": 0, "attending": 0, "declined": 0, "pending": 0}
    for r in rows:
        counts["total"] += int(r.get("number_of_guests") or 1)
        rsvp = r.get("rsvp", "pending")
        if rsvp in counts:
            counts[rsvp] += int(r.get("number_of_guests") or 1)
    return {"guests": rows, "counts": counts}


@api.post("/guests")
async def add_guest(payload: GuestCreate, ctx: Dict[str, Any] = Depends(require_wedding)):
    doc = payload.model_dump()
    doc.update({
        "guest_id": make_uid("guest"),
        "wedding_id": ctx["wedding"]["wedding_id"],
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    })
    await db.guests.insert_one(doc)
    doc.pop("_id", None)
    return {"guest": doc}


@api.patch("/guests/{guest_id}")
async def update_guest(guest_id: str, payload: GuestUpdate, ctx: Dict[str, Any] = Depends(require_wedding)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = now_utc().isoformat()
    res = await db.guests.update_one({"guest_id": guest_id, "wedding_id": ctx["wedding"]["wedding_id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    g = await db.guests.find_one({"guest_id": guest_id}, {"_id": 0})
    return {"guest": g}


@api.delete("/guests/{guest_id}")
async def delete_guest(guest_id: str, ctx: Dict[str, Any] = Depends(require_wedding)):
    res = await db.guests.delete_one({"guest_id": guest_id, "wedding_id": ctx["wedding"]["wedding_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    return {"ok": True}


# ---------- Vendors ----------
@api.get("/vendors")
async def list_vendors(ctx: Dict[str, Any] = Depends(require_wedding)):
    rows = await db.vendors.find({"wedding_id": ctx["wedding"]["wedding_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"vendors": rows}


@api.post("/vendors")
async def add_vendor(payload: VendorCreate, ctx: Dict[str, Any] = Depends(require_wedding)):
    doc = payload.model_dump()
    doc.update({
        "vendor_id": make_uid("vend"),
        "wedding_id": ctx["wedding"]["wedding_id"],
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    })
    await db.vendors.insert_one(doc)
    doc.pop("_id", None)
    return {"vendor": doc}


@api.patch("/vendors/{vendor_id}")
async def update_vendor(vendor_id: str, payload: VendorUpdate, ctx: Dict[str, Any] = Depends(require_wedding)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = now_utc().isoformat()
    res = await db.vendors.update_one({"vendor_id": vendor_id, "wedding_id": ctx["wedding"]["wedding_id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    v = await db.vendors.find_one({"vendor_id": vendor_id}, {"_id": 0})
    return {"vendor": v}


@api.delete("/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str, ctx: Dict[str, Any] = Depends(require_wedding)):
    res = await db.vendors.delete_one({"vendor_id": vendor_id, "wedding_id": ctx["wedding"]["wedding_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"ok": True}


# ---------- Timeline ----------
@api.get("/timeline")
async def list_events(ctx: Dict[str, Any] = Depends(require_wedding)):
    rows = await db.timeline_events.find({"wedding_id": ctx["wedding"]["wedding_id"]}, {"_id": 0}).sort("date", 1).to_list(1000)
    return {"events": rows}


@api.post("/timeline")
async def add_event(payload: EventCreate, ctx: Dict[str, Any] = Depends(require_wedding)):
    doc = payload.model_dump()
    doc.update({
        "event_id": make_uid("evt"),
        "wedding_id": ctx["wedding"]["wedding_id"],
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    })
    await db.timeline_events.insert_one(doc)
    doc.pop("_id", None)
    return {"event": doc}


@api.patch("/timeline/{event_id}")
async def update_event(event_id: str, payload: EventUpdate, ctx: Dict[str, Any] = Depends(require_wedding)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = now_utc().isoformat()
    res = await db.timeline_events.update_one({"event_id": event_id, "wedding_id": ctx["wedding"]["wedding_id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    e = await db.timeline_events.find_one({"event_id": event_id}, {"_id": 0})
    return {"event": e}


@api.delete("/timeline/{event_id}")
async def delete_event(event_id: str, ctx: Dict[str, Any] = Depends(require_wedding)):
    res = await db.timeline_events.delete_one({"event_id": event_id, "wedding_id": ctx["wedding"]["wedding_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True}


# ---------- Dashboard summary ----------
@api.get("/dashboard")
async def dashboard(ctx: Dict[str, Any] = Depends(require_wedding)):
    wed = ctx["wedding"]
    wid = wed["wedding_id"]
    tasks = await db.checklist_tasks.find({"wedding_id": wid}, {"_id": 0}).to_list(2000)
    total_tasks = len(tasks) or 1
    completed = sum(1 for t in tasks if t.get("status") == "completed")
    progress_pct = round(100 * completed / total_tasks)
    # This week
    today = now_utc().date()
    week_end = today + timedelta(days=7)
    this_week = []
    for t in tasks:
        if t.get("due_date") and t.get("status") != "completed":
            try:
                d = datetime.fromisoformat(t["due_date"]).date()
                if today <= d <= week_end:
                    this_week.append(t)
            except Exception:
                pass
    this_week.sort(key=lambda x: x.get("due_date") or "")
    # Budget
    items = await db.budget_items.find({"wedding_id": wid}, {"_id": 0}).to_list(2000)
    total_planned = sum(float(i.get("planned", 0) or 0) for i in items)
    total_actual = sum(float(i.get("actual", 0) or 0) for i in items)
    # Guests
    guests = await db.guests.find({"wedding_id": wid}, {"_id": 0}).to_list(2000)
    g_counts = {"total": 0, "attending": 0, "declined": 0, "pending": 0}
    for r in guests:
        g_counts["total"] += int(r.get("number_of_guests") or 1)
        rsvp = r.get("rsvp", "pending")
        if rsvp in g_counts:
            g_counts[rsvp] += int(r.get("number_of_guests") or 1)
    # Vendors
    vendors = await db.vendors.find({"wedding_id": wid}, {"_id": 0}).to_list(1000)
    booked = sum(1 for v in vendors if v.get("booking_status") in ("booked", "completed"))
    # Upcoming events
    events = await db.timeline_events.find({"wedding_id": wid}, {"_id": 0}).sort("date", 1).to_list(100)
    upcoming = [e for e in events if e.get("date") and e["date"] >= today.isoformat()][:5]

    days_to_go = None
    if wed.get("wedding_date"):
        try:
            d = datetime.fromisoformat(wed["wedding_date"].replace("Z", "+00:00")).date()
            days_to_go = (d - today).days
        except Exception:
            pass

    return {
        "wedding": wed,
        "progress": {"percent": progress_pct, "completed": completed, "total": total_tasks},
        "days_to_go": days_to_go,
        "this_week": this_week[:8],
        "budget": {
            "budget": float(wed.get("budget_amount") or 0),
            "planned": total_planned,
            "actual": total_actual,
            "remaining": float(wed.get("budget_amount") or 0) - total_actual,
        },
        "guests": g_counts,
        "vendors": {"total": len(vendors), "booked": booked, "pending": len(vendors) - booked},
        "upcoming": upcoming,
    }


# ---------- Weddly AI ----------
@api.post("/ai/chat")
async def ai_chat(payload: AIChatIn, ctx: Dict[str, Any] = Depends(require_wedding)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

    wed = ctx["wedding"]
    wid = wed["wedding_id"]
    # Gather compact wedding context
    tasks = await db.checklist_tasks.find({"wedding_id": wid}, {"_id": 0}).to_list(500)
    pending_tasks = [t["title"] for t in tasks if t.get("status") != "completed"][:15]
    items = await db.budget_items.find({"wedding_id": wid}, {"_id": 0}).to_list(500)
    total_actual = sum(float(i.get("actual", 0) or 0) for i in items)
    guests = await db.guests.count_documents({"wedding_id": wid})

    context = f"""You are Weddly AI, a warm, empathetic wedding-planning assistant for Indonesian couples.
Always respond in the user's language (Indonesian or English). Give practical, culturally-aware advice for Indonesian weddings (Akad Nikah, Resepsi, Sangjit, Tea Pai, etc.).
Never claim to give legal/financial/contractual guarantees. Never invent vendor info.

Wedding context:
- Couple: {wed.get('partner1_nickname') or wed.get('partner1_name') or 'Partner 1'} & {wed.get('partner2_nickname') or wed.get('partner2_name') or 'Partner 2'}
- Wedding date: {wed.get('wedding_date') or 'not set yet'}
- Location: {wed.get('city') or 'not set'}, {wed.get('country') or ''}
- Budget: Rp {int(wed.get('budget_amount') or 0):,} IDR (spent so far: Rp {int(total_actual):,})
- Estimated guests: {wed.get('guest_count') or 0} (currently in list: {guests})
- Wedding types: {', '.join(wed.get('wedding_types') or []) or 'not specified'}
- Style: {', '.join(wed.get('wedding_styles') or []) or 'not specified'}
- Priorities/challenges: {', '.join((wed.get('priorities') or []) + (wed.get('challenges') or [])) or 'none'}
- Top pending tasks: {', '.join(pending_tasks) or 'none pending'}
"""
    model_id = payload.model or "claude-sonnet-4-6"
    if model_id.startswith("gemini"):
        provider, model_name = "gemini", "gemini-3-flash-preview"
    else:
        provider, model_name = "anthropic", "claude-sonnet-4-6"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"{wid}-{ctx['user']['user_id']}",
        system_message=context,
    ).with_model(provider, model_name)

    async def gen():
        try:
            async for ev in chat.stream_message(UserMessage(text=payload.message)):
                if isinstance(ev, TextDelta):
                    yield ev.content
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.exception("AI stream failed")
            yield f"\n\n[Weddly AI encountered an issue: {str(e)[:120]}]"

    return StreamingResponse(
        gen(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------- Startup: seed sandbox token ----------
@app.on_event("startup")
async def on_startup():
    # Ensure indexes
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.access_tokens.create_index("token_code", unique=True)
    await db.wedding_members.create_index([("wedding_id", 1), ("user_id", 1)], unique=True)
    # Seed sandbox demo token if missing
    existing = await db.access_tokens.find_one({"token_code": "WDL-DEMO-2026-LOVE"})
    if not existing:
        await db.access_tokens.insert_one({
            "token_id": make_uid("tok"),
            "token_code": "WDL-DEMO-2026-LOVE",
            "status": "unused",
            "package": "weddly-sandbox",
            "max_members": 2,
            "current_member_count": 0,
            "wedding_id": None,
            "created_at": now_utc().isoformat(),
            "activated_at": None,
            "expires_at": None,
            "revoked_at": None,
            "metadata": {"seeded": True},
        })
        logger.info("Seeded sandbox token WDL-DEMO-2026-LOVE")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
