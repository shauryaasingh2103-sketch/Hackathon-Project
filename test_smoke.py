"""
Offline smoke test: runs a full mock interview for EVERY candidate in
candidates.json through the real FastAPI endpoint and asserts the
minimum requirements from technical-spec.md / the challenge brief:

  - >= 8 questions asked
  - >= 4 distinct curriculum days covered
  - final response has done=True and a well-formed feedback object
  - reply/done contract matches the spec shape

Run with:  LLM_PROVIDER=mock python3 test_smoke.py
"""
import json
import os

os.environ.setdefault("LLM_PROVIDER", "mock")

from fastapi.testclient import TestClient
from app.main import app
from app import state as store

client = TestClient(app)
candidates = json.load(open("data/candidates.json"))["candidates"]

failures = []

for cand in candidates:
    cid = cand["member"]["id"]
    session_id = f"smoke-{cid}"

    r = client.post("/api/interview", json={"sessionId": session_id, "candidate": cand})
    assert r.status_code == 200, f"{cid}: start failed {r.status_code} {r.text}"
    data = r.json()
    assert "reply" in data and "done" in data, f"{cid}: bad start shape {data}"
    assert data["done"] is False

    turns = 1
    while not data["done"] and turns < 25:
        r = client.post(
            "/api/interview",
            json={"sessionId": session_id, "message": "A reasonably detailed technical answer with specifics."},
        )
        assert r.status_code == 200, f"{cid}: turn failed {r.status_code} {r.text}"
        data = r.json()
        turns += 1

    st = store.get(session_id)
    days = st.days_covered()

    ok = True
    if st.questions_asked < 8:
        failures.append(f"{cid}: only {st.questions_asked} questions asked")
        ok = False
    if len(days) < 4:
        failures.append(f"{cid}: only {len(days)} distinct days covered ({sorted(days)})")
        ok = False
    if not data["done"]:
        failures.append(f"{cid}: interview never concluded (hit {turns} turn cap)")
        ok = False
    if data.get("feedback") is None:
        failures.append(f"{cid}: no feedback object on conclusion")
        ok = False
    else:
        fb = data["feedback"]
        for field in ("summary", "strengths", "gaps", "next"):
            if field not in fb:
                failures.append(f"{cid}: feedback missing '{field}'")
                ok = False

    status = "OK" if ok else "FAIL"
    print(f"[{status}] {cand['member']['name']:22s} Q={st.questions_asked:2d} days={sorted(days)}")

print()
if failures:
    print(f"{len(failures)} FAILURE(S):")
    for f in failures:
        print(" -", f)
    raise SystemExit(1)
else:
    print(f"All {len(candidates)} candidates passed minimum requirements.")
