from app.core.errors import AppError

STATUSES = ("NEW", "CONTACTED", "CONFIRMED", "ASSIGNED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED")

TRANSITIONS = {
    "NEW": {"CONTACTED", "CONFIRMED", "ASSIGNED", "CANCELLED", "RESCHEDULED"},
    "CONTACTED": {"CONFIRMED", "ASSIGNED", "CANCELLED", "RESCHEDULED"},
    "CONFIRMED": {"ASSIGNED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"},
    "ASSIGNED": {"CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"},
    "RESCHEDULED": {"CONTACTED", "CONFIRMED", "ASSIGNED", "CANCELLED", "COMPLETED", "NO_SHOW", "RESCHEDULED"},
    "COMPLETED": set(),
    "CANCELLED": set(),
    "NO_SHOW": set(),
}

TERMINAL = {"COMPLETED", "CANCELLED", "NO_SHOW"}
CONFIRMED_LIKE = {"CONFIRMED", "ASSIGNED"}


def can_transition(current: str, target: str) -> bool:
    return target in TRANSITIONS.get(current, set())


def ensure_transition(current: str, target: str) -> None:
    if not can_transition(current, target):
        raise AppError(409, "invalid_transition", f"An appointment marked {current.replace('_', ' ').title()} cannot be changed to {target.replace('_', ' ').title()}.")


def confirmed_status(has_doctor: bool) -> str:
    return "ASSIGNED" if has_doctor else "CONFIRMED"
