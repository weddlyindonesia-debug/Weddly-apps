import requests, json, sys, os

BASE = "https://couple-together-3.preview.emergentagent.com/api"
A = {"Authorization": "Bearer tt_a_sess"}
B = {"Authorization": "Bearer tt_b_sess"}
C = {"Authorization": "Bearer tt_c_sess"}
ADMIN = {"Authorization": "Bearer tt_admin_sess"}
XKEY = {"x-admin-key": "weddly-admin-2026-secure"}

results = []
def rec(name, ok, info=""):
    results.append((name, ok, info))
    print(("PASS" if ok else "FAIL"), name, "-", info)

# 1. /auth/me 401
r = requests.get(f"{BASE}/auth/me")
rec("auth/me no session 401", r.status_code == 401, str(r.status_code))

# 2. /auth/me with bearer
r = requests.get(f"{BASE}/auth/me", headers=A)
rec("auth/me bearer works", r.status_code == 200, str(r.status_code))

# 3. Admin token generate with x-admin-key (no auth user)
r = requests.post(f"{BASE}/admin/tokens/generate", json={"count":2}, headers={**XKEY, **A})
ok = r.status_code == 200 and len(r.json().get("tokens",[])) == 2
new_token = r.json()["tokens"][0]["token_code"] if ok else None
import re
ok2 = bool(new_token and re.match(r"^WDL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$", new_token))
rec("admin generate tokens format", ok and ok2, f"{r.status_code} {new_token}")

# Admin generate with admin user (no key)
r = requests.post(f"{BASE}/admin/tokens/generate", json={"count":1}, headers=ADMIN)
rec("admin generate via admin user", r.status_code == 200, str(r.status_code))

# Non-admin denied
r = requests.post(f"{BASE}/admin/tokens/generate", json={"count":1}, headers=A)
rec("non-admin denied 403", r.status_code == 403, str(r.status_code))

# 4. List tokens includes DEMO
r = requests.get(f"{BASE}/admin/tokens", headers=ADMIN)
codes = [t["token_code"] for t in r.json().get("tokens",[])]
rec("admin list contains demo", "WDL-DEMO-2026-LOVE" in codes, str(r.status_code))

# 5. Invalid token format
r = requests.post(f"{BASE}/wedding/activate", json={"token_code":"BAD-CODE"}, headers=A)
rec("invalid format 400", r.status_code == 400, str(r.status_code))

# Not found
r = requests.post(f"{BASE}/wedding/activate", json={"token_code":"WDL-ZZZZ-ZZZZ-ZZZZ"}, headers=A)
rec("token not found 404", r.status_code == 404, str(r.status_code))

# 6. Activate as partner 1 (user A)
r = requests.post(f"{BASE}/wedding/activate", json={"token_code":"wdl-demo-2026-love"}, headers=A)  # lowercase normalize
ok = r.status_code == 200 and r.json()["membership"]["partner_number"] == 1
wed_id = r.json()["wedding"]["wedding_id"] if r.status_code==200 else None
rec("activate partner1 + normalize", ok, str(r.status_code))

# 7. Idempotency: same user re-activates
r = requests.post(f"{BASE}/wedding/activate", json={"token_code":"WDL-DEMO-2026-LOVE"}, headers=A)
ok = r.status_code == 200 and r.json().get("reused") == True and r.json()["wedding"]["wedding_id"] == wed_id
rec("idempotency same user", ok, str(r.status_code))

# 8. Partner 2 (user B)
r = requests.post(f"{BASE}/wedding/activate", json={"token_code":"WDL-DEMO-2026-LOVE"}, headers=B)
ok = r.status_code == 200 and r.json()["membership"]["partner_number"] == 2 and r.json()["wedding"]["wedding_id"] == wed_id
rec("partner2 activate", ok, str(r.status_code))

# 9. Third user rejected
r = requests.post(f"{BASE}/wedding/activate", json={"token_code":"WDL-DEMO-2026-LOVE"}, headers=C)
rec("third user 409", r.status_code == 409, str(r.status_code))

# 10. PATCH /wedding partial
r = requests.patch(f"{BASE}/wedding", json={"partner1_name":"Andi","setup_step":3}, headers=A)
rec("PATCH wedding partial", r.status_code==200 and r.json()["wedding"]["partner1_name"]=="Andi", str(r.status_code))

# 11. Setup complete -> seed
r = requests.patch(f"{BASE}/wedding", json={"setup_complete":True, "wedding_date":"2026-08-20", "budget_amount":250000000}, headers=A)
rec("setup complete", r.status_code == 200, str(r.status_code))
# Verify checklist seeded
r = requests.get(f"{BASE}/checklist", headers=A)
n1 = len(r.json().get("tasks",[]))
rec("checklist seeded", n1 >= 18, f"count={n1}")
# Idempotent seed
requests.patch(f"{BASE}/wedding", json={"setup_complete":True}, headers=A)
r = requests.get(f"{BASE}/checklist", headers=A)
n2 = len(r.json().get("tasks",[]))
rec("checklist seed idempotent", n1 == n2, f"n1={n1} n2={n2}")

# 12. Dashboard
r = requests.get(f"{BASE}/dashboard", headers=A)
d = r.json() if r.status_code==200 else {}
keys_ok = all(k in d for k in ["progress","days_to_go","this_week","budget","guests","vendors","upcoming"])
rec("dashboard fields", r.status_code==200 and keys_ok, str(r.status_code))

# 13. Checklist CRUD
r = requests.post(f"{BASE}/checklist", json={"title":"Test task"}, headers=A)
tid = r.json()["task"]["task_id"] if r.status_code==200 else None
rec("checklist create", r.status_code==200, str(r.status_code))
r = requests.patch(f"{BASE}/checklist/{tid}", json={"status":"completed"}, headers=A)
rec("checklist toggle", r.status_code==200 and r.json()["task"]["status"]=="completed", str(r.status_code))
r = requests.delete(f"{BASE}/checklist/{tid}", headers=A)
rec("checklist delete", r.status_code==200, str(r.status_code))

# 14. Budget CRUD
r = requests.post(f"{BASE}/budget", json={"category":"Venue","name":"Hall","planned":100,"actual":80,"paid":50}, headers=A)
bid = r.json()["item"]["item_id"] if r.status_code==200 else None
rec("budget create", r.status_code==200, str(r.status_code))
r = requests.post(f"{BASE}/budget", json={"category":"X","name":"Neg","planned":-1}, headers=A)
rec("budget negative rejected", r.status_code==400, str(r.status_code))
r = requests.patch(f"{BASE}/budget/{bid}", json={"actual":90}, headers=A)
rec("budget patch", r.status_code==200, str(r.status_code))
r = requests.get(f"{BASE}/budget", headers=A)
totals = r.json().get("totals",{})
rec("budget totals", totals.get("actual")==90.0 and totals.get("planned")==100.0, str(totals))
r = requests.delete(f"{BASE}/budget/{bid}", headers=A)
rec("budget delete", r.status_code==200, str(r.status_code))

# 15. Guests
r = requests.post(f"{BASE}/guests", json={"name":"Uncle","number_of_guests":2,"rsvp":"attending"}, headers=A)
gid = r.json()["guest"]["guest_id"] if r.status_code==200 else None
rec("guest create", r.status_code==200, str(r.status_code))
r = requests.patch(f"{BASE}/guests/{gid}", json={"rsvp":"declined"}, headers=A)
rec("guest patch rsvp", r.status_code==200, str(r.status_code))
r = requests.get(f"{BASE}/guests", headers=A)
counts = r.json().get("counts",{})
rec("guest counts", counts.get("total")==2 and counts.get("declined")==2, str(counts))
r = requests.delete(f"{BASE}/guests/{gid}", headers=A)
rec("guest delete", r.status_code==200, str(r.status_code))

# 16. Vendors
r = requests.post(f"{BASE}/vendors", json={"name":"Photog","category":"Photography"}, headers=A)
vid = r.json()["vendor"]["vendor_id"] if r.status_code==200 else None
rec("vendor create", r.status_code==200, str(r.status_code))
r = requests.patch(f"{BASE}/vendors/{vid}", json={"booking_status":"booked"}, headers=A)
rec("vendor patch", r.status_code==200, str(r.status_code))
r = requests.delete(f"{BASE}/vendors/{vid}", headers=A)
rec("vendor delete", r.status_code==200, str(r.status_code))

# 17. Timeline
r = requests.post(f"{BASE}/timeline", json={"title":"Rehearsal","date":"2026-08-19"}, headers=A)
eid = r.json()["event"]["event_id"] if r.status_code==200 else None
rec("event create", r.status_code==200, str(r.status_code))
r = requests.patch(f"{BASE}/timeline/{eid}", json={"location":"Hall"}, headers=A)
rec("event patch", r.status_code==200, str(r.status_code))
r = requests.delete(f"{BASE}/timeline/{eid}", headers=A)
rec("event delete", r.status_code==200, str(r.status_code))

# 18. Multi-tenancy: user C (no wedding) tries to access
r = requests.get(f"{BASE}/checklist", headers=C)
rec("no-wedding blocked", r.status_code==403, str(r.status_code))
# create task as A, try patch as C - but C has no wedding, would 403. Real cross-tenant test: create second wedding with user C
# Generate a new token, activate as C
r = requests.post(f"{BASE}/admin/tokens/generate", json={"count":1}, headers=XKEY)
new_tok = r.json()["tokens"][0]["token_code"]
r = requests.post(f"{BASE}/wedding/activate", json={"token_code":new_tok}, headers=C)
rec("C activate new wedding", r.status_code==200, str(r.status_code))
# Get an A task
r = requests.get(f"{BASE}/checklist", headers=A)
a_task_id = r.json()["tasks"][0]["task_id"]
# C tries to patch A's task
r = requests.patch(f"{BASE}/checklist/{a_task_id}", json={"status":"completed"}, headers=C)
rec("cross-tenant patch blocked", r.status_code==404, str(r.status_code))
r = requests.delete(f"{BASE}/checklist/{a_task_id}", headers=C)
rec("cross-tenant delete blocked", r.status_code==404, str(r.status_code))

# 19. Theme
r = requests.patch(f"{BASE}/wedding/theme", json={"theme_id":"midnight_gold"}, headers=A)
rec("theme update", r.status_code==200 and r.json()["wedding"]["theme_id"]=="midnight_gold", str(r.status_code))

# 20. AI chat
r = requests.post(f"{BASE}/ai/chat", json={"message":"Hello"}, headers=A, stream=True, timeout=60)
content = ""
try:
    for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
        content += chunk if isinstance(chunk,str) else chunk.decode('utf-8','ignore')
        if len(content) > 30:
            break
except Exception as e:
    content += f"[err {e}]"
rec("AI chat stream", r.status_code==200 and len(content)>5 and "[Weddly AI encountered" not in content, f"status={r.status_code} len={len(content)} sample={content[:80]!r}")

# Summary
total = len(results)
passed = sum(1 for _,ok,_ in results if ok)
print(f"\nRESULT: {passed}/{total}")
failed = [(n,i) for n,ok,i in results if not ok]
for n,i in failed:
    print("FAILED:", n, i)
sys.exit(0 if passed==total else 1)
