"""
Builds a personalized interview plan for a candidate.

The plan is a deterministic, code-driven selection (not an LLM call) that
decides WHICH days to interview on and WHY, based on the candidate's
mission history. The LLM is only used later to phrase the actual
questions/follow-ups grounded in this plan.

Selection heuristics:
- Prefer substantive BUILD/PROJECT days over pure SETUP days.
- Spread selections across different modules so the interview isn't
  clustered on one topic.
- A day that was PASSED on the first attempt -> probe for depth
  (design decisions, tradeoffs, "why", failure modes).
- A day that was PASSED but took several attempts -> probe fundamentals
  (candidate may have a shakier grasp even though they eventually passed).
- A day that was SKIPPED -> light-touch awareness question, used sparingly,
  to gauge self-awareness/gap rather than to catch them out.
- Guarantees at least MIN_DAYS distinct days and enough queued topics to
  comfortably reach MIN_QUESTIONS with room for follow-ups.
"""
from dataclasses import dataclass, field
from typing import Literal

from . import curriculum

MIN_DAYS = 4
MIN_QUESTIONS = 8
TARGET_PLAN_LENGTH = 5  # number of distinct days queued up front

ProbeType = Literal["depth", "fundamentals", "awareness"]

# Days that are pure environment/tooling setup and make weak interview
# material on their own -- deprioritized unless nothing else is available.
_LOW_VALUE_TYPES = {"SETUP"}


@dataclass
class PlanItem:
    day: int
    title: str
    module: str
    probe_type: ProbeType
    attempts: int | None
    status: str  # "passed" | "skipped"

    def curriculum_context(self) -> str:
        return curriculum.day_summary(self.day)


@dataclass
class InterviewPlan:
    candidate_name: str
    job_role: str
    items: list[PlanItem] = field(default_factory=list)
    # Additional viable topics not initially selected, kept in rank order so
    # the orchestrator can pull from them if it needs to pad a strong
    # candidate's interview up to the minimum question count with a genuine
    # new topic instead of over-milking follow-ups on one day.
    backlog: list[PlanItem] = field(default_factory=list)

    def days_covered(self) -> list[int]:
        return [i.day for i in self.items]


def _probe_type_for_mission(mission: dict) -> ProbeType | None:
    if mission.get("skipped"):
        return "awareness"
    if mission.get("passed"):
        attempts = mission.get("attempts", 1)
        return "fundamentals" if attempts >= 3 else "depth"
    return None


def build_plan(candidate: dict) -> InterviewPlan:
    member = candidate["member"]
    missions = candidate.get("missions", [])

    scored: list[PlanItem] = []
    for m in missions:
        probe = _probe_type_for_mission(m)
        if probe is None:
            continue
        day_num = m["day"]
        day_rec = curriculum.get_day(day_num)
        mod = curriculum.get_module_for_day(day_num)
        day_type = day_rec["type"] if day_rec else "BUILD"
        item = PlanItem(
            day=day_num,
            title=m.get("title") or (day_rec["title"] if day_rec else f"Day {day_num}"),
            module=mod["title"] if mod else "Unknown",
            probe_type=probe,
            attempts=m.get("attempts"),
            status="skipped" if m.get("skipped") else "passed",
        )
        # rank: depth/fundamentals questions on substantive BUILD days first,
        # awareness (skipped) questions last and capped.
        rank = 0
        if day_type in _LOW_VALUE_TYPES:
            rank += 10
        if probe == "awareness":
            rank += 5
        scored.append((rank, day_num, item))

    scored.sort(key=lambda t: (t[0], t[1]))

    # Spread across distinct modules where possible, cap awareness probes at 1.
    chosen: list[PlanItem] = []
    seen_modules: set[str] = set()
    awareness_used = 0

    def try_add(item: PlanItem, allow_module_repeat: bool) -> bool:
        nonlocal awareness_used
        if item.probe_type == "awareness":
            if awareness_used >= 1:
                return False
            awareness_used += 1
        if not allow_module_repeat and item.module in seen_modules:
            return False
        chosen.append(item)
        seen_modules.add(item.module)
        return True

    # Pass 1: fill distinct modules first (best diversity of topics).
    for _, _, item in scored:
        if len(chosen) >= TARGET_PLAN_LENGTH:
            break
        try_add(item, allow_module_repeat=False)

    # Pass 2: if we still need more items, allow module repeats.
    if len(chosen) < TARGET_PLAN_LENGTH:
        chosen_days = {c.day for c in chosen}
        for _, _, item in scored:
            if len(chosen) >= TARGET_PLAN_LENGTH:
                break
            if item.day in chosen_days:
                continue
            if try_add(item, allow_module_repeat=True):
                chosen_days.add(item.day)

    # Safety net: guarantee at least MIN_DAYS if candidate data is sparse.
    if len(chosen) < MIN_DAYS:
        chosen_days = {c.day for c in chosen}
        for _, _, item in scored:
            if len(chosen) >= MIN_DAYS:
                break
            if item.day not in chosen_days:
                chosen.append(item)
                chosen_days.add(item.day)

    chosen_days = {c.day for c in chosen}
    backlog = [item for _, _, item in scored if item.day not in chosen_days]

    return InterviewPlan(
        candidate_name=member["name"],
        job_role=member.get("jobRole", "Engineer"),
        items=chosen,
        backlog=backlog,
    )
