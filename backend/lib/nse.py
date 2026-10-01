"""NSE public corporate-announcement feed (unofficial JSON). Cached; failures degrade to stale/empty."""
from datetime import datetime, timedelta, timezone
import logging

import httpx

from lib.db import db

NSE_URL = "https://www.nseindia.com/api/corporate-announcements"
NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://www.nseindia.com/",
}
EVENTS_TTL = timedelta(hours=12)
FILING_KEYWORDS = ("press release", "credit rating", "acquisition", "amalgamation", "merger")
logger = logging.getLogger(__name__)


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def classify(category: str, text: str) -> str | None:
    """Map an NSE announcement category to an Aaspaas event kind, or None to drop routine filings."""
    desc = category.lower()
    if "financial result" in desc:
        return "results"
    if "outcome of board meeting" in desc:
        return "results" if "result" in text.lower() else "filing"
    if any(keyword in desc for keyword in FILING_KEYWORDS):
        return "filing"
    return None


def _summary(text: str, limit: int = 210) -> str:
    clean = " ".join(text.replace("\ufffd", "'").split())
    return clean if len(clean) <= limit else clean[:limit].rsplit(" ", 1)[0] + "…"


async def get_nse_announcements(symbol: str) -> tuple[list[dict], str]:
    """Return (events, status) where status is live | cached | stale | unavailable."""
    now = datetime.now(timezone.utc)
    cached = await db.events_cache.find_one({"symbol": symbol})
    if cached and _aware(cached["expires_at"]) > now:
        return cached["payload"], "cached"
    params = {
        "index": "equities", "symbol": symbol,
        "from_date": (now - timedelta(days=366 * 5 + 14)).strftime("%d-%m-%Y"), "to_date": now.strftime("%d-%m-%Y"),
    }
    try:
        async with httpx.AsyncClient(timeout=10, headers=NSE_HEADERS, follow_redirects=True) as client:
            response = await client.get(NSE_URL, params=params)
            response.raise_for_status()
            rows = response.json()
        if not isinstance(rows, list):
            raise ValueError("Unexpected NSE payload")
        events, seen = [], set()
        for row in rows:
            category, text = str(row.get("desc") or ""), str(row.get("attchmntText") or "")
            kind = classify(category, text)
            date = str(row.get("sort_date") or "")[:10]
            if not kind or len(date) != 10:
                continue
            key = (date, category, text[:80])
            if key in seen:
                continue
            seen.add(key)
            events.append({"date": date, "kind": kind, "category": category, "summary": _summary(text) or category, "url": row.get("attchmntFile") or None})
        events.sort(key=lambda item: item["date"])
        await db.events_cache.update_one(
            {"symbol": symbol}, {"$set": {"symbol": symbol, "payload": events, "expires_at": now + EVENTS_TTL}}, upsert=True
        )
        return events, "live"
    except Exception as exc:
        logger.warning("NSE announcements unavailable for %s: %s", symbol, exc)
        if cached:
            return cached["payload"], "stale"
        return [], "unavailable"
