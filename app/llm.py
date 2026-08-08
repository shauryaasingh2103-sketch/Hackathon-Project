"""
AI Interview Agent - LLM layer.

Supported providers:

    gemini  -> real Gemini API
    mock    -> offline testing without an API key

The rest of the application does not need to know which LLM provider
is being used. All LLM calls go through this file.
"""

import json
import os
import re
from typing import Optional

from dotenv import load_dotenv

from .models import TurnEval, Feedback, SessionState, Turn
from . import curriculum

# Load variables from .env
load_dotenv()


# ============================================================
# CONFIGURATION
# ============================================================

PROVIDER = os.environ.get("LLM_PROVIDER", "gemini").lower()

MODEL_NAME = os.environ.get(
    "INTERVIEW_MODEL",
    "gemini-2.5-flash",
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")


# ============================================================
# HELPERS
# ============================================================

def _extract_json(text: str) -> dict:
    """
    Extract the first JSON object from an LLM response.

    This protects us if the model accidentally wraps JSON in
    markdown code fences.
    """

    text = text.strip()

    # Remove ```json ... ```
    text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"```$", "", text).strip()

    match = re.search(r"\{.*\}", text, re.DOTALL)

    if not match:
        raise ValueError(
            f"No JSON object found in model output: {text[:300]}"
        )

    return json.loads(match.group(0))


# ============================================================
# GEMINI BACKEND
# ============================================================

class GeminiBackend:
    """
    Real Gemini API backend.

    Uses Google's official google-genai Python SDK.
    """

    def __init__(self):
        if not GEMINI_API_KEY:
            raise RuntimeError(
                "GEMINI_API_KEY is missing. "
                "Create a .env file and add GEMINI_API_KEY=your_key_here"
            )

        from google import genai

        self.client = genai.Client(
            api_key=GEMINI_API_KEY
        )

    def complete(
        self,
        system: str,
        user: str,
        max_tokens: int = 600,
    ) -> str:

        from google.genai import types

        response = self.client.models.generate_content(
            model=MODEL_NAME,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
                temperature=0.7,
            ),
        )

        if not response.text:
            raise RuntimeError(
                "Gemini returned an empty response."
            )

        return response.text.strip()


# ============================================================
# MOCK BACKEND
# ============================================================

class MockBackend:
    """
    Offline backend.

    This does NOT use an AI model.

    It exists so we can test the interview state machine without
    an API key or internet connection.
    """

    def complete(
        self,
        system: str,
        user: str,
        max_tokens: int = 600,
    ) -> str:

        # Evaluator
        if "You are scoring" in system:

            return json.dumps({
                "score": 3,
                "strengths": [
                    "Mentioned a relevant concept"
                ],
                "gaps": [
                    "Answer could be more specific about implementation details"
                ],
                "on_topic": True,
            })

        # Final feedback
        if "final interview report" in system:

            return json.dumps({
                "summary": (
                    "Mock summary of candidate performance "
                    "across the interview."
                ),
                "strengths": [
                    "Clear communicator",
                    "Solid grasp of core concepts",
                ],
                "gaps": [
                    "Could go deeper on tradeoffs",
                    "Limited detail on production concerns",
                ],
                "next": [
                    "Review vector index tradeoffs",
                    "Practice explaining deployment decisions",
                ],
            })

        # Interviewer
        return (
            "Can you walk me through how you approached "
            "this part of the project?"
        )


# ============================================================
# BACKEND SELECTION
# ============================================================

_backend = None


def _get_backend():
    if PROVIDER == "mock":
        return MockBackend()

    if PROVIDER == "gemini":
        return GeminiBackend()

    raise RuntimeError(
        f"Unsupported LLM_PROVIDER='{PROVIDER}'. "
        f"Use 'gemini' or 'mock'."
    )


def backend():
    """
    Lazily create the selected backend.

    This means the Gemini client is not created until the first
    actual LLM call is made.
    """

    global _backend

    if _backend is None:
        _backend = _get_backend()

    return _backend


# ============================================================
# INTERVIEWER ROLE
# ============================================================

INTERVIEWER_SYSTEM = """
You are a senior technical interviewer conducting a live,
spoken-style technical interview for an AI engineering cohort
graduate.

Your job is to sound like a real, experienced engineer:
curious, warm but rigorous, never robotic or quiz-show-like.

Rules:

- Ask exactly ONE question per turn.
- Never stack multiple questions.
- Reference the candidate's actual project or mission work
  when relevant.
- Keep your response SHORT: at most 2-3 sentences before
  the question itself.
- Do not repeat information the candidate already told you.
- Do not explain concepts to the candidate.
- You are the interviewer, not the teacher.
- Never break character.
- Never mention that you are an AI model.
- Never mention that you are following a script.
"""


def opening_message(
    state: SessionState,
    first_item_context: str,
    first_item_title: str,
) -> str:

    user = f"""
Candidate: {state.candidate_name}
Current role: {state.job_role}

This is the very start of the interview.

Greet the candidate briefly by first name.

Set expectations in one sentence:
this is a conversational technical interview covering their
AI cohort project work.

Then ask the first technical question.

The question must be grounded in this curriculum day:

{first_item_context}

The question should require the candidate to explain a
real decision or mechanism from:

"{first_item_title}"

Do not ask a yes/no question.

Do not ask a textbook-definition question.
"""

    return backend().complete(
        INTERVIEWER_SYSTEM,
        user,
        max_tokens=300,
    )


def transition_question(
    state: SessionState,
    prev_turn: Optional[Turn],
    next_item_context: str,
    next_item_title: str,
) -> str:

    prev_bit = ""

    if prev_turn:
        prev_bit = (
            f'Their last answer on "{prev_turn.topic}" was: '
            f'"{prev_turn.answer}"\n\n'
        )

    user = f"""
{prev_bit}

Now move the interview forward to a new topic.

In one short sentence, transition naturally.
You can briefly acknowledge their last answer without
over-praising it.

Then ask a new question grounded in this curriculum day:

{next_item_context}

The question should require explaining a real decision,
mechanism, or tradeoff from:

"{next_item_title}"

Do not ask a yes/no question.

Do not ask a textbook-definition question.
"""

    return backend().complete(
        INTERVIEWER_SYSTEM,
        user,
        max_tokens=300,
    )


def follow_up_question(
    state: SessionState,
    turn: Turn,
) -> str:

    gaps = (
        "; ".join(turn.eval.gaps)
        if turn.eval
        else "the answer was vague or shallow"
    )

    user = f"""
You asked:

"{turn.question}"

The candidate answered:

"{turn.answer}"

The answer had this gap worth probing:

{gaps}

Ask ONE sharp, natural follow-up question that pushes the
candidate to be more specific or justify a decision.

Ask it like a real technical interviewer.

Do not explicitly tell the candidate what their gap was.

Do not ask multiple questions.
"""

    return backend().complete(
        INTERVIEWER_SYSTEM,
        user,
        max_tokens=250,
    )


def closing_message(
    state: SessionState,
) -> str:

    user = """
The interview is now complete.

Write a brief, warm 1-2 sentence closing remark thanking
the candidate and letting them know their feedback report
is ready below.

Do not summarize their performance here.
The structured report handles that.
"""

    return backend().complete(
        INTERVIEWER_SYSTEM,
        user,
        max_tokens=150,
    )


# ============================================================
# EVALUATOR ROLE
# ============================================================

EVALUATOR_SYSTEM = """
You are scoring a candidate's interview answer against a
technical interview rubric.

You are NOT the interviewer.

Do not produce conversational text.
Do not produce pleasantries.

Score the answer from 1-5:

1 = incorrect or no real content

2 = surface-level, mostly buzzwords, no real mechanism explained

3 = correct but shallow; gets the "what" but not the "why" or "how"

4 = solid, specific, correct, references real implementation detail

5 = excellent: correct, specific, discusses tradeoffs,
edge cases, or alternatives unprompted

Return ONLY a JSON object.

Do not use markdown fences.

Use exactly this shape:

{
  "score": 1,
  "strengths": ["short string"],
  "gaps": ["short string"],
  "on_topic": true
}

The strengths and gaps must be concise and grounded in what
the candidate actually said.

Never give generic advice such as:
"communicate more clearly".

Instead give specific technical observations.
"""


def evaluate_answer(
    question: str,
    answer: str,
    curriculum_context: str,
) -> TurnEval:

    user = f"""
Curriculum context for this question:

{curriculum_context}

Question asked:

{question}

Candidate's answer:

{answer}

Score this answer now.
"""

    raw = backend().complete(
        EVALUATOR_SYSTEM,
        user,
        max_tokens=400,
    )

    try:
        data = _extract_json(raw)
        return TurnEval(**data)

    except Exception:
        # Fail safe: never crash the interview because of
        # malformed evaluator JSON.

        return TurnEval(
            score=3,
            strengths=[],
            gaps=[
                "Could not automatically score this answer"
            ],
            on_topic=True,
        )


# ============================================================
# FINAL FEEDBACK
# ============================================================

FEEDBACK_SYSTEM = """
You are writing the final interview report for this
technical interview.

Build a concise, honest and actionable report.

Ground everything strictly in the transcript and scores.

Never invent claims that are not supported by the transcript.

Return ONLY a JSON object.

Do not use markdown fences.

Use exactly this shape:

{
  "summary": "2-4 sentence overall assessment",
  "strengths": ["specific strength"],
  "gaps": ["specific gap"],
  "next": ["concrete recommendation"]
}

Each array should contain 2-5 items.

Be specific.

Reference actual technical topics discussed.

Avoid generic advice such as:
"keep learning"
or
"communicate more clearly".
"""


def generate_feedback(
    state: SessionState,
) -> Feedback:

    transcript_lines = []

    for t in state.turns:

        transcript_lines.append(
            f"[Day {t.day} - {t.topic}"
            f"{' (follow-up)' if t.is_follow_up else ''}]"
        )

        transcript_lines.append(
            f"Q: {t.question}"
        )

        transcript_lines.append(
            f"A: {t.answer}"
        )

        if t.eval:

            transcript_lines.append(
                f"Score: {t.eval.score}/5 | "
                f"Strengths: {t.eval.strengths} | "
                f"Gaps: {t.eval.gaps}"
            )

        transcript_lines.append("")

    transcript = "\n".join(transcript_lines)

    days = sorted(state.days_covered())

    user = f"""
Candidate: {state.candidate_name}
Role: {state.job_role}

Days covered:

{days}

Total questions asked:

{state.questions_asked}

Full transcript with per-answer scores:

{transcript}

Write the final interview report now.
"""

    raw = backend().complete(
        FEEDBACK_SYSTEM,
        user,
        max_tokens=800,
    )

    try:

        data = _extract_json(raw)

        return Feedback(**data)

    except Exception:

        evaluated_turns = [
            t for t in state.turns
            if t.eval is not None
        ]

        avg = (
            sum(t.eval.score for t in evaluated_turns)
            / max(1, len(evaluated_turns))
        )

        return Feedback(
            summary=(
                f"Candidate completed "
                f"{state.questions_asked} questions across "
                f"{len(days)} days with an average score "
                f"of {avg:.1f}/5."
            ),
            strengths=[
                "See transcript for details."
            ],
            gaps=[
                "Automatic feedback synthesis failed; "
                "manual review recommended."
            ],
            next=[
                "Re-run feedback generation."
            ],
        )