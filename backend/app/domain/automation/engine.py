import logging
from dataclasses import dataclass
from typing import Awaitable, Callable

from app.domain import audit
from app.domain.appointments.state_machine import confirmed_status
from app.domain.notifications import service as notifications

logger = logging.getLogger("app.automation")

SYSTEM_ACTOR = {"id": None, "email": None, "name": "System automation", "role": "SYSTEM"}

Condition = Callable[[dict, dict], bool]
Action = Callable[[dict, dict, dict | None, bool], Awaitable[dict]]


@dataclass(frozen=True)
class Rule:
    trigger: str
    condition: Condition
    action: Action
    name: str


def always(appointment: dict, settings: dict) -> bool:
    return True


def auto_accept(appointment: dict, settings: dict) -> bool:
    return appointment.get("acceptance_mode") == "AUTO"


def manual_accept(appointment: dict, settings: dict) -> bool:
    return not auto_accept(appointment, settings)


def send(event: str) -> Action:
    async def _send(appointment: dict, settings: dict, actor: dict | None, notify: bool) -> dict:
        if notify:
            await notifications.notify(event, appointment, settings)
        return appointment

    return _send


async def auto_confirm(appointment: dict, settings: dict, actor: dict | None, notify: bool) -> dict:
    from app.domain.appointments import service as appointments

    target = confirmed_status(bool(appointment.get("doctor_id")))
    if appointment["status"] == target:
        return appointment
    updated = await appointments.transition(appointment, target, SYSTEM_ACTOR, "Auto-confirmed (booking policy)")
    await audit.log(SYSTEM_ACTOR, "appointment_auto_confirmed", "appointment", appointment["_id"], {"public_id": appointment["public_id"]})
    return await handle("appointment_confirmed", updated, settings, actor=SYSTEM_ACTOR, notify=notify)


RULES: list[Rule] = [
    Rule("appointment_created", auto_accept, auto_confirm, "Auto-confirm when acceptance mode allows"),
    Rule("appointment_created", manual_accept, send("appointment_created"), "Send request-received message"),
    Rule("appointment_confirmed", always, send("appointment_confirmed"), "Send confirmation message"),
    Rule("appointment_rescheduled", always, send("appointment_rescheduled"), "Send reschedule message"),
    Rule("appointment_rescheduled", auto_accept, auto_confirm, "Re-confirm automatically after reschedule"),
    Rule("appointment_cancelled", always, send("appointment_cancelled"), "Send cancellation message"),
    Rule("doctor_assignment_changed", always, send("doctor_assignment_changed"), "Dashboard notification"),
    Rule("appointment_completed", always, send("appointment_completed"), "Dashboard notification"),
]


async def handle(event: str, appointment: dict, settings: dict, actor: dict | None = None, notify: bool = True) -> dict:
    current = appointment
    for rule in RULES:
        if rule.trigger != event or not rule.condition(current, settings):
            continue
        try:
            current = await rule.action(current, settings, actor, notify)
        except Exception:
            logger.exception("Automation rule '%s' failed for %s", rule.name, appointment.get("public_id"))
    return current
