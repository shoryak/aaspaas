import asyncio
from datetime import datetime, timezone

from lib.db import client, db, ensure_indexes


async def main() -> None:
    now = datetime.now(timezone.utc)
    sessions = [
        {"id": "demo-session-1", "created_at": now, "last_seen_at": now, "pageviews": 18, "is_demo": True},
        {"id": "demo-session-2", "created_at": now, "last_seen_at": now, "pageviews": 11, "is_demo": True},
    ]
    for session in sessions:
        await db.sessions.update_one({"id": session["id"]}, {"$set": session}, upsert=True)
    ideas = [
        {"id": "demo-idea-1", "observation": "Every small shop near me now accepts instant delivery", "tickers": ["DELHIVERY", "ZOMATO", "EASEMYTRIP"], "session_id": "demo-session-1", "submitted_at": now, "is_demo": True},
        {"id": "demo-idea-2", "observation": "The same solar panels keep appearing on factory rooftops", "tickers": ["WAAREEENER", "KPI GREEN", "BOROSILRENEW"], "session_id": "demo-session-2", "submitted_at": now, "is_demo": True},
    ]
    for idea in ideas:
        await db.ideas.update_one({"id": idea["id"]}, {"$set": idea}, upsert=True)
    checks = [
        {"id": "demo-check-1", "idea_id": "demo-idea-1", "session_id": "demo-session-1", "ticker": "DELHIVERY", "answer": "yes", "matched": True, "answered_at": now, "is_demo": True},
        {"id": "demo-check-2", "idea_id": "demo-idea-1", "session_id": "demo-session-2", "ticker": "ZOMATO", "answer": "no", "matched": False, "answered_at": now, "is_demo": True},
        {"id": "demo-check-3", "idea_id": "demo-idea-2", "session_id": "demo-session-1", "ticker": "WAAREEENER", "answer": "yes", "matched": True, "answered_at": now, "is_demo": True},
    ]
    for check in checks:
        await db.gut_checks.update_one({"id": check["id"]}, {"$set": check}, upsert=True)
    shares = [
        {"id": "demo-share-1", "idea_id": "demo-idea-1", "session_id": "demo-session-1", "clicked_at": now, "is_demo": True},
        {"id": "demo-share-2", "idea_id": "demo-idea-2", "session_id": "demo-session-2", "clicked_at": now, "is_demo": True},
    ]
    for share in shares:
        await db.share_events.update_one({"id": share["id"]}, {"$set": share}, upsert=True)
    await ensure_indexes()
    client.close()


if __name__ == "__main__":
    asyncio.run(main())