"""Daily "What people are noticing" clues from public feeds, pre-run through discovery."""
import asyncio
import logging
import os
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from html import escape
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, Response

from lib.ai_cost import ai_cost_usd
from lib.db import db
from lib.insta_card import render_portrait
from lib.session import utc_now
from lib.vertex import generate_json
from models.learning import TrendingClue, TrendingDay, TrendingLogItem, TrendingLogResponse, TrendingSelection
from routers.analytics import _require_admin
from routers.discovery import build_idea

router = APIRouter(tags=["trending"])
logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")
MAX_CLUES = 5
FEEDS = [
    ("Google Trends India", "https://trends.google.com/trending/rss?geo=IN", 10),
    ("Economic Times", "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms", 12),
    ("Mint", "https://www.livemint.com/rss/companies", 12),
]
SYSTEM = "You pick everyday-observable trends for Aaspaas, an educational Indian app. Return only JSON."
_tasks: set[asyncio.Task] = set()


def ist_today() -> str:
    return datetime.now(IST).date().isoformat()


async def _fetch_items() -> list[dict]:
    items: list[dict] = []
    async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True) as client:
        for source, url, limit in FEEDS:
            try:
                response = await client.get(url)
                response.raise_for_status()
                for node in ET.fromstring(response.content).iter("item"):
                    title = (node.findtext("title") or "").strip()
                    if title:
                        items.append({"title": title, "source": source, "url": (node.findtext("link") or "").strip() or None})
                    if sum(1 for item in items if item["source"] == source) >= limit:
                        break
            except Exception as exc:
                logger.warning("Trending feed %s failed: %s", source, exc)
    return items


async def generate_day(day: str) -> None:
    items = await _fetch_items()
    log: list[dict] = [{"title": item["title"], "source": item["source"], "picked": False, "reason": ""} for item in items]
    clues: list[dict] = []
    cost = 0.0
    try:
        if not items:
            raise RuntimeError("no feed items")
        listing = "\n".join(f"{index}. [{item['source']}] {item['title']}" for index, item in enumerate(items))
        prompt = f"""Items:\n{listing}\nPick up to {MAX_CLUES} items an ordinary Indian person could notice in daily life (products, launches, habits, shop prices, festival or weather effects) that plausibly touch listed NSE/BSE businesses. Rewrite each as a first-person everyday observation of at most 22 words (e.g. 'Every chemist near me now stocks three brands of sunscreen').
ALWAYS skip: politics, crime, deaths, disasters, sports results, celebrity gossip, and anything about stock prices, tips, top gainers, IPOs or results-day moves. Return picks [{{index, observation}}] and skipped [{{index, reason}}] (reason under 8 words) covering every other item."""
        data, usage = await generate_json(SYSTEM, prompt, TrendingSelection, max_output_tokens=3000)
        cost += ai_cost_usd(usage)
        selection = TrendingSelection.model_validate(data)
        for skip in selection.skipped:
            if 0 <= skip.index < len(log):
                log[skip.index]["reason"] = skip.reason
        picks = [pick for pick in selection.picks if 0 <= pick.index < len(items)][:MAX_CLUES]
        ideas = await asyncio.gather(*(build_idea(pick.observation, "trending", extra={"is_demo": True, "kind": "trending", "trending_date": day}) for pick in picks), return_exceptions=True)
        for pick, idea in zip(picks, ideas):
            log[pick.index].update(picked=True, reason="picked")
            if isinstance(idea, Exception) or not idea.get("companies"):
                continue
            cost += idea.get("ai_cost_usd", 0)
            item = items[pick.index]
            clues.append(TrendingClue(id=str(uuid.uuid4()), date=day, observation=pick.observation, source=item["source"], source_url=item["url"], idea_id=idea["id"], tickers=idea["tickers"]).model_dump())
        status = "ready" if clues else "failed"
    except Exception as exc:
        logger.warning("Trending generation failed for %s: %s", day, exc)
        status = "failed"
    await db.trending_days.update_one({"date": day}, {"$set": {"status": status, "items": log, "clues": clues, "ai_cost_usd": cost, "generated_at": utc_now()}})


async def ensure_today() -> None:
    day = ist_today()
    stale = utc_now() - timedelta(minutes=20)
    result = await db.trending_days.update_one(
        {"date": day, "$or": [{"status": "failed", "generated_at": {"$lt": utc_now() - timedelta(hours=3)}}, {"status": "generating", "started_at": {"$lt": stale}}]},
        {"$set": {"status": "generating", "started_at": utc_now()}},
    )
    if not result.modified_count:
        try:
            await db.trending_days.insert_one({"date": day, "status": "generating", "started_at": utc_now(), "clues": [], "items": []})
        except Exception:
            return  # another request/worker already owns today's run
    task = asyncio.create_task(generate_day(day))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def _day_response(day: str | None) -> TrendingDay:
    rows = await db.trending_days.find({"status": "ready"}, {"_id": 0, "date": 1}).sort("date", -1).to_list(30)
    dates = [row["date"] for row in rows]
    target = day or (dates[0] if dates else None)
    doc = await db.trending_days.find_one({"date": target, "status": "ready"}, {"_id": 0}) if target else None
    if not doc:
        if day:
            raise HTTPException(status_code=404, detail="No clues for that day")
        return TrendingDay(date=ist_today(), status="empty", archive_dates=dates)
    clues = [TrendingClue(**clue) for clue in doc["clues"] if not clue.get("hidden")]
    return TrendingDay(date=doc["date"], status="fresh" if doc["date"] == ist_today() else "previous", clues=clues, archive_dates=dates)


@router.get("/trending/today", response_model=TrendingDay)
async def trending_today():
    if os.environ.get("TRENDING_DISABLED") != "1":
        await ensure_today()
    return await _day_response(None)


@router.get("/trending/day/{day}", response_model=TrendingDay)
async def trending_day(day: str):
    return await _day_response(day)


@router.get("/cards/clue/{clue_id}.png")
async def clue_card(clue_id: str):
    doc = await db.trending_days.find_one({"clues.id": clue_id}, {"_id": 0, "clues.$": 1, "date": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Clue not found")
    clue = doc["clues"][0]
    png = await asyncio.to_thread(render_portrait, f"People are noticing · {clue['date']}", f"“{clue['observation']}”", f"Spotted in: {clue['source']}. Open the read on Aaspaas to see the listed companies behind it.", clue.get("tickers", []), "aaspaas · /today")
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/share/today/{day}", response_class=HTMLResponse)
async def share_today(day: str, request: Request):
    data = await _day_response(day)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    image = f"https://{host}/api/cards/clue/{data.clues[0].id}.png" if data.clues else ""
    title = escape(f"What people are noticing · {data.date} — Aaspaas")
    desc = escape(" · ".join(clue.observation for clue in data.clues[:3]))
    target = f"/today/{day}"
    return HTMLResponse(f"""<!doctype html><html><head><meta charset="utf-8"><title>{title}</title><meta name="description" content="{desc}"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:image" content="{escape(image)}"><meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url={target}"></head><body><a href="{target}">Open on Aaspaas</a></body></html>""")


@router.get("/admin/trending", response_model=TrendingLogResponse)
async def trending_log(request: Request):
    _require_admin(request)
    doc = await db.trending_days.find_one({}, {"_id": 0}, sort=[("date", -1)]) or {"date": ist_today(), "items": [], "clues": []}
    return TrendingLogResponse(date=doc["date"], items=[TrendingLogItem(**item) for item in doc.get("items", [])], clues=[TrendingClue(**clue) for clue in doc.get("clues", [])])


@router.post("/admin/trending/clues/{clue_id}/hidden", response_model=TrendingLogResponse)
async def toggle_clue(clue_id: str, hidden: bool, request: Request):
    _require_admin(request)
    await db.trending_days.update_one({"clues.id": clue_id}, {"$set": {"clues.$.hidden": hidden}})
    return await trending_log(request)


@router.post("/admin/trending/regenerate", response_model=TrendingLogResponse)
async def regenerate(request: Request):
    _require_admin(request)
    await db.trending_days.delete_one({"date": ist_today()})
    await db.trending_days.insert_one({"date": ist_today(), "status": "generating", "started_at": utc_now(), "clues": [], "items": []})
    await generate_day(ist_today())
    return await trending_log(request)
