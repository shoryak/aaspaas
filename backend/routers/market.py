import asyncio
from html import escape
import uuid

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import HTMLResponse

from lib.db import db
from lib.nse import get_nse_announcements
from lib.referral import crawler_platform, ensure_share_token
from lib.session import SESSION_COOKIE, ensure_session, utc_now
from lib.share_card import render_share_card
from lib.yahoo import get_historical
from models.aaspaas import HistoricalData, ShareTokenResponse
from models.market import MarketContextResponse, MarketEvent

router = APIRouter(tags=["market"])
BENCHMARK_SYMBOL = "^NSEI"


async def _idea(idea_id: str) -> dict:
    idea = await db.ideas.find_one({"id": idea_id})
    if not idea:
        raise HTTPException(status_code=404, detail="Discovery not found")
    return idea


@router.get("/ideas/{idea_id}/market-context", response_model=MarketContextResponse)
async def market_context(idea_id: str):
    idea = await _idea(idea_id)
    companies = idea.get("companies", [])
    nse_companies = [company for company in companies if company.get("exchange") == "NSE"]
    benchmark, histories, announcements = await asyncio.gather(
        get_historical("NIFTY50", "NSE", symbol=BENCHMARK_SYMBOL),
        asyncio.gather(*(get_historical(company["ticker"], company["exchange"]) for company in companies)),
        asyncio.gather(*(get_nse_announcements(company["ticker"]) for company in nse_companies)),
    )
    events: list[MarketEvent] = []
    for company, history in zip(companies, histories):
        for action in history.corporate_actions:
            if action.type in ("dividend", "split"):
                events.append(MarketEvent(
                    date=action.date, ticker=company["ticker"], company_name=company["company_name"], kind=action.type,
                    category="Dividend" if action.type == "dividend" else "Stock split",
                    summary=f"{'Dividend of' if action.type == 'dividend' else 'Split ratio'} {action.label} returned by the price source.",
                    source="Yahoo Finance",
                ))
    statuses = []
    for company, (rows, status) in zip(nse_companies, announcements):
        statuses.append(status)
        events.extend(MarketEvent(**row, ticker=company["ticker"], company_name=company["company_name"], source="NSE") for row in rows)
    if not statuses or all(status == "unavailable" for status in statuses):
        events_status = "unavailable"
    elif any(status in ("unavailable", "stale") for status in statuses):
        events_status = "partial"
    else:
        events_status = "cached" if all(status == "cached" for status in statuses) else "live"
    return MarketContextResponse(
        idea_id=idea_id, benchmark_points=benchmark.points, benchmark_status=benchmark.status,
        events=sorted(events, key=lambda event: event.date), events_status=events_status,
    )


async def _card_series(idea: dict, benchmark: bool, hidden: set[str]) -> list[dict]:
    companies = [company for company in idea.get("companies", []) if company["ticker"] not in hidden]
    histories: list[HistoricalData] = list(await asyncio.gather(*(get_historical(company["ticker"], company["exchange"]) for company in companies)))
    series = [{"ticker": company["ticker"], "name": company["company_name"], "points": history.points} for company, history in zip(companies, histories)]
    if benchmark:
        nifty = await get_historical("NIFTY50", "NSE", symbol=BENCHMARK_SYMBOL)
        series.append({"ticker": "NIFTY 50", "name": "Benchmark index", "points": nifty.points, "benchmark": True})
    return series


@router.get("/share/{idea_id}/image.png")
async def share_image(idea_id: str, period: str = Query("5Y", pattern="^(1Y|3Y|5Y)$"), benchmark: bool = False, hidden: str = ""):
    idea = await _idea(idea_id)
    series = await _card_series(idea, benchmark, {item for item in hidden.split(",") if item})
    png = await asyncio.to_thread(render_share_card, idea["observation"], series, period)
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "public, max-age=1800"})


@router.get("/share-token", response_model=ShareTokenResponse)
async def get_share_token(request: Request, response: Response):
    return ShareTokenResponse(token=await ensure_share_token(ensure_session(request, response)))


@router.get("/share/{idea_id}", response_class=HTMLResponse)
async def share_page(
    idea_id: str, request: Request,
    period: str = Query("5Y", pattern="^(1Y|3Y|5Y)$"),
    ref: str = Query("", max_length=24), ch: str = Query("", max_length=16),
):
    """Link-preview page: crawlers read the Open Graph tags, people are attributed to the sharer and redirected."""
    idea = await _idea(idea_id)
    now = utc_now()
    channel = ch if ch in ("whatsapp", "x", "copy", "native", "download") else ("unattributed" if not ref else "link")
    platform = crawler_platform(request.headers.get("user-agent", ""))
    cookie_carrier = Response()
    open_row = {"id": str(uuid.uuid4()), "idea_id": idea_id, "ref": ref or None, "channel": channel, "opened_at": now, "crawler": bool(platform), "platform": platform}
    if not platform:
        is_new = not request.cookies.get(SESSION_COOKIE)
        session_id = ensure_session(request, cookie_carrier)
        own = await db.sessions.find_one({"id": session_id}, {"share_token": 1})
        self_open = bool(ref) and bool(own) and own.get("share_token") == ref
        referral = {"acquired_via": "share", "referred_by_token": ref or None, "referred_idea_id": idea_id, "referral_channel": channel} if is_new else {}
        await db.sessions.update_one(
            {"id": session_id},
            {"$setOnInsert": {"id": session_id, "created_at": now, "is_demo": False, "pageviews": 0, **referral}, "$set": {"last_seen_at": now}},
            upsert=True,
        )
        open_row.update(session_id=session_id, new_visitor=is_new, self_open=self_open)
    await db.share_opens.insert_one(open_row)
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", request.url.netloc)
    base = f"{scheme}://{host}"
    target = f"/?idea={idea_id}&view=recap&shared=1"
    tickers = ", ".join(company["ticker"] for company in idea.get("companies", []))
    title = escape(f"“{idea['observation']}” — an Aaspaas read")
    description = escape(f"{tickers or 'No listed match'} · how these stocks travelled. Educational context, not a recommendation.")
    image = escape(f"{base}/api/share/{idea_id}/image.png?period={period}")
    html_response = HTMLResponse(f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{title}</title>
<meta name="description" content="{description}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Aaspaas">
<meta property="og:title" content="{title}"><meta property="og:description" content="{description}">
<meta property="og:image" content="{image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}"><meta name="twitter:image" content="{image}">
<meta http-equiv="refresh" content="0;url={escape(target)}"><script>window.location.replace({target!r});</script>
</head><body><a href="{escape(target)}">Open this idea on Aaspaas</a></body></html>""")
    html_response.raw_headers.extend(header for header in cookie_carrier.raw_headers if header[0] == b"set-cookie")
    return html_response
