"""
AI Interview Agent -- single required endpoint per technical-spec.md, plus
a small set of UI-support endpoints (candidate list, live status) and a
static chat frontend served at "/".

    POST /api/interview

Run:
    uvicorn app.main:app --reload --port 8000

Env:
    LLM_PROVIDER=anthropic   (default) | mock  (offline/testing)
    ANTHROPIC_API_KEY=...    (required when LLM_PROVIDER=anthropic)
    INTERVIEW_MODEL=claude-sonnet-4-6   (default)
"""
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from . import state as store
from . import orchestrator
from .orchestrator import _plan_items
from .models import InterviewRequest, InterviewResponse, Feedback

app = FastAPI(title="AI Interview Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
CANDIDATES_PATH = Path(__file__).resolve().parent.parent / "data" / "candidates.json"
with open(CANDIDATES_PATH, "r", encoding="utf-8") as f:
    _CANDIDATES = json.load(f)["candidates"]


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/api/candidates")
def list_candidates():
    """UI-support endpoint (not part of the required contract): lets the
    frontend offer a candidate picker instead of requiring the raw
    candidate JSON to be pasted in by hand."""
    out = []
    for c in _CANDIDATES:
        m = c["member"]
        out.append({
            "id": m["id"],
            "name": m["name"],
            "jobRole": m.get("jobRole", ""),
            "yearsExperience": m.get("yearsExperience"),
            "education": m.get("education", ""),
            "raw": c,
        })
    return out


@app.get("/api/interview/{session_id}/status")
def interview_status(session_id: str):
    """UI-support endpoint (not part of the required contract): exposes
    live progress for the sidebar tracker."""
    st = store.get(session_id)
    if st is None:
        raise HTTPException(status_code=404, detail="Unknown sessionId")
    plan_items = _plan_items(st)
    current = st.current_turn()
    return {
        "questionsAsked": st.questions_asked,
        "minQuestions": st.min_questions,
        "daysCovered": sorted(st.days_covered()),
        "minDays": st.min_days,
        "planDays": [i.day for i in plan_items],
        "currentDay": current.day if current else None,
        "phase": st.phase,
    }


@app.post("/api/interview", response_model=InterviewResponse, response_model_exclude_none=True)
def interview(req: InterviewRequest) -> InterviewResponse:
    session_id = req.sessionId
    existing = store.get(session_id)

    # --- First turn: initialize a new session -----------------------
    if existing is None:
        if not req.candidate:
            raise HTTPException(
                status_code=400,
                detail="First request for a new sessionId must include 'candidate'.",
            )
        try:
            diff = req.difficulty or "senior"
            state, reply = orchestrator.start_session(session_id, req.candidate, difficulty=diff)
        except (KeyError, IndexError) as e:
            raise HTTPException(
                status_code=400, detail=f"Malformed candidate payload: {e}"
            )
        store.save(state)
        return InterviewResponse(reply=reply, done=False)

    # --- Subsequent turns: continue the conversation -----------------
    if existing.phase == "done":
        return InterviewResponse(
            reply="This interview has already concluded. Start a new session to interview again.",
            done=True,
        )

    if req.message is None:
        raise HTTPException(
            status_code=400,
            detail="Subsequent requests for an existing sessionId must include 'message'.",
        )

    state, reply, done, feedback_obj = orchestrator.continue_session(existing, req.message)
    store.save(state)

    feedback = None
    if done and feedback_obj is not None:
        feedback = feedback_obj if isinstance(feedback_obj, Feedback) else Feedback(**feedback_obj)

    return InterviewResponse(reply=reply, done=done, feedback=feedback)


@app.get("/health")
def health():
    return {"status": "ok"}
