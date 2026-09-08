from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

DATE = r"^\d{4}-\d{2}-\d{2}$"
HM = r"^([01]\d|2[0-3]):[0-5]\d$"


def _blank_to_none(v):
    return None if isinstance(v, str) and not v.strip() else v


class PatientInput(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=10, max_length=20)
    email: EmailStr | None = None

    _blank = field_validator("email", mode="before")(_blank_to_none)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v.replace(" ", "").replace(".", "").replace("'", "").replace("-", "").isalpha():
            raise ValueError("Please enter the patient's name using letters only.")
        return v


class BookingCreate(PatientInput):
    service_id: str = Field(min_length=1)
    date: str = Field(pattern=DATE)
    slot_start: str = Field(pattern=HM)
    message: str | None = Field(default=None, max_length=500)
    consent: bool = True
    website: str | None = None

    _blank_msg = field_validator("message", mode="before")(_blank_to_none)


class AdminBookingCreate(BookingCreate):
    doctor_id: str | None = None
    consent: bool = True


class RescheduleInput(BaseModel):
    date: str = Field(pattern=DATE)
    slot_start: str = Field(pattern=HM)
    reason: str | None = Field(default=None, max_length=300)
    keep_doctor: bool = True


class AssignInput(BaseModel):
    doctor_id: str | None = None
    force: bool = False


class ReasonInput(BaseModel):
    reason: str | None = Field(default=None, max_length=300)


class NoteInput(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class StatusAction(BaseModel):
    action: Literal["contacted", "confirm", "complete", "no_show"]
