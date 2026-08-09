# AI Interview Agent

A conversational technical interview agent for AI Cohort graduates. It builds a
personalized interview plan from each candidate's actual mission history, asks
grounded questions from the 31-day curriculum, probes shallow answers with
follow-ups, and produces a structured feedback report — all behind the single
endpoint defined in `technical-spec.md`.

🎥 [Watch the demo video](https://www.linkedin.com/posts/shaurya-singh-03a816325_abtalks-vibecodathon-48hourhackathon-ugcPost-7492164562654220288-cBMs/?utm_source=share&utm_medium=member_desktop&rcm=ACoAAFIrKa4BA-qnLqtWdksE2i6BVNVhylna9i0)
🔗 [Live demo](https://ai-cohort-voice-enabled-interview-agent.onrender.com/)

## Why it's built this way

Rather than one big "be an interviewer" system prompt looping over chat
history, this is an **explicit state machine with two separated LLM roles**
plugged into specific steps:

```
POST /api/interview
        │
        ▼
┌───────────────────┐      candidate.missions × curriculum.json
│  planner.py        │◄──── (code, not LLM) → picks WHICH days to
│  (interview plan)  │      interview on and WHY (depth / fundamentals /
└─────────┬──────────┘      awareness probe) — see below
          │
          ▼
┌───────────────────────────────────────────────────────────┐
│  orchestrator.py — the ask → evaluate → decide → act loop   │
│                                                               │
│   ask (INTERVIEWER role) ──► candidate answers               │
│         │                                                    │
│         ▼                                                    │
│   evaluate (EVALUATOR role, rubric, structured JSON)         │
│         │                                                    │
│         ▼                                                    │
│   decide (deterministic code, not an LLM call):               │
│     - weak/shallow answer & follow-up budget left → follow_up │
│     - more planned topics remain                → advance     │
│     - plan exhausted, still short of min Qs      → pull a new │
│                                                     topic from │
│                                                     backlog    │
│     - otherwise                                  → conclude   │
└───────────────────────────────────────────────────────────┘
          │
          ▼
   FEEDBACK synthesis (LLM, grounded strictly in the transcript)
```

**Two LLM roles, never mixed:**
- **Interviewer** (`llm.py::opening_message/transition_question/follow_up_question/closing_message`) —
  persona, tone, one question per turn, references the candidate's real work.
- **Evaluator** (`llm.py::evaluate_answer`) — no persona, rubric-scored (1-5),
  returns structured JSON (`score`, `strengths`, `gaps`, `on_topic`).

Keeping "decide what to do next" as **deterministic code** rather than a third
LLM call is what guarantees — not just makes likely — the challenge's hard
requirements (≥8 questions, ≥4 distinct days), regardless of how well or
poorly the candidate answers. This is verified for all 20 provided candidates
in `test_smoke.py` under both a maximally weak and a maximally strong
simulated candidate.

## Personalization logic (`planner.py`)

For each of the candidate's missions, cross-referenced against
`curriculum.json`:

| Signal | Probe type | Question style |
|---|---|---|
| Passed, first attempt | `depth` | "why did you choose X", tradeoffs, failure modes |
| Passed, 3+ attempts | `fundamentals` | checks whether the underlying concept actually stuck |
| Skipped | `awareness` (capped at 1 per interview) | light-touch, gauges self-awareness, not a "gotcha" |

Selection spreads across distinct curriculum **modules** first (so the
interview isn't 5 questions about one week), deprioritizes pure `SETUP` days
in favor of `BUILD`/project days, and keeps a ranked **backlog** of
not-yet-used, valid topics so a candidate who aces every question still gets
padded up to the minimum with a *genuinely new topic* rather than repeated
follow-ups milking one day.

## API contract

The one endpoint required by `technical-spec.md`:

```
POST /api/interview

# turn 1 (new session)
{"sessionId": "abc-123", "candidate": { ...candidate.json shape... }}
→ {"reply": "...", "done": false}

# turn 2+ (existing session)
{"sessionId": "abc-123", "message": "..."}
→ {"reply": "...", "done": false}

# final turn
→ {
    "reply": "...",
    "done": true,
    "feedback": {
      "summary": "...",
      "strengths": ["...", ...],
      "gaps": ["...", ...],
      "next": ["...", ...]
    }
  }
```

Two additional endpoints exist purely to power the chat UI and are **not**
part of the required contract — a grader can ignore them and talk to
`POST /api/interview` directly:

- `GET /api/candidates` — returns the 20 candidates so the page can offer a
  dropdown instead of requiring raw JSON to be pasted in.
- `GET /api/interview/{sessionId}/status` — live question count / days
  covered, used for the sidebar progress tracker.

Session state is in-memory, keyed by `sessionId` (persistence is explicitly
out of scope per the brief).

## Try it right now (no coding needed)

1. Install dependencies once: `pip install -r requirements.txt`
2. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey) and set it:
   `export GEMINI_API_KEY=...`
3. Start the server: `uvicorn app.main:app --port 8000`
4. Open **http://localhost:8000** in your browser — that's the whole UI.
   Pick a candidate from the dropdown, hit "Start interview", and chat.

No curl, no Postman, no pasting JSON — the web page does all of that for you.

## Deploy it to a real, public URL (free, ~10 minutes, no DevOps experience needed)

The easiest path is **Render.com**, because this repo already includes a
`Dockerfile` and `render.yaml` it reads automatically.

1. Push this folder to a new GitHub repo (create one on github.com, then
   drag-and-drop the files in via the web UI, or use `git push` if you're
   comfortable with git).
2. Go to **render.com** → sign up (free) → **New +** → **Blueprint** →
   connect your GitHub repo.
3. Render reads `render.yaml` automatically and shows one service:
   `ai-interview-agent`. Click **Apply**.
4. It will ask for `GEMINI_API_KEY` — paste your key from
   [Google AI Studio](https://aistudio.google.com/apikey). Everything else is pre-filled.
5. Click **Deploy**. Wait ~2-3 minutes for the build.
6. Render gives you a public URL like `https://ai-interview-agent.onrender.com`
   — open it, and the exact same chat page is now live for anyone with the link.

That's it — no server management, no separate frontend hosting. One
deploy, one URL, chat page and API both included.

**Alternatives**, if you'd rather use something else — the same
`Dockerfile` works as-is on **Railway** (railway.app → New Project →
Deploy from GitHub, it auto-detects the Dockerfile) or **Fly.io**
(`fly launch` from inside this folder). All three are free-tier friendly.


## Testing

```bash
LLM_PROVIDER=mock python3 test_smoke.py
```

Runs a full simulated interview for **all 20 candidates** in `candidates.json`
through the real endpoint and asserts:
- ≥ 8 questions asked
- ≥ 4 distinct curriculum days covered
- interview reaches `done: true`
- feedback object has all four required fields

All 20 pass in both a maximally-weak-answers run and a maximally-strong-
answers run (see commit history / test output).

## Project layout

```
app/
  main.py         FastAPI app: POST /api/interview + UI-support endpoints + serves the chat page
  static/
    index.html    self-contained chat frontend (HTML/CSS/JS, no build step)
  orchestrator.py the ask → evaluate → decide → act state machine
  planner.py      builds the personalized interview plan from candidate + curriculum
  llm.py          interviewer / evaluator / feedback prompts, Gemini + mock backends
  curriculum.py   loads curriculum.json, lookup helpers
  models.py       pydantic models: API contract + internal session state
  state.py        in-memory session store
data/
  curriculum.json   (as provided)
  candidates.json   (as provided)
test_smoke.py     offline end-to-end test across all provided candidates
Dockerfile        one-command containerized deploy
render.yaml       Render.com blueprint (auto-detected on deploy)
```

## Config

| Env var | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | `gemini` for real calls, `mock` for offline dev/test |
| `GEMINI_API_KEY` | — | required when `LLM_PROVIDER=gemini` |
| `INTERVIEW_MODEL` | `gemini-3.5-flash-lite` | model used for all three roles |

## Known limitations / next steps

- Session store is process-local in-memory — fine per the brief's "no
  persistent accounts" scope, but means restarting the server drops
  in-flight interviews. Swapping `state.py` for Redis is a small, isolated change.
- The evaluator scores each answer independently; it doesn't yet detect
  cross-topic inconsistency (e.g. confidently contradicting an earlier answer).
- `max_follow_ups=2` and `TARGET_PLAN_LENGTH=5` in `planner.py`/`models.py`
  are tunable constants, not hardcoded assumptions about interview length.
