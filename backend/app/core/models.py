from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str = Field(default_factory=new_id, alias="_id")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    def to_mongo(self) -> dict:
        return self.model_dump(by_alias=True)

    @classmethod
    def from_mongo(cls, doc: dict | None):
        return cls.model_validate(doc) if doc else None


def to_public(doc: dict | None, drop: tuple = ()) -> dict | None:
    if doc is None:
        return None
    out = {k: v for k, v in doc.items() if k not in drop and k != "_id"}
    out["id"] = doc.get("_id")
    return out
