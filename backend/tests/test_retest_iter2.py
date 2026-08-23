"""Retest for iteration_2: activation serialization fix, AI chat streaming, cross-tenant guards."""
import os
import re
import uuid
from pathlib import Path
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback: read frontend/.env relative to this repo (portable across OS)
    _env = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if _env.exists():
        with open(_env) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE = line.split("=", 1)[1].strip().rstrip("/")
if not BASE:
    BASE = "http://localhost:8000"
API = f"{BASE}/api"
ADMIN_KEY = "weddly-admin-2026-secure"
ADMIN_EMAIL = "weddlyindonesia@gmail.com"

MONGO = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
db = MONGO[os.environ.get("DB_NAME", "test_database")]


def make_session(email: str, name: str = "Test User"):
    db.users.update_one(
        {"email": email},
        {"$setOnInsert": {
            "user_id": str(uuid.uuid4()),
            "email": email,
            "name": name,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    u = db.users.find_one({"email": email})
    token = f"tst-{uuid.uuid4()}"
    db.user_sessions.insert_one({
        "session_token": token,
        "user_id": u["user_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        "created_at": datetime.now(timezone.utc),
    })
    return token, u["user_id"]


def h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def gen_fresh_token():
    admin_tok, _ = make_session(ADMIN_EMAIL, "Admin")
    r = requests.post(f"{API}/admin/tokens/generate",
                      headers={**h(admin_tok), "x-admin-key": ADMIN_KEY},
                      json={"quantity": 1})
    assert r.status_code == 200, r.text
    data = r.json()
    codes = data.get("tokens") or data.get("codes") or data
    if isinstance(codes, list):
        c = codes[0]
        code = c if isinstance(c, str) else (c.get("token_code") or c.get("code"))
    else:
        code = codes
    assert re.match(r"^WDL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$", code), f"bad code {code}"
    return code


# ---- Activation serialization retest ----

def test_partner1_activation_returns_200_and_json():
    code = gen_fresh_token()
    tok, _ = make_session(f"TEST_p1_{uuid.uuid4().hex[:6]}@t.com", "Partner1")
    r = requests.post(f"{API}/wedding/activate", headers=h(tok), json={"token_code": code})
    assert r.status_code == 200, f"Expected 200 got {r.status_code}: {r.text}"
    body = r.json()
    assert "wedding" in body and "membership" in body
    assert body["membership"].get("user_id")
    assert "_id" not in body["wedding"]
    assert "_id" not in body["membership"]


def test_partner2_activation_returns_200():
    code = gen_fresh_token()
    tok1, _ = make_session(f"TEST_p1b_{uuid.uuid4().hex[:6]}@t.com", "P1")
    r1 = requests.post(f"{API}/wedding/activate", headers=h(tok1), json={"token_code": code})
    assert r1.status_code == 200, r1.text
    tok2, _ = make_session(f"TEST_p2_{uuid.uuid4().hex[:6]}@t.com", "P2")
    r2 = requests.post(f"{API}/wedding/activate", headers=h(tok2), json={"token_code": code})
    assert r2.status_code == 200, f"Partner2 expected 200 got {r2.status_code}: {r2.text}"
    body = r2.json()
    assert "membership" in body
    assert "_id" not in body["membership"]
    assert "_id" not in body.get("wedding", {})


def test_third_user_gets_409():
    code = gen_fresh_token()
    for i in range(2):
        tok, _ = make_session(f"TEST_pfill_{i}_{uuid.uuid4().hex[:6]}@t.com", "P")
        r = requests.post(f"{API}/wedding/activate", headers=h(tok), json={"token_code": code})
        assert r.status_code == 200, r.text
    tok3, _ = make_session(f"TEST_p3_{uuid.uuid4().hex[:6]}@t.com", "P3")
    r3 = requests.post(f"{API}/wedding/activate", headers=h(tok3), json={"token_code": code})
    assert r3.status_code == 409, f"third-user expected 409 got {r3.status_code}: {r3.text}"
    assert "two" in r3.text.lower() or "already" in r3.text.lower()


# ---- AI chat streaming ----

def test_ai_chat_streams_text():
    # AI chat requires an active wedding workspace
    code = gen_fresh_token()
    tok, _ = make_session(f"TEST_ai_{uuid.uuid4().hex[:6]}@t.com", "AI User")
    ra = requests.post(f"{API}/wedding/activate", headers=h(tok), json={"token_code": code})
    assert ra.status_code == 200, ra.text

    r = requests.post(
        f"{API}/ai/chat",
        headers=h(tok),
        json={"message": "Hello, respond with just: hi", "model": "claude-sonnet-4-6"},
        stream=True,
        timeout=90,
    )
    assert r.status_code == 200, f"AI chat expected 200 got {r.status_code}: {r.text[:500]}"
    ctype = r.headers.get("content-type", "")
    assert "text/plain" in ctype or "text/event-stream" in ctype or "application/octet-stream" in ctype, f"unexpected ctype: {ctype}"
    body = b""
    for chunk in r.iter_content(chunk_size=None):
        body += chunk
        if len(body) > 4096:
            break
    assert len(body.strip()) > 0, "empty AI response"
    print("AI response snippet:", body[:200])


# ---- Multi-tenancy guards ----

def _new_user_with_wedding():
    code = gen_fresh_token()
    tok, _ = make_session(f"TEST_mt_{uuid.uuid4().hex[:6]}@t.com", "MT")
    r = requests.post(f"{API}/wedding/activate", headers=h(tok), json={"token_code": code})
    assert r.status_code == 200, r.text
    return tok


@pytest.fixture(scope="module")
def user_a():
    return _new_user_with_wedding()


@pytest.fixture(scope="module")
def user_b():
    return _new_user_with_wedding()


def test_cross_tenant_checklist(user_a, user_b):
    r = requests.post(f"{API}/checklist", headers=h(user_a),
                      json={"title": "TEST_A_task", "category": "Planning"})
    assert r.status_code in (200, 201), r.text
    j = r.json(); task_id = j.get("task_id") or (j.get("task") or {}).get("task_id")
    assert task_id, r.text
    r2 = requests.patch(f"{API}/checklist/{task_id}", headers=h(user_b),
                        json={"status": "done"})
    assert r2.status_code == 404, f"PATCH expected 404 got {r2.status_code}: {r2.text}"
    r3 = requests.delete(f"{API}/checklist/{task_id}", headers=h(user_b))
    assert r3.status_code == 404, f"DELETE expected 404 got {r3.status_code}: {r3.text}"


def test_cross_tenant_budget(user_a, user_b):
    r = requests.post(f"{API}/budget", headers=h(user_a),
                      json={"category": "Venue", "name": "TEST_A_venue", "planned": 100})
    assert r.status_code in (200, 201), r.text
    j = r.json(); iid = j.get("item_id") or (j.get("item") or {}).get("item_id")
    assert iid, r.text
    r2 = requests.patch(f"{API}/budget/{iid}", headers=h(user_b), json={"planned": 200})
    assert r2.status_code == 404, r2.text
    r3 = requests.delete(f"{API}/budget/{iid}", headers=h(user_b))
    assert r3.status_code == 404, r3.text


def test_cross_tenant_guests(user_a, user_b):
    r = requests.post(f"{API}/guests", headers=h(user_a),
                      json={"name": "TEST_A_guest", "group": "Friends"})
    assert r.status_code in (200, 201), r.text
    j = r.json(); gid = j.get("guest_id") or (j.get("guest") or {}).get("guest_id")
    assert gid, r.text
    r2 = requests.patch(f"{API}/guests/{gid}", headers=h(user_b), json={"rsvp": "attending"})
    assert r2.status_code == 404, r2.text
    r3 = requests.delete(f"{API}/guests/{gid}", headers=h(user_b))
    assert r3.status_code == 404, r3.text


def test_cross_tenant_vendors(user_a, user_b):
    r = requests.post(f"{API}/vendors", headers=h(user_a),
                      json={"name": "TEST_A_vendor", "category": "Photo"})
    assert r.status_code in (200, 201), r.text
    j = r.json(); vid = j.get("vendor_id") or (j.get("vendor") or {}).get("vendor_id")
    assert vid, r.text
    r2 = requests.patch(f"{API}/vendors/{vid}", headers=h(user_b), json={"booking_status": "booked"})
    assert r2.status_code == 404, r2.text
    r3 = requests.delete(f"{API}/vendors/{vid}", headers=h(user_b))
    assert r3.status_code == 404, r3.text


def test_cross_tenant_timeline(user_a, user_b):
    r = requests.post(f"{API}/timeline", headers=h(user_a),
                      json={"title": "TEST_A_event", "date": "2026-06-01", "start_time": "10:00"})
    assert r.status_code in (200, 201), r.text
    j = r.json(); eid = j.get("event_id") or (j.get("event") or {}).get("event_id")
    assert eid, r.text
    r2 = requests.patch(f"{API}/timeline/{eid}", headers=h(user_b), json={"title": "Hacked"})
    assert r2.status_code == 404, r2.text
    r3 = requests.delete(f"{API}/timeline/{eid}", headers=h(user_b))
    assert r3.status_code == 404, r3.text
