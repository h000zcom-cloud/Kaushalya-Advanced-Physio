from datetime import timedelta

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from app.core.config import cfg
from app.core.database import db, q
from app.core.errors import AppError
from app.core.models import new_id, utc_now
from app.core.ratelimit import client_ip, limiter
from app.core.timeutil import now_local, parse_date
from app.domain.appointments import service as appointments
from app.domain.appointments.schemas import BookingCreate
from app.domain.callbacks.router import CallbackCreate, create_callback
from app.domain.scheduling import engine
from app.domain.settings.service import get_settings, public_settings
from app.domain.testimonials.router import public_testimonial

router = APIRouter(prefix="/public", tags=["public"])

DOCTOR_PUBLIC = ("_id", "slug", "name", "designation", "qualification", "specializations", "experience_years", "expertise", "bio", "philosophy", "photo_url", "service_ids", "is_demo", "display_order")
SERVICE_PUBLIC = ("_id", "slug", "name", "short_description", "category", "condition_keys", "hero_image_url", "overview", "symptoms", "who_benefits", "how_it_helps", "approach", "what_to_expect", "faqs", "duration_minutes", "is_demo", "display_order")

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
ALLOWED_EVENTS = {"appointment_started", "appointment_step", "appointment_completed", "whatsapp_clicked", "call_clicked", "directions_clicked", "service_viewed", "doctor_viewed", "callback_requested", "page_view"}
ALLOWED_PARAMS = {"service_slug", "doctor_slug", "step", "source", "path"}


def _availability_summary(doctor: dict, settings: dict) -> str:
    hours = doctor.get("working_hours") or []
    if not hours:
        days = [w["weekday"] for w in settings["working_hours"] if w.get("is_open")]
    else:
        days = sorted({h["weekday"] for h in hours})
    if not days:
        return "By appointment"
    return f"{WEEKDAYS[days[0]]}–{WEEKDAYS[days[-1]]}" if len(days) > 2 and days == list(range(days[0], days[-1] + 1)) else ", ".join(WEEKDAYS[d] for d in days)


def _doctor(doc: dict, settings: dict) -> dict:
    out = {("id" if k == "_id" else k): doc.get(k) for k in DOCTOR_PUBLIC}
    out["availability_summary"] = _availability_summary(doc, settings)
    return out


def _service(doc: dict) -> dict:
    return {("id" if k == "_id" else k): doc.get(k) for k in SERVICE_PUBLIC}


@router.get("/clinic")
async def clinic():
    settings = await get_settings()
    return public_settings(settings) | {"whatsapp_notifications_enabled": cfg.whatsapp_configured and settings["notifications"].get("whatsapp_enabled", False)}


@router.get("/services")
async def services():
    docs = await db.services.find(q(is_active=True)).sort([("display_order", 1), ("name", 1)]).to_list(500)
    return {"items": [_service(d) for d in docs]}


@router.get("/services/{slug}")
async def service_detail(slug: str):
    settings = await get_settings()
    doc = await db.services.find_one(q(slug=slug, is_active=True))
    if not doc:
        raise AppError(404, "service_not_found", "This service page does not exist.")
    doctors = await db.doctors.find(q(is_active=True, service_ids=doc["_id"])).sort([("display_order", 1), ("name", 1)]).to_list(200)
    testimonials = await db.testimonials.find(q(is_published=True, service_id=doc["_id"])).sort("date", -1).limit(6).to_list(6)
    return {"service": _service(doc), "doctors": [_doctor(d, settings) for d in doctors], "testimonials": [public_testimonial(t, {doc["_id"]: doc["name"]}) for t in testimonials]}


@router.get("/doctors")
async def doctors():
    settings = await get_settings()
    docs = await db.doctors.find(q(is_active=True)).sort([("display_order", 1), ("name", 1)]).to_list(2000)
    return {"items": [_doctor(d, settings) for d in docs]}


@router.get("/doctors/{slug}")
async def doctor_detail(slug: str):
    settings = await get_settings()
    doc = await db.doctors.find_one(q(slug=slug, is_active=True))
    if not doc:
        raise AppError(404, "doctor_not_found", "This doctor profile does not exist.")
    services_docs = await db.services.find(q(is_active=True, _id={"$in": doc.get("service_ids", [])})).to_list(200)
    return {"doctor": _doctor(doc, settings), "services": [_service(s) for s in services_docs]}


@router.get("/testimonials")
async def testimonials(featured: bool | None = None):
    filters = q(is_published=True)
    if featured:
        filters["is_featured"] = True
    docs = await db.testimonials.find(filters).sort([("is_featured", -1), ("date", -1)]).limit(30).to_list(30)
    services_docs = await db.services.find(q(), {"name": 1}).to_list(500)
    names = {s["_id"]: s["name"] for s in services_docs}
    return {"items": [public_testimonial(t, names) for t in docs]}


@router.get("/availability")
async def availability(date: str, service_id: str | None = None):
    settings = await get_settings()
    day = parse_date(date)
    return {"date": date, "slots": await engine.availability_for_day(settings, day, service_id)}


@router.get("/availability/calendar")
async def availability_calendar(service_id: str | None = None, date_from: str | None = None, date_to: str | None = None):
    settings = await get_settings()
    today = now_local(settings).date()
    start = parse_date(date_from) if date_from else today
    end = parse_date(date_to) if date_to else today + timedelta(days=settings["booking"]["max_horizon_days"])
    if end < start or (end - start).days > 62:
        raise AppError(400, "invalid_range", "Please choose a shorter date range.")
    return {"days": await engine.availability_calendar(settings, start, end, service_id)}


def _public_appointment(appt: dict, settings: dict) -> dict:
    notif_status = None
    return {
        "public_id": appt["public_id"], "status": appt["status"], "date": appt["date"], "slot_start": appt["slot_start"], "slot_end": appt["slot_end"],
        "service_name": appt["service_name"], "patient_name": appt["patient_name"], "doctor_name": appt.get("doctor_name") if appt["status"] == "ASSIGNED" else None,
        "is_confirmed": appt["status"] in ("CONFIRMED", "ASSIGNED"), "clinic_name": settings["clinic"]["name"],
        "whatsapp_notifications_enabled": cfg.whatsapp_configured and settings["notifications"].get("whatsapp_enabled", False),
    }


@router.post("/appointments", status_code=201)
@limiter.limit("8/minute")
async def book(data: BookingCreate, request: Request):
    settings = await get_settings()
    appt = await appointments.create_booking(data, source="web", ip=client_ip(request))
    return _public_appointment(appt, settings)


@router.post("/callbacks", status_code=201)
@limiter.limit("5/minute")
async def callback(data: CallbackCreate, request: Request):
    doc = await create_callback(data, client_ip(request))
    return {"id": doc["_id"], "status": doc["status"]}


class EventInput(BaseModel):
    name: str = Field(max_length=40)
    params: dict = Field(default_factory=dict)


@router.post("/events", status_code=202)
@limiter.limit("60/minute")
async def track_event(data: EventInput, request: Request):
    if data.name not in ALLOWED_EVENTS:
        return {"accepted": False}
    params = {k: str(v)[:120] for k, v in data.params.items() if k in ALLOWED_PARAMS}
    await db.analytics_events.insert_one(q(_id=new_id(), name=data.name, params=params, created_at=utc_now()))
    return {"accepted": True}
