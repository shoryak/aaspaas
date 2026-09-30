"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "ideas": [
        IndexModel([("id", ASCENDING)], name="idea_id", unique=True),
        IndexModel([("submitted_at", DESCENDING)], name="ideas_submitted_desc"),
        IndexModel([("session_id", ASCENDING)], name="ideas_session"),
    ],
    "sessions": [IndexModel([("id", ASCENDING)], name="session_id", unique=True)],
    "gut_checks": [IndexModel([("idea_id", ASCENDING), ("ticker", ASCENDING)], name="gut_check_lookup")],
    "share_events": [IndexModel([("idea_id", ASCENDING)], name="share_idea")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
