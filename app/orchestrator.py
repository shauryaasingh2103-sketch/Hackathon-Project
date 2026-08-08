"""
The interview agent's core loop.

This is deliberately implemented as an explicit state machine with LLM
calls plugged into specific steps, rather than a single freeform chat
loop. That's what keeps an 8-12 turn interview coherent, guarantees the
minimum-questions/minimum-days requirements are met, and keeps
evaluation rigorous and separate from the conversational persona.

States: intro -> in_progress -> concluding -> done
"""
from . import llm, curriculum
from .models import SessionState, Turn
from .planner import build_plan, InterviewPlan


def start_session(session_id: str, candidate: dict) -> tuple[SessionState, str]:
    plan: InterviewPlan = build_plan(candidate)

    state = SessionState(
        session_id=session_id,
        candidate_name=plan.candidate_name,
        job_role=plan.job_role,
        plan_days=[item.day for item in plan.items],
    )

    first_item = plan.items[0]
    ctx = first_item.curriculum_context()
    reply = llm.opening_message(state, ctx, first_item.title)

    turn = Turn(
        day=first_item.day,
        topic=first_item.title,
        probe_type=first_item.probe_type,
        question=reply,
        is_follow_up=False,
    )
    state.turns.append(turn)
    state.questions_asked = 1
    state.phase = "in_progress"
    state = _attach_plan_items(state, plan)
    return state, reply


def _attach_plan_items(state: SessionState, plan: InterviewPlan) -> SessionState:
    """Plan items (with objectives/tools/probe_type) aren't part of the
    lightweight SessionState schema returned over the API, so we stash
    them in a module-level side table keyed by session id instead of
    bloating the pydantic model with curriculum payloads."""
    _plan_items_by_session[state.session_id] = plan.items
    _backlog_by_session[state.session_id] = list(plan.backlog)
    return state


_plan_items_by_session: dict[str, list] = {}
_backlog_by_session: dict[str, list] = {}


def _plan_items(state: SessionState):
    return _plan_items_by_session.get(state.session_id, [])


def _pop_backlog_item(state: SessionState):
    """Pull the next unused, genuinely-different topic from the backlog
    (if any) to pad a strong candidate's interview up to the minimum
    question count with real content rather than repeated follow-ups."""
    backlog = _backlog_by_session.get(state.session_id, [])
    if not backlog:
        return None
    item = backlog.pop(0)
    _plan_items_by_session[state.session_id].append(item)
    return item


def continue_session(state: SessionState, message: str) -> tuple[SessionState, str, bool, object]:
    """
    Processes the candidate's latest message. Returns:
        (updated_state, reply_text, done, feedback_or_none)
    """
    plan_items = _plan_items(state)

    current = state.current_turn()
    current.answer = message

    ctx = curriculum.day_summary(current.day)
    current.eval = llm.evaluate_answer(current.question, message, ctx)

    action = _decide_next_action(state, current)

    if action == "follow_up":
        state.follow_ups_on_current += 1
        reply = llm.follow_up_question(state, current)
        next_turn = Turn(
            day=current.day,
            topic=current.topic,
            probe_type=current.probe_type,
            question=reply,
            is_follow_up=True,
        )
        state.turns.append(next_turn)
        state.questions_asked += 1
        return state, reply, False, None

    if action == "advance":
        state.plan_index += 1
        state.follow_ups_on_current = 0
        next_item = plan_items[state.plan_index]
        ctx = next_item.curriculum_context()
        reply = llm.transition_question(state, current, ctx, next_item.title)
        next_turn = Turn(
            day=next_item.day,
            topic=next_item.title,
            probe_type=next_item.probe_type,
            question=reply,
            is_follow_up=False,
        )
        state.turns.append(next_turn)
        state.questions_asked += 1
        return state, reply, False, None

    if action == "advance_backlog":
        # Plan was exhausted but we're still short of the minimum question
        # count -- pull a genuinely new topic from backlog instead of
        # over-milking follow-ups on the last topic.
        next_item = _pop_backlog_item(state)
        state.plan_index = len(plan_items)  # points at the freshly appended item
        state.follow_ups_on_current = 0
        ctx = next_item.curriculum_context()
        reply = llm.transition_question(state, current, ctx, next_item.title)
        next_turn = Turn(
            day=next_item.day,
            topic=next_item.title,
            probe_type=next_item.probe_type,
            question=reply,
            is_follow_up=False,
        )
        state.turns.append(next_turn)
        state.questions_asked += 1
        return state, reply, False, None

    # action == "conclude"
    state.phase = "done"
    closing = llm.closing_message(state)
    feedback = llm.generate_feedback(state)
    return state, closing, True, feedback


def _decide_next_action(state: SessionState, current_turn: Turn) -> str:
    """Rule-based decision: follow up, advance to next planned topic, or
    conclude. Kept deterministic (rather than an extra LLM call) so the
    8-question / 4-day minimums are guaranteed rather than merely likely."""
    plan_items = _plan_items(state)
    has_more_planned_topics = state.plan_index + 1 < len(plan_items)

    weak_answer = (
        current_turn.eval is not None
        and (current_turn.eval.score <= 2 or len(current_turn.eval.gaps) > 0)
    )
    can_still_follow_up = state.follow_ups_on_current < state.max_follow_ups

    # Probe once on a weak/shallow answer before moving on.
    if weak_answer and can_still_follow_up and current_turn.eval.score < 4:
        return "follow_up"

    if has_more_planned_topics:
        return "advance"

    # Plan exhausted. If we haven't hit the minimum question count yet,
    # prefer pulling in a genuinely new topic from backlog over repeatedly
    # follow-up-probing the same day.
    if state.questions_asked < state.min_questions:
        if _backlog_by_session.get(state.session_id):
            return "advance_backlog"
        if can_still_follow_up:
            return "follow_up"

    return "conclude"
