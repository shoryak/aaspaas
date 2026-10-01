"""Anonymous referral attribution: every sharer gets a stable token derived from their session."""
import hashlib
import hmac
import os

from lib.db import db
from lib.session import utc_now

CRAWLER_PLATFORMS = (
    ("whatsapp", "WhatsApp"), ("facebookexternalhit", "Facebook/Instagram"), ("twitterbot", "X"),
    ("telegrambot", "Telegram"), ("slackbot", "Slack"), ("linkedinbot", "LinkedIn"), ("discordbot", "Discord"),
    ("googlebot", "Google"), ("bot", "Other bot"), ("crawler", "Other bot"), ("preview", "Other bot"),
)


def share_token(session_id: str) -> str:
    secret = os.environ.get("REFERRAL_SECRET") or os.environ.get("ADMIN_PASSWORD", "aaspaas")
    return hmac.new(secret.encode(), session_id.encode(), hashlib.sha256).hexdigest()[:12]


async def ensure_share_token(session_id: str) -> str:
    """Return the session's token, persisting it so referred visitors can be traced back to the sharer."""
    existing = await db.sessions.find_one({"id": session_id}, {"share_token": 1})
    if existing and existing.get("share_token"):
        return existing["share_token"]
    token = share_token(session_id)
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {"share_token": token}, "$setOnInsert": {"id": session_id, "created_at": utc_now(), "is_demo": False}},
        upsert=True,
    )
    return token


def crawler_platform(user_agent: str) -> str | None:
    agent = user_agent.lower()
    return next((label for needle, label in CRAWLER_PLATFORMS if needle in agent), None)
