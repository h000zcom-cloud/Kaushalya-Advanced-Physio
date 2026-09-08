from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.core.database import db, q
from app.core.deps import actor_of, require
from app.core.errors import AppError
from app.core.models import new_id, to_public, utc_now
from app.core.ratelimit import client_ip
from app.core.timeutil import parse_date
from app.domain import audit
from app.domain.appointments.service import serialize as serialize_appt
from app.domain.scheduling import engine
from app.domain.scheduling.engine import ACTIVE_STATUSES
from app.domain.settings.service import get_settings

router = APIRouter(prefix="/admin/schedule", tags=["admin:schedule"])


class OverrideInput(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    slot_start: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    capacity: int = Field(ge=0, le=500)
    note: str = Field(default="", max_length=200)


def _appt_filters(doctor_id: str | None, service_id: str | None, status: str | None) -> dict:
    filters: dict = {}
    if doctor_id:
        filters["doctor_id"] = None if doctor_id == "unassigned" else doctor_id
    if service_id:
        filters["service_id"] = service_id
    if status:
        filters["status"] = {"$in": status.split(",")}
    return filters


@router.get("/availability")
async def availability(date: str, service_id: str | None = None, user=Depends(require("schedule:read"))):
    settings = await get_settings()
    slots = await engine.availability_for_day(settings, parse_date(date), service_id, patient_view=False)
    return {"date": date, "slots": [{k: s[k] for k in ("slot_start", "slot_end", "capacity", "booked", "remaining", "status")} for s in slots]}


@router.get("/day")
async def day_view(date: str, doctor_id: str | None = None, service_id: str | None = None, status: str | None = None, user=Depends(require("schedule:read"))):
    settings = await get_settings()
    day = parse_date(date)
    ctx = await engine.load_context([day])
    slots = engine.summarize_day(settings, ctx, day, None)
    appts = await db.appointments.find(q(date=date, **_appt_filters(doctor_id, service_id, status))).sort("slot_start", 1).to_list(5000)
    by_slot: dict[str, list] = {}
    for a in appts:
        by_slot.setdefault(a["slot_start"], []).append(serialize_appt(a))
    for s in slots:
        s["appointments"] = by_slot.get(s["slot_start"], [])
        s.pop("eligible_doctor_ids", None)
    return {"date": date, "is_open": bool(slots), "slots": slots, "capacity": sum(s["capacity"] for s in slots), "booked": sum(s["booked"] for s in slots), "doctors": [{"id": d["_id"], "name": d["name"]} for d in ctx["doctors"]]}


@router.get("/range")
async def range_view(date_from: str, date_to: str, doctor_id: str | None = None, service_id: str | None = None, status: str | None = None, user=Depends(require("schedule:read"))):
    settings = await get_settings()
    start, end = parse_date(date_from), parse_date(date_to)
    if end < start or (end - start).days > 45:
        raise AppError(400, "invalid_range", "Please choose a range of up to 45 days.")
    days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    ctx = await engine.load_context(days)
    summaries = []
    for day in days:
        slots = engine.summarize_day(settings, ctx, day, None)
        summaries.append({"date": day.isoformat(), "is_open": bool(slots), "capacity": sum(s["capacity"] for s in slots), "booked": sum(s["booked"] for s in slots)})
    appts = await db.appointments.find(q(date={"$gte": date_from, "$lte": date_to}, **_appt_filters(doctor_id, service_id, status))).sort([("date", 1), ("slot_start", 1)]).to_list(20000)
    return {"days": summaries, "appointments": [serialize_appt(a) for a in appts]}


@router.get("/overrides")
async def list_overrides(date_from: str | None = None, date_to: str | None = None, user=Depends(require("schedule:read"))):
    filters = q()
    if date_from or date_to:
        filters["date"] = {k: v for k, v in (("$gte", date_from), ("$lte", date_to)) if v}
    docs = await db.capacity_overrides.find(filters).sort([("date", 1), ("slot_start", 1)]).to_list(2000)
    return {"items": [to_public(d) for d in docs]}


@router.put("/overrides")
async def upsert_override(data: OverrideInput, request: Request, user=Depends(require("schedule:write"))):
    parse_date(data.date)
    doc = await db.capacity_overrides.find_one_and_update(q(date=data.date, slot_start=data.slot_start), {"$set": {"capacity": data.capacity, "note": data.note, "updated_at": utc_now(), "updated_by": user["_id"]}, "$setOnInsert": {"_id": new_id(), "created_at": utc_now()}}, upsert=True, return_document=True)
    await audit.log(actor_of(user), "capacity_override_set", "capacity_override", doc["_id"], {"date": data.date, "slot_start": data.slot_start, "capacity": data.capacity}, client_ip(request))
    return to_public(doc)


@router.delete("/overrides/{override_id}")
async def delete_override(override_id: str, request: Request, user=Depends(require("schedule:write"))):
    result = await db.capacity_overrides.delete_one(q(_id=override_id))
    if result.deleted_count == 0:
        raise AppError(404, "override_not_found", "Override not found.")
    await audit.log(actor_of(user), "capacity_override_removed", "capacity_override", override_id, {}, client_ip(request))
    return {"deleted": True}
