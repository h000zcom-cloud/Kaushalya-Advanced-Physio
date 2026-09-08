import re

from app.core.database import db, q


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower().replace("&", " and ")).strip("-")
    return slug or "item"


async def unique_slug(collection: str, base: str, exclude_id: str | None = None) -> str:
    slug, i = base, 2
    while True:
        filters = q(slug=slug)
        if exclude_id:
            filters["_id"] = {"$ne": exclude_id}
        if not await db[collection].find_one(filters):
            return slug
        slug = f"{base}-{i}"
        i += 1
