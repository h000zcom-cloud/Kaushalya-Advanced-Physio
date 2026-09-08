from app.core.database import db, q
from app.core.models import new_id, utc_now


def _norm(name: str) -> str:
    return " ".join(name.lower().split())


async def find_or_create(name: str, phone: str, email: str | None) -> dict:
    existing = await db.patients.find(q(phone=phone)).sort("created_at", 1).to_list(20)
    target = _norm(name)
    for patient in existing:
        known = _norm(patient["name"])
        if known == target or known.split(" ")[0] == target.split(" ")[0]:
            if email and not patient.get("email"):
                await db.patients.update_one({"_id": patient["_id"]}, {"$set": {"email": email, "updated_at": utc_now()}})
            return patient
    now = utc_now()
    patient = q(_id=new_id(), name=name, phone=phone, email=email, status="ACTIVE", total_appointments=0, last_appointment_at=None, duplicate_review=bool(existing), created_at=now, updated_at=now)
    await db.patients.insert_one(patient)
    return patient


async def touch(patient_id: str, starts_at) -> None:
    await db.patients.update_one({"_id": patient_id}, {"$inc": {"total_appointments": 1}, "$max": {"last_appointment_at": starts_at}, "$set": {"updated_at": utc_now()}})
