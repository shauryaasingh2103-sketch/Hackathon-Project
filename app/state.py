"""
In-memory session store, keyed by sessionId.

Long-term persistence is explicitly out of scope per the spec, so a simple
process-local dict (guarded by a lock for basic thread-safety under a
threaded/async server) is sufficient.
"""
import threading
from typing import Optional

from .models import SessionState

_lock = threading.Lock()
_sessions: dict[str, SessionState] = {}


def get(session_id: str) -> Optional[SessionState]:
    with _lock:
        return _sessions.get(session_id)


def save(state: SessionState) -> None:
    with _lock:
        _sessions[state.session_id] = state


def exists(session_id: str) -> bool:
    with _lock:
        return session_id in _sessions
