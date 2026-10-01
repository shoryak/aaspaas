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
    "sessions": [
        IndexModel([("id", ASCENDING)], name="session_id", unique=True),
        IndexModel([("created_at", DESCENDING)], name="sessions_created"),
        IndexModel([("last_seen_at", DESCENDING)], name="sessions_last_seen"),
        IndexModel([("share_token", ASCENDING)], name="sessions_share_token", sparse=True),
        IndexModel([("referred_by_token", ASCENDING)], name="sessions_referred_by", sparse=True),
    ],
    "gut_checks": [
        IndexModel([("idea_id", ASCENDING), ("ticker", ASCENDING)], name="gut_check_lookup"),
        IndexModel([("answered_at", DESCENDING)], name="gut_check_time"),
    ],
    "share_events": [
        IndexModel([("idea_id", ASCENDING)], name="share_idea"),
        IndexModel([("clicked_at", DESCENDING)], name="share_time"),
        IndexModel([("ref", ASCENDING)], name="share_ref", sparse=True),
    ],
    "share_opens": [
        IndexModel([("opened_at", DESCENDING)], name="open_time"),
        IndexModel([("idea_id", ASCENDING)], name="open_idea"),
    ],
    "transcriptions": [
        IndexModel([("day", ASCENDING), ("session_id", ASCENDING)], name="stt_daily_session"),
        IndexModel([("day", ASCENDING), ("ip_fingerprint", ASCENDING)], name="stt_daily_ip"),
        IndexModel([("created_at", DESCENDING)], name="stt_time"),
    ],
    "voice_passes": [
        IndexModel([("token", ASCENDING)], name="voice_pass_token", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="voice_pass_ttl", expireAfterSeconds=600),
    ],
    "events_cache": [IndexModel([("symbol", ASCENDING)], name="events_symbol", unique=True)],
    "share_image_cache": [
        IndexModel([("key", ASCENDING)], name="share_image_key", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="share_image_ttl", expireAfterSeconds=0),
    ],
    "admin_login_failures": [
        IndexModel([("ip_hash", ASCENDING), ("created_at", DESCENDING)], name="admin_failure_ip"),
        IndexModel([("created_at", ASCENDING)], name="admin_failure_ttl", expireAfterSeconds=900),
    ],
    "engagement_events": [
        IndexModel([("event_name", ASCENDING), ("created_at", DESCENDING)], name="event_time"),
        IndexModel([("session_id", ASCENDING), ("created_at", DESCENDING)], name="event_session"),
    ],
    "submission_attempts": [
        IndexModel([("day", ASCENDING), ("session_id", ASCENDING)], name="daily_session_limit"),
        IndexModel([("day", ASCENDING), ("ip_fingerprint", ASCENDING)], name="daily_ip_limit"),
    ],
    "finance_cache": [IndexModel([("symbol", ASCENDING)], name="finance_symbol", unique=True)],
    "historical_cache": [IndexModel([("symbol", ASCENDING)], name="history_symbol", unique=True)],
    "email_interests": [IndexModel([("email", ASCENDING), ("session_id", ASCENDING)], name="email_session", unique=True)],
    "product_interests": [IndexModel([("kind", ASCENDING), ("created_at", DESCENDING)], name="interest_time")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
