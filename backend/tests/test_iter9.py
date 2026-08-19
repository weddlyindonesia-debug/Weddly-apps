"""Iteration 9 backend tests: admin token flow, activate flow multi-user, AI chat lang field."""
import os
import time
import subprocess
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
ADMIN_KEY = "weddly-admin-2026-secure"


def mongo_eval(js: str) -> str:
    r = subprocess.run(
        ["mongosh", "--quiet", "--eval", js],
        capture_output=True, text=True, timeout=15,
    )
    return (r.stdout or "") + (r.stderr or "")


def seed_user(email_prefix: str, is_admin: bool = False) -> dict:
    """Seed a user + user_session in test_database. Returns {user_id, email, session_token}."""
    ts = int(time.time() * 1000)
    email = f"{email_prefix}.{ts}@example.com" if not is_admin else "weddlyindonesia@gmail.com"
    user_id = f"user_{ts}_{email_prefix}"
    session_token = f"test_session_{ts}_{email_prefix}"
    js = f"""
use('test_database');
db.users.updateOne(
  {{email: '{email}'}},
  {{$setOnInsert: {{user_id: '{user_id}', email: '{email}', name: 'Test {email_prefix}', picture: '', created_at: new Date()}}}},
  {{upsert: true}}
);
var u = db.users.findOne({{email: '{email}'}});
db.user_sessions.insertOne({{
  user_id: u.user_id,
  session_token: '{session_token}',
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
print('UID=' + u.user_id);
"""
    out = mongo_eval(js)
    uid = None
    for line in out.splitlines():
        if line.startswith("UID="):
            uid = line[4:].strip()
    return {"user_id": uid, "email": email, "session_token": session_token}


def client_with_session(session_token: str) -> requests.Session:
    s = requests.Session()
    s.cookies.set("session_token", session_token)
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Admin token generate ----------
def test_admin_generate_token():
    r = requests.post(
        f"{BASE_URL}/api/admin/tokens/generate",
        headers={"x-admin-key": ADMIN_KEY, "Content-Type": "application/json"},
        cookies={"session_token": "dummy-for-admin-key-path"},
        json={"count": 1},
    )
    # Admin key path requires get_current_user first — will 401 without a valid session.
    # So seed an admin session and retry with x-admin-key too (belt & suspenders).
    if r.status_code == 401:
        admin = seed_user("admin_iter9", is_admin=True)
        r = requests.post(
            f"{BASE_URL}/api/admin/tokens/generate",
            headers={"x-admin-key": ADMIN_KEY, "Content-Type": "application/json"},
            cookies={"session_token": admin["session_token"]},
            json={"count": 1},
        )
    assert r.status_code == 200, r.text
    tokens = r.json()["tokens"]
    assert len(tokens) == 1
    assert tokens[0]["token_code"].startswith("WDL-")
    assert tokens[0]["status"] == "unused"
    # stash for later
    pytest.token_iter9 = tokens[0]["token_code"]


# ---------- Admin (already in wedding) activates a new token ----------
def test_admin_activates_new_token_no_409():
    """Admin user is already in sandbox wedding; activating a fresh token should succeed (200)."""
    # Ensure admin has an existing membership - activate sandbox token first if not member yet
    admin = seed_user("adminA", is_admin=True)
    c = client_with_session(admin["session_token"])
    # Try sandbox first (idempotent — will 200 if already member, or claim if unused).
    c.post(f"{BASE_URL}/api/wedding/activate", json={"token_code": "WDL-DEMO-2026-LOVE"})

    # Now generate a fresh token
    r = requests.post(
        f"{BASE_URL}/api/admin/tokens/generate",
        headers={"x-admin-key": ADMIN_KEY, "Content-Type": "application/json"},
        cookies={"session_token": admin["session_token"]},
        json={"count": 1},
    )
    assert r.status_code == 200, r.text
    fresh = r.json()["tokens"][0]["token_code"]

    # Admin activates the fresh token — must NOT 409
    r2 = c.post(f"{BASE_URL}/api/wedding/activate", json={"token_code": fresh})
    assert r2.status_code == 200, f"Expected 200 for admin activating new token, got {r2.status_code}: {r2.text}"
    data = r2.json()
    assert data["wedding"]["token_code"] == fresh
    assert data["membership"]["user_id"] == admin["user_id"]
    assert data["membership"]["partner_number"] == 1

    # /api/auth/me returns the NEW wedding (most-recent joined)
    me = c.get(f"{BASE_URL}/api/auth/me")
    assert me.status_code == 200
    mej = me.json()
    assert mej["wedding"]["token_code"] == fresh, f"me.wedding should be new token, got {mej['wedding'].get('token_code')}"

    pytest.fresh_token = fresh
    pytest.fresh_wedding_id = data["wedding"]["wedding_id"]


# ---------- New user B joins same token as partner 2 ----------
def test_new_user_activates_same_token_becomes_partner2():
    fresh = getattr(pytest, "fresh_token", None)
    assert fresh, "requires previous test"
    userB = seed_user("userB")
    c = client_with_session(userB["session_token"])
    r = c.post(f"{BASE_URL}/api/wedding/activate", json={"token_code": fresh})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["membership"]["partner_number"] == 2
    assert data["wedding"]["wedding_id"] == pytest.fresh_wedding_id


# ---------- User C activation of same token -> 409 ----------
def test_third_user_activation_returns_409():
    fresh = getattr(pytest, "fresh_token", None)
    assert fresh
    userC = seed_user("userC")
    c = client_with_session(userC["session_token"])
    r = c.post(f"{BASE_URL}/api/wedding/activate", json={"token_code": fresh})
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
    assert "already connected to two accounts" in r.text.lower()


# ---------- AI chat accepts lang field and streams ----------
def test_ai_chat_accepts_lang_field():
    admin = seed_user("aichat_user", is_admin=True)
    c = client_with_session(admin["session_token"])
    # Ensure has a wedding
    c.post(f"{BASE_URL}/api/wedding/activate", json={"token_code": "WDL-DEMO-2026-LOVE"})

    r = requests.post(
        f"{BASE_URL}/api/ai/chat",
        cookies={"session_token": admin["session_token"]},
        headers={"Content-Type": "application/json"},
        json={"message": "Hi", "model": "claude-sonnet-4-6", "lang": "id"},
        stream=True,
        timeout=45,
    )
    assert r.status_code == 200, f"AI chat failed: {r.status_code} {r.text[:300]}"
    chunks = []
    for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
        if chunk:
            chunks.append(chunk)
        if sum(len(c) for c in chunks) > 20:
            break
    body = "".join(chunks)
    assert len(body) > 0, "Expected streamed content"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
