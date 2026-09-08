"""Versioned migration runner: python -m migrations.run

Each migration module in this package exposes `VERSION: int` and `async def up(db)`.
Applied versions are recorded in `schema_migrations`.
"""
import asyncio
import importlib
import pkgutil
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.core.database import db, ensure_indexes  # noqa: E402
from app.core.models import utc_now  # noqa: E402


async def main() -> None:
    await ensure_indexes()
    applied = {m["version"] async for m in db.schema_migrations.find({}, {"version": 1})}
    modules = sorted(m.name for m in pkgutil.iter_modules([str(Path(__file__).parent)]) if m.name[0].isdigit())
    for name in modules:
        module = importlib.import_module(f"migrations.{name}")
        if module.VERSION in applied:
            continue
        print(f"applying {name} ...")
        await module.up(db)
        await db.schema_migrations.insert_one({"version": module.VERSION, "name": name, "applied_at": utc_now()})
    print("migrations up to date")


if __name__ == "__main__":
    asyncio.run(main())
