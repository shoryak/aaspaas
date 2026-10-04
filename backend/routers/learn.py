import asyncio
import uuid
from collections import Counter
from datetime import timedelta
from html import escape

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, Response

from lib.db import db
from lib.insta_card import render_portrait
from lib.lessons_content import LESSONS, MODULES
from lib.session import ensure_session, utc_now
from models.learning import LearnResponse, Lesson, LessonModule, SiteVideos
from models.studio import StudioMetric
from routers.analytics import _require_admin

router = APIRouter(tags=["learn"])


async def _seed() -> None:
    if await db.lessons.count_documents({}) == 0:
        await db.lessons.insert_many([dict(lesson) for lesson in LESSONS])
        await db.lesson_modules.insert_many([dict(module) for module in MODULES])


async def _lessons(include_unpublished: bool = False) -> tuple[list[LessonModule], list[Lesson]]:
    await _seed()
    query = {} if include_unpublished else {"published": True}
    lessons = [Lesson(**row) for row in await db.lessons.find(query, {"_id": 0}).sort("number", 1).to_list(200)]
    modules = [LessonModule(**row) for row in await db.lesson_modules.find({}, {"_id": 0}).sort("number", 1).to_list(50)]
    return modules, lessons


@router.get("/lessons", response_model=LearnResponse)
async def list_lessons(request: Request, response: Response):
    session_id = ensure_session(request, response)
    modules, lessons = await _lessons()
    watched = [row["slug"] for row in await db.lesson_progress.find({"session_id": session_id}, {"slug": 1}).to_list(200)]
    return LearnResponse(modules=modules, lessons=lessons, watched=watched)


@router.post("/lessons/{slug}/watched", response_model=LearnResponse)
async def mark_watched(slug: str, request: Request, response: Response, watched: bool = True):
    session_id = ensure_session(request, response)
    if watched:
        await db.lesson_progress.update_one({"session_id": session_id, "slug": slug}, {"$setOnInsert": {"session_id": session_id, "slug": slug, "watched_at": utc_now()}}, upsert=True)
        await db.engagement_events.insert_one({"id": str(uuid.uuid4()), "event_name": "lesson_watched", "session_id": session_id, "properties": {"slug": slug}, "created_at": utc_now()})
    else:
        await db.lesson_progress.delete_one({"session_id": session_id, "slug": slug})
    return await list_lessons(request, response)


@router.get("/site/videos", response_model=SiteVideos)
async def site_videos():
    return SiteVideos(**(await db.site_settings.find_one({"key": "videos"}, {"_id": 0, "key": 0}) or {}))


@router.get("/cards/lesson/{slug}.png")
async def lesson_card(slug: str):
    row = await db.lessons.find_one({"slug": slug}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Lesson not found")
    png = await asyncio.to_thread(render_portrait, f"Lesson {row['number']:02d} · {row['duration']}", row["title"], row["key_idea"], [], f"aaspaas · /learn/{slug}")
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/share/lesson/{slug}", response_class=HTMLResponse)
async def share_lesson(slug: str, request: Request):
    row = await db.lessons.find_one({"slug": slug}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Lesson not found")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    title, desc = escape(f"{row['title']} — Aaspaas Learn"), escape(f"{row['promise']} {row['key_idea']}")
    target = f"/learn/{slug}?src={escape(request.query_params.get('src', 'share'))}"
    return HTMLResponse(f"""<!doctype html><html><head><meta charset="utf-8"><title>{title}</title><meta name="description" content="{desc}"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:image" content="https://{host}/api/cards/lesson/{slug}.png"><meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url={target}"></head><body><a href="{target}">{title}</a></body></html>""")


@router.get("/sitemap.xml")
async def sitemap(request: Request):
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    _, lessons = await _lessons()
    days = [row["date"] for row in await db.trending_days.find({"status": "ready"}, {"date": 1}).sort("date", -1).to_list(60)]
    paths = ["/", "/learn", "/today", *[f"/learn/{lesson.slug}" for lesson in lessons], *[f"/today/{day}" for day in days]]
    body = "".join(f"<url><loc>https://{escape(host)}{path}</loc></url>" for path in paths)
    return Response(content=f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>', media_type="application/xml")


@router.get("/admin/lessons", response_model=LearnResponse)
async def admin_lessons(request: Request):
    _require_admin(request)
    modules, lessons = await _lessons(include_unpublished=True)
    return LearnResponse(modules=modules, lessons=lessons)


@router.put("/admin/lessons/{slug}", response_model=Lesson)
async def save_lesson(slug: str, payload: Lesson, request: Request):
    _require_admin(request)
    if payload.slug != slug:
        raise HTTPException(status_code=400, detail="Slug mismatch")
    await db.lessons.update_one({"slug": slug}, {"$set": payload.model_dump()}, upsert=True)
    return payload


@router.put("/admin/modules/{key}", response_model=LessonModule)
async def save_module(key: str, payload: LessonModule, request: Request):
    _require_admin(request)
    await db.lesson_modules.update_one({"key": key}, {"$set": {**payload.model_dump(), "key": key}}, upsert=True)
    return payload


@router.put("/admin/videos", response_model=SiteVideos)
async def save_videos(payload: SiteVideos, request: Request):
    _require_admin(request)
    await db.site_settings.update_one({"key": "videos"}, {"$set": {"key": "videos", **payload.model_dump()}}, upsert=True)
    return payload


def _m(key: str, label: str, value: float | None, display: str, hint: str = "") -> StudioMetric:
    return StudioMetric(key=key, label=label, value=value, display=display, hint=hint)


def _pct(part: int, whole: int) -> str:
    return f"{part / whole * 100:.0f}%" if whole else "—"


@router.get("/admin/learning-summary", response_model=list[StudioMetric])
async def learning_summary(request: Request, days: int = Query(30, ge=0, le=3650)):
    _require_admin(request)
    since = {"created_at": {"$gte": utc_now() - timedelta(days=days)}} if days else {}
    names = ["lesson_viewed", "lesson_video_played", "lesson_watched", "lesson_to_clue", "trending_clue_opened", "trending_to_clue", "signin_sheet_shown", "signin_completed",
             "portfolio_created", "portfolio_limit_hit", "portfolio_holding_added", "portfolio_holding_sold", "portfolio_reset", "plus_from_portfolio_limit", "portfolio_viewed"]
    events = await db.engagement_events.find({"event_name": {"$in": names}, **since}, {"_id": 0, "event_name": 1, "properties": 1, "session_id": 1}).to_list(None)
    count = Counter(event["event_name"] for event in events)
    sources = Counter((event.get("properties") or {}).get("source", "direct") for event in events if event["event_name"] == "lesson_viewed")
    methods = Counter((event.get("properties") or {}).get("method") for event in events if event["event_name"] == "signin_completed")
    requests_window = {"created_at": since["created_at"]} if since else {}
    sign_requests = await db.signin_requests.count_documents(requests_window)
    send_failures = await db.signin_requests.count_documents({**requests_window, "send_failed": True})
    accounts = await db.accounts.count_documents({})
    opted = await db.accounts.count_documents({"updates_opt_in": True})
    lesson_signups = await db.accounts.count_documents({"updates_opt_in": True, "updates_consent_location": "learn"})
    multi = len([1 async for _ in db.account_tokens.aggregate([{"$group": {"_id": "$account_id", "n": {"$sum": 1}}}, {"$match": {"n": {"$gte": 2}}}])])
    per_reader = Counter([row["n"] async for row in db.portfolios.aggregate([{"$group": {"_id": "$account_id", "n": {"$sum": 1}}}])])
    holdings = [len(row.get("holdings", [])) async for row in db.portfolios.find({}, {"holdings": 1})]
    usage = await db.partner_usage.find(since and {"created_at": since["created_at"]}, {"_id": 0}).to_list(None)
    partner_cost = sum(row.get("cost_usd", 0) for row in usage)
    trending_cost = sum(row.get("ai_cost_usd", 0) for row in await db.trending_days.find({}, {"ai_cost_usd": 1}).to_list(None))
    conversations = len({row.get("conversation_id") for row in usage})
    return [
        _m("lesson_views", "Lesson views", float(count["lesson_viewed"]), f"{count['lesson_viewed']:,}", " · ".join(f"{k} {v}" for k, v in sources.most_common()) or "No views yet."),
        _m("video_plays", "Video plays → watched", float(count["lesson_video_played"]), f"{count['lesson_video_played']:,} → {count['lesson_watched']:,}", f"{_pct(count['lesson_watched'], count['lesson_video_played'])} marked watched."),
        _m("lesson_to_clue", "Lesson → own clue", float(count["lesson_to_clue"]), _pct(count["lesson_to_clue"], count["lesson_viewed"]), f"{count['lesson_to_clue']:,} readers tried a lesson on their own clue."),
        _m("trending", "Trending clue opens → own clue", float(count["trending_clue_opened"]), f"{count['trending_clue_opened']:,} → {count['trending_to_clue']:,}", _pct(count["trending_to_clue"], count["trending_clue_opened"])),
        _m("signin_funnel", "Sign-in funnel", float(count["signin_completed"]), f"{count['signin_sheet_shown']:,} → {sign_requests:,} → {count['signin_completed']:,}", f"Sheet → email sent → signed in · link {methods.get('link', 0)} / code {methods.get('code', 0)} · {_pct(opted, accounts)} of readers opted into updates."),
        _m("accounts", "Signed-in readers", float(accounts), f"{accounts:,}", f"{multi:,} use 2+ devices · {send_failures:,} email send failures."),
        _m("portfolios_per_reader", "Practice portfolios per reader", float(sum(per_reader.values())), f"1: {per_reader.get(1, 0)} · 2: {per_reader.get(2, 0)} · 3: {per_reader.get(3, 0)}", f"3-portfolio limit hit {count['portfolio_limit_hit']:,}× · {count['plus_from_portfolio_limit']:,} Plus waitlist joins from it."),
        _m("portfolio_activity", "Practice portfolio activity", float(count["portfolio_created"]), f"{count['portfolio_created']:,} started", f"Avg holdings {sum(holdings) / len(holdings):.1f} · {count['portfolio_viewed']:,} views · {count['portfolio_holding_sold']:,} sells · {count['portfolio_reset']:,} resets." if holdings else "No portfolios yet."),
        _m("partner", "Thinking-partner conversations", float(conversations), f"{conversations:,} · {len(usage):,} msgs", f"{_pct(sum(1 for row in usage if row.get('redirected')), len(usage))} of messages were 'should I buy?' redirects."),
        _m("ai_cost", "AI cost: trending + partner", trending_cost + partner_cost, f"${trending_cost + partner_cost:.2f}", f"Trending clues ${trending_cost:.2f} (all time) · thinking partner ${partner_cost:.2f}."),
        _m("lesson_signups", "Lesson email sign-ups", float(lesson_signups), f"{lesson_signups:,}", "Verified readers who ticked updates from Learn (consent recorded; no newsletter sent yet)."),
    ]
