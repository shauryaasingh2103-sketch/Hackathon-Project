"""
Loads the 31-day curriculum and exposes lookup helpers used by the planner
and the LLM prompt builders.
"""
import json
from pathlib import Path
from typing import Optional

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "curriculum.json"

with open(DATA_PATH, "r", encoding="utf-8") as f:
    _CURRICULUM = json.load(f)

MODULES = _CURRICULUM["modules"]
DAYS = {d["day"]: d for d in _CURRICULUM["days"]}
COHORT_NAME = _CURRICULUM.get("cohort", "AI Cohort")


def get_day(day_number: int) -> Optional[dict]:
    """Return the curriculum record for a given day, or None."""
    return DAYS.get(day_number)


def get_module_for_day(day_number: int) -> Optional[dict]:
    """Return which module a given day belongs to."""
    for m in MODULES:
        lo, hi = m["days"]
        if lo <= day_number <= hi:
            return m
    return None


def day_summary(day_number: int) -> str:
    """Compact human-readable summary of a day, used inside LLM prompts."""
    d = get_day(day_number)
    if not d:
        return f"Day {day_number}: (no curriculum record found)"
    mod = get_module_for_day(day_number)
    mod_title = mod["title"] if mod else "Unknown module"
    objectives = "; ".join(d["objectives"])
    tools = ", ".join(d["tools"])
    return (
        f"Day {d['day']} — \"{d['title']}\" (Module: {mod_title}, Type: {d['type']})\n"
        f"Tools: {tools}\n"
        f"Learning objectives: {objectives}"
    )
