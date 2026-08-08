from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---------- API contract (per technical-spec.md) ----------

class InterviewRequest(BaseModel):
    sessionId: str
    candidate: Optional[dict] = None   # present only on the FIRST request
    message: Optional[str] = None      # present on every subsequent turn


class Feedback(BaseModel):
    summary: str
    strengths: list[str]
    gaps: list[str]
    next: list[str]


class InterviewResponse(BaseModel):
    reply: str
    done: bool
    feedback: Optional[Feedback] = None


# ---------- Internal session state ----------

class TurnEval(BaseModel):
    score: int = Field(ge=1, le=5)
    strengths: list[str] = []
    gaps: list[str] = []
    on_topic: bool = True


class Turn(BaseModel):
    day: int
    topic: str
    probe_type: str
    question: str
    answer: Optional[str] = None
    is_follow_up: bool = False
    eval: Optional[TurnEval] = None


class SessionState(BaseModel):
    session_id: str
    candidate_name: str
    job_role: str

    plan_days: list[int] = []          # ordered list of days in the plan
    plan_index: int = 0                # pointer into plan_days
    follow_ups_on_current: int = 0
    max_follow_ups: int = 2

    questions_asked: int = 0
    min_questions: int = 8
    min_days: int = 4

    turns: list[Turn] = []
    phase: Literal["intro", "in_progress", "concluding", "done"] = "intro"

    def days_covered(self) -> set[int]:
        return {t.day for t in self.turns}

    def current_turn(self) -> Optional[Turn]:
        """The most recent turn awaiting an answer/eval."""
        if not self.turns:
            return None
        return self.turns[-1]
