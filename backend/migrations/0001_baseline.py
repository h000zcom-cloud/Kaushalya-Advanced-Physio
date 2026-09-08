VERSION = 1


async def up(db):
    """Baseline: collections are created lazily; indexes are ensured by the runner."""
    await db.organizations.update_many({"created_at": {"$exists": False}}, {"$currentDate": {"created_at": True}})
