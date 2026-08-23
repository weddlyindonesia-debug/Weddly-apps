"""Weddly backend - FastAPI + MongoDB."""
from __future__ import annotations

import os
import re
import uuid
import secrets
import hashlib
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Header, Depends, status
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, Field, EmailStr
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL","mongodb://127.0.0.1:27017")
DB_NAME=os.environ.get("DB_NAME","weddly")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("weddly")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure indexes
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("phone", unique=True, sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.wedding_members.create_index([("wedding_id", 1), ("user_id", 1)], unique=True)
    logger.info(f"Connected to MongoDB: {DB_NAME}")
    yield
    client.close()
    logger.info("MongoDB connection closed")


app = FastAPI(title="Weddly API", version="1.0.0", lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def make_uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


PHONE_RE = re.compile(r"^\+?[0-9]{8,15}$")


def normalize_phone(raw: str) -> str:
    return re.sub(r"[\s\-]", "", raw or "")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}:{dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hash_hex = stored.split(":")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
        return dk.hex() == hash_hex
    except Exception:
        return False


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
    if user.get("phone", "") and user.get("phone", "") in ADMIN_EMAILS:
        return user
    raise HTTPException(status_code=403, detail="Admin access required")


async def get_active_membership(user: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    # Users may have multiple memberships; return most-recently joined active one.
    cur = db.wedding_members.find(
        {"user_id": user["user_id"], "status": "active"}, {"_id": 0}
    ).sort("joined_at", -1).limit(1)
    rows = await cur.to_list(1)
    return rows[0] if rows else None


async def require_wedding(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    m = await get_active_membership(user)
    if not m:
        raise HTTPException(status_code=403, detail="No active wedding workspace")
    w = await db.wedding_workspaces.find_one({"wedding_id": m["wedding_id"]}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Wedding not found")
    return {"user": user, "membership": m, "wedding": w}


# ---------- Models ----------
class RegisterIn(BaseModel):
    phone: str
    password: str
    name: str
    ref: Optional[str] = None  # wedding_id from a partner's invite link, if any


class LoginIn(BaseModel):
    phone: str
    password: str

# --- TAMBAHAN BARU: MODEL GANTI PASSWORD ---
class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


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
    lang: Optional[str] = "en"


class ThemeUpdate(BaseModel):
    theme_id: str


# --- TAMBAHAN BARU: MODEL ADMIN RESET PASSWORD ---
class AdminResetPasswordIn(BaseModel):
    new_password: Optional[str] = None  # Jika kosong, sistem akan generate otomatis


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


# ---------- DEV LOGIN (testing only, bypass Google) ----------
@api.post("/auth/dev-login")
async def dev_login(response: Response):
    # Security: this endpoint must never be reachable in production.
    # Enable it explicitly for local development via ENABLE_DEV_LOGIN=1 in backend/.env
    if os.environ.get("ENABLE_DEV_LOGIN", "").strip().lower() not in ("1", "true", "yes"):
        raise HTTPException(status_code=404, detail="Not found")
    email = "dev@weddly.local"
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
    else:
        user_id = make_uid("user")
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": "Dev User",
            "picture": "",
            "created_at": now_utc().isoformat(),
        })

    session_token = secrets.token_hex(32)
    expires = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires.isoformat(),
        "created_at": now_utc().isoformat(),
    })
    response.set_cookie(
        "session_token", session_token,
        httponly=True, secure=False, samesite="lax",
        path="/", max_age=7 * 24 * 60 * 60,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user}


@api.get("/auth/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    # Never leak the password hash to the client
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    member = await get_active_membership(user)
    wedding = None
    if member:
        wedding = await db.wedding_workspaces.find_one({"wedding_id": member["wedding_id"]}, {"_id": 0})
    return {
        "user": safe_user,
        "membership": member,
        "wedding": wedding,
        "is_admin": user.get("email", "").lower() in ADMIN_EMAILS or user.get("phone", "") in ADMIN_EMAILS,
    }


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------- Register / Login (phone + password) ----------
@api.post("/auth/register")
async def register(payload: RegisterIn):
    phone = normalize_phone(payload.phone)
    if not PHONE_RE.match(phone):
        raise HTTPException(status_code=400, detail="Nomor HP tidak valid")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter")
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Nama wajib diisi")
    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=409, detail="Nomor HP sudah terdaftar")

    # Optional partner invite link: ?ref=<wedding_id> shared by the main account.
    pending_wedding_id = None
    if payload.ref:
        ref = payload.ref.strip()
        ref_wedding = await db.wedding_workspaces.find_one({"wedding_id": ref}, {"_id": 0})
        if not ref_wedding:
            raise HTTPException(status_code=400, detail="Link undangan tidak valid")
        active_count = await db.wedding_members.count_documents({"wedding_id": ref, "status": "active"})
        pending_count = await db.users.count_documents({"pending_wedding_id": ref, "status": "pending"})
        if active_count + pending_count >= 2:
            raise HTTPException(status_code=400, detail="Link undangan ini sudah digunakan oleh pasangan")
        pending_wedding_id = ref

    user_id = make_uid("user")
    try:
        await db.users.insert_one({
            "user_id": user_id,
            "phone": phone,
            "name": payload.name.strip(),
            "password_hash": hash_password(payload.password),
            "status": "pending",
            "pending_wedding_id": pending_wedding_id,
            "created_at": now_utc().isoformat(),
        })
    except DuplicateKeyError:
        # Unique index on phone catches concurrent registrations of the same number
        raise HTTPException(status_code=409, detail="Nomor HP sudah terdaftar")
    return {"ok": True, "message": "Pendaftaran berhasil. Menunggu persetujuan admin."}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    phone = normalize_phone(payload.phone)
    user = await db.users.find_one({"phone": phone})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Nomor HP atau password salah")
    if user.get("status") == "pending":
        raise HTTPException(status_code=403, detail="Akun Anda masih menunggu persetujuan admin")
    if user.get("status") == "rejected":
        raise HTTPException(status_code=403, detail="Pendaftaran Anda ditolak. Hubungi admin.")

    session_token = secrets.token_hex(32)
    expires = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires.isoformat(),
        "created_at": now_utc().isoformat(),
    })
    response.set_cookie(
        "session_token", session_token,
        httponly=True, secure=False, samesite="lax",
        path="/", max_age=7 * 24 * 60 * 60,
    )
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"user": user}

# --- TAMBAHAN BARU: ROUTE GANTI PASSWORD ---
@api.post("/auth/change-password")
async def change_password(payload: ChangePasswordIn, user: Dict[str, Any] = Depends(get_current_user)):
    stored_hash = user.get("password_hash", "")
    # 1. Verifikasi password lama.
    # User yang dibuat via OAuth (Google) belum punya password: izinkan mereka
    # mengatur password pertama kali tanpa memverifikasi password lama.
    if stored_hash and not verify_password(payload.current_password, stored_hash):
        raise HTTPException(status_code=400, detail="Password saat ini salah.")

    # 2. Validasi password baru (minimal 6 karakter, sesuai aturan registrasi)
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter.")

    # 3. Hash password baru dan simpan ke database
    new_hashed = hash_password(payload.new_password)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"password_hash": new_hashed, "updated_at": now_utc().isoformat()}}
    )
    
    # Opsional (Disarankan): Hapus semua sesi login user agar user harus login ulang
    # dengan password baru demi keamanan.
    await db.user_sessions.delete_many({"user_id": user["user_id"]})

    return {"message": "Password berhasil diubah."}


# ---------- Admin: user approval ----------
class AdminApproveIn(BaseModel):
    # If provided, the approved user joins this existing wedding as partner 2
    # instead of getting a brand-new workspace of their own.
    pair_wedding_id: Optional[str] = None


@api.get("/admin/users/pending")
async def admin_list_pending(user: Dict[str, Any] = Depends(require_admin)):
    rows = await db.users.find({"status": "pending"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    for r in rows:
        r["linked_partner"] = None
        wid = r.get("pending_wedding_id")
        if wid:
            member = await db.wedding_members.find_one({"wedding_id": wid, "status": "active"}, {"_id": 0})
            if member:
                partner = await db.users.find_one({"user_id": member["user_id"]}, {"_id": 0, "password_hash": 0})
                if partner:
                    r["linked_partner"] = {"name": partner.get("name"), "phone": partner.get("phone")}
    return {"users": rows}


@api.get("/admin/weddings/unpaired")
async def admin_list_unpaired_weddings(admin: Dict[str, Any] = Depends(require_admin)):
    """Weddings that currently have only 1 active partner, so an admin can pair
    a newly-approved user into them as partner 2."""
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$wedding_id", "count": {"$sum": 1}}},
        {"$match": {"count": 1}},
    ]
    grouped = await db.wedding_members.aggregate(pipeline).to_list(1000)
    wedding_ids = [g["_id"] for g in grouped]
    if not wedding_ids:
        return {"weddings": []}
    weddings = await db.wedding_workspaces.find({"wedding_id": {"$in": wedding_ids}}, {"_id": 0}).to_list(1000)
    result = []
    for w in weddings:
        member = await db.wedding_members.find_one(
            {"wedding_id": w["wedding_id"], "status": "active"}, {"_id": 0}
        )
        partner1 = None
        if member:
            partner1 = await db.users.find_one({"user_id": member["user_id"]}, {"_id": 0, "password_hash": 0})
        result.append({"wedding": w, "partner1": partner1})
    return {"weddings": result}


@api.post("/admin/users/{user_id}/approve")
async def admin_approve_user(user_id: str, payload: AdminApproveIn = AdminApproveIn(), admin: Dict[str, Any] = Depends(require_admin)):
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("status") != "pending":
        raise HTTPException(status_code=400, detail="User is not pending")

    now_iso = now_utc().isoformat()
    joined_existing = False

    # Priority: an explicit admin override (pair_wedding_id) wins; otherwise use the
    # wedding_id the user registered with via a partner's invite link, if it's still valid.
    target_wedding_id = payload.pair_wedding_id or target.get("pending_wedding_id")

    if target_wedding_id:
        wedding = await db.wedding_workspaces.find_one({"wedding_id": target_wedding_id})
        if not wedding:
            raise HTTPException(status_code=404, detail="Wedding workspace to pair with not found")
        active_count = await db.wedding_members.count_documents(
            {"wedding_id": target_wedding_id, "status": "active"}
        )
        if active_count >= 2:
            raise HTTPException(status_code=400, detail="Wedding workspace already has 2 members")
        existing_p1 = await db.wedding_members.find_one(
            {"wedding_id": target_wedding_id, "partner_number": 1, "status": "active"}
        )
        partner_number = 2 if existing_p1 else 1
        await db.wedding_members.insert_one({
            "member_id": make_uid("mem"),
            "wedding_id": target_wedding_id,
            "user_id": user_id,
            "role": "partner",
            "partner_number": partner_number,
            "joined_at": now_iso,
            "status": "active",
        })
        joined_existing = True

    if not joined_existing:
        wedding_id = make_uid("wed")
        await db.wedding_workspaces.insert_one({
            "wedding_id": wedding_id,
            "partner1_name": "", "partner1_nickname": "",
            "partner2_name": "", "partner2_nickname": "",
            "wedding_date": None, "date_status": "undecided",
            "country": "", "city": "",
            "venue_ceremony": "", "venue_reception": "", "venue_mode": "undecided",
            "budget_amount": 0, "budget_currency": "IDR",
            "guest_count": 0,
            "wedding_types": [], "wedding_styles": [], "wedding_colors": [],
            "completed_items": [], "challenges": [], "priorities": [],
            "theme_id": "ivory_champagne",
            "setup_step": 1, "setup_complete": False,
            "created_at": now_iso, "updated_at": now_iso,
        })
        await db.wedding_members.insert_one({
            "member_id": make_uid("mem"),
            "wedding_id": wedding_id,
            "user_id": user_id,
            "role": "partner",
            "partner_number": 1,
            "joined_at": now_iso,
            "status": "active",
        })

    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "approved", "approved_at": now_iso}})
    return {"ok": True, "joined_existing": joined_existing}


@api.post("/admin/users/{user_id}/reject")
async def admin_reject_user(user_id: str, admin: Dict[str, Any] = Depends(require_admin)):
    res = await db.users.update_one({"user_id": user_id, "status": "pending"}, {"$set": {"status": "rejected"}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found or not pending")
    return {"ok": True}


# --- TAMBAHAN BARU: ROUTE ADMIN RESET PASSWORD ---
@api.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: str, 
    payload: AdminResetPasswordIn = AdminResetPasswordIn(), 
    admin: Dict[str, Any] = Depends(require_admin)
):
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Validasi jika admin memasukkan password manual
    if payload.new_password and len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")

    # Generate password acak jika admin tidak mengisinya
    new_password = payload.new_password or secrets.token_urlsafe(8)

    # Hash dan simpan password baru
    new_hashed = hash_password(new_password)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"password_hash": new_hashed, "updated_at": now_utc().isoformat()}}
    )

    # Hapus semua sesi user tersebut agar mereka dipaksa logout dan login ulang
    await db.user_sessions.delete_many({"user_id": user_id})

    return {"ok": True, "new_password": new_password}


# ---------- Admin: User Activity (Online Status) ----------
@api.get("/admin/users/activity")
async def get_users_activity(admin: Dict[str, Any] = Depends(require_admin)):
    """
    Menampilkan semua user yang sudah approved beserta status login (online/offline)
    dan waktu login terakhir berdasarkan session yang masih aktif.
    """
    # Ambil semua user yang statusnya approved
    users_cursor = db.users.find(
        {"status": "approved"}, 
        {"_id": 0, "password_hash": 0}
    )
    users = await users_cursor.to_list(1000)
    
    now = now_utc()
    result = []
    
    for user in users:
        # Cari session terbaru untuk user ini, lalu cek kedaluwarsa di Python.
        # (Membandingkan string ISO via $gt di Mongo rapuh terhadap perbedaan format.)
        session = await db.user_sessions.find_one(
            {"user_id": user["user_id"]},
            sort=[("created_at", -1)]  # Ambil session terbaru
        )
        
        is_online = False
        last_login = None
        if session:
            last_login = session.get("created_at")
            exp = session.get("expires_at")
            if isinstance(exp, str):
                try:
                    e = datetime.fromisoformat(exp)
                    if e.tzinfo is None:
                        e = e.replace(tzinfo=timezone.utc)
                    is_online = e > now
                except ValueError:
                    is_online = False
        
        # Cek apakah user adalah admin (untuk ditampilkan di kolom)
        is_admin = (
            user.get("email", "").lower() in ADMIN_EMAILS or 
            user.get("phone", "") in ADMIN_EMAILS
        )
        
        result.append({
            "user_id": user["user_id"],
            "name": user.get("name", "-"),
            "phone": user.get("phone", "-"),
            "is_online": is_online,
            "last_login": last_login,  # Waktu login terakhir
            "is_admin": is_admin,
        })
    
    return {"users": result}


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


@api.get("/wedding/invite")
async def get_wedding_invite(ctx: Dict[str, Any] = Depends(require_wedding)):
    """Returns the ref code to share with a partner so they auto-join this workspace
    once an admin approves their registration."""
    active_count = await db.wedding_members.count_documents(
        {"wedding_id": ctx["wedding"]["wedding_id"], "status": "active"}
    )
    return {
        "ref": ctx["wedding"]["wedding_id"],
        "full": active_count >= 2,
    }


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
    raise HTTPException(status_code=501, detail="Fitur AI chat sedang dinonaktifkan sementara. Silakan coba lagi nanti.")


# ---------- Startup / Shutdown ----------
# (Handled by the FastAPI lifespan context defined above)


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)