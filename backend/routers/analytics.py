import hashlib
import hmac
import os
import statistics
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, Request, Response

from lib.ai_cost import DEFAULT_IDEA_USD
from lib.db import db
from lib.rate_limit import client_ip
from lib.session import utc_now
from models.aaspaas import AdminLogin, AdminLoginResponse
from models.studio import (
    AcquisitionPoint, ChannelRow, GenerationRow, PlatformRow, PowerUser, SpreadingIdea,
    StudioFunnelStep, StudioMetric, StudioSummary, TickerCount,
)

router = APIRouter(tags=["analytics"])
ADMIN_COOKIE = "aaspaas_admin"
REAL = {"is_demo": {"$ne": True}}
ENGAGED_EVENTS = ["result_action_selected", "detail_section_opened", "chart_event_opened", "benchmark_toggled"]
HEALTH_EVENTS = [
    "performance_section_viewed", "performance_to_quality_continued", "result_action_selected", "detail_section_opened",
    "chart_event_opened", "benchmark_toggled", "journal_opened", "screener_outbound_clicked", "tour_completed",
    "tour_skipped", "rate_limit_hit", "recap_completed", "global_cap_hit", "friend_landing_viewed", "friend_landing_submitted",
]
LOCKOUT_ATTEMPTS = 5
LOCKOUT_WINDOW = timedelta(minutes=15)
SUMMARY_TTL_SECONDS = 60
_summary_cache: dict[int, tuple[float, StudioSummary]] = {}


def _admin_token() -> str:
    return hashlib.sha256(f"aaspaas:{os.environ.get('ADMIN_PASSWORD', '')}".encode()).hexdigest()


def _require_admin(request: Request) -> None:
    if not hmac.compare_digest(request.cookies.get(ADMIN_COOKIE, ""), _admin_token()):
        raise HTTPException(status_code=401, detail="Admin authentication required")


@router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(payload: AdminLogin, request: Request, response: Response):
    ip_hash = hashlib.sha256(f"admin:{client_ip(request)}".encode()).hexdigest()
    recent = await db.admin_login_failures.count_documents({"ip_hash": ip_hash, "created_at": {"$gte": utc_now() - LOCKOUT_WINDOW}})
    if recent >= LOCKOUT_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.", headers={"Retry-After": "900"})
    expected = os.environ.get("ADMIN_PASSWORD", "")
    if not expected or not hmac.compare_digest(payload.password, expected):
        await db.admin_login_failures.insert_one({"ip_hash": ip_hash, "created_at": utc_now()})
        raise HTTPException(status_code=401, detail="Incorrect password")
    await db.admin_login_failures.delete_many({"ip_hash": ip_hash})
    response.set_cookie(ADMIN_COOKIE, _admin_token(), httponly=True, samesite="lax", max_age=28800)
    return AdminLoginResponse(authenticated=True)


@router.get("/admin/session", response_model=AdminLoginResponse)
async def admin_session(request: Request):
    """Lets the Studio page decide between login and dashboard without a 401 round-trip."""
    return AdminLoginResponse(authenticated=hmac.compare_digest(request.cookies.get(ADMIN_COOKIE, ""), _admin_token()))


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _ratio(numerator: float, denominator: float) -> float | None:
    return numerator / denominator if denominator else None


def _pct(value: float | None) -> str:
    return "—" if value is None else f"{value:.0%}"


def _usd(value: float | None) -> str:
    if value is None:
        return "—"
    return f"${value:.4f}" if value < 0.1 else f"${value:,.2f}"


def _metric(key: str, label: str, value: float | None, display: str, hint: str = "") -> StudioMetric:
    return StudioMetric(key=key, label=label, value=value, display=display, hint=hint)


def _anon(session_id: str) -> str:
    return f"visitor·{hashlib.sha256(session_id.encode()).hexdigest()[:6]}"


@router.get("/admin/summary", response_model=StudioSummary)
async def admin_summary(request: Request, days: int = Query(30), fresh: bool = False):
    _require_admin(request)
    if days not in (0, 7, 30, 90):
        raise HTTPException(status_code=422, detail="days must be 0, 7, 30 or 90")
    cached = _summary_cache.get(days)
    if cached and not fresh and cached[0] > time.monotonic():
        return cached[1]
    summary = await _build_summary(days)
    _summary_cache[days] = (time.monotonic() + SUMMARY_TTL_SECONDS, summary)
    return summary


async def _build_summary(days: int) -> StudioSummary:
    now = utc_now()
    since = now - timedelta(days=days) if days else None

    def in_range(value: datetime | None) -> bool:
        stamp = _aware(value)
        return stamp is not None and (since is None or stamp >= since)

    window = (lambda field: {field: {"$gte": since}}) if since else (lambda field: {})
    # MVP scale: pull lean projections and join in Python. Move to pre-aggregated rollups past ~100k sessions.
    sessions = await db.sessions.find(REAL, {"_id": 0, "id": 1, "created_at": 1, "last_seen_at": 1, "pageviews": 1, "acquired_via": 1, "referred_by_token": 1, "referred_idea_id": 1, "referral_channel": 1, "share_token": 1}).to_list(None)
    ideas = await db.ideas.find(REAL, {"_id": 0, "id": 1, "session_id": 1, "input_mode": 1, "submitted_at": 1, "discovery_mode": 1, "ai_cost_usd": 1, "generation_ms": 1, "tickers": 1, "observation": 1, "recap_completed_at": 1}).to_list(None)
    shares = await db.share_events.find(REAL, {"_id": 0, "idea_id": 1, "session_id": 1, "clicked_at": 1, "channel": 1, "ref": 1, "surface": 1}).to_list(None)
    opens = await db.share_opens.find(window("opened_at"), {"_id": 0}).to_list(None)
    events = await db.engagement_events.find({"event_name": {"$in": HEALTH_EVENTS}, **window("created_at")}, {"_id": 0, "event_name": 1, "idea_id": 1, "session_id": 1, "properties": 1}).to_list(None)
    interests = await db.product_interests.find(window("created_at"), {"_id": 0, "kind": 1, "session_id": 1}).to_list(None)
    emails = await db.email_interests.find({"status": "subscribed"}, {"_id": 0, "session_id": 1, "consent_at": 1}).to_list(None)
    voice = await db.transcriptions.find(window("created_at"), {"_id": 0, "session_id": 1, "cost_usd": 1, "language": 1, "seconds": 1, "engine": 1}).to_list(None)
    checks = await db.gut_checks.find({**REAL, **window("answered_at")}, {"_id": 0, "matched": 1}).to_list(None)

    ideas_in = [idea for idea in ideas if in_range(idea.get("submitted_at"))]
    shares_in = [share for share in shares if in_range(share.get("clicked_at"))]
    human_opens = [row for row in opens if not row.get("crawler") and not row.get("self_open")]
    by_event = defaultdict(list)
    for event in events:
        by_event[event["event_name"]].append(event)

    active_ids = {s["id"] for s in sessions if in_range(s.get("last_seen_at") or s.get("created_at"))}
    active_ids |= {idea["session_id"] for idea in ideas_in} | {share["session_id"] for share in shares_in}
    active = len(active_ids)
    new_sessions = [s for s in sessions if in_range(s.get("created_at"))]
    referred_new = [s for s in new_sessions if s.get("acquired_via") == "share"]
    idea_sessions_all = {idea["session_id"] for idea in ideas}
    sharer_ids_all = {share["session_id"] for share in shares}
    sharers = {share["session_id"] for share in shares_in}
    activated = [s for s in referred_new if s["id"] in idea_sessions_all]
    reshared = [s for s in referred_new if s["id"] in sharer_ids_all]

    k_activated = _ratio(len(activated), active)
    k_visits = _ratio(len(referred_new), active)
    share_rate = _ratio(len(sharers), active)
    headline = [
        _metric("k_factor", "K-factor (activated)", k_activated, "—" if k_activated is None else f"{k_activated:.2f}", "Referred visitors who created an idea ÷ active users. Above 1.0 = self-sustaining growth."),
        _metric("k_visits", "Viral reach (visits)", k_visits, "—" if k_visits is None else f"{k_visits:.2f}", "New visitors arriving through shared links ÷ active users."),
        _metric("share_rate", "Share rate / active user", share_rate, _pct(share_rate), "Share of active users who shared at least once."),
        _metric("active_users", "Active users", float(active), f"{active:,}", "Anonymous sessions with a visit, idea, or share in range."),
        _metric("new_visitors", "New visitors", float(len(new_sessions)), f"{len(new_sessions):,}", f"{len(referred_new):,} arrived via a shared link ({_pct(_ratio(len(referred_new), len(new_sessions)))})."),
        _metric("ideas", "Ideas explored", float(len(ideas_in)), f"{len(ideas_in):,}", f"{_ratio(len(ideas_in), active) or 0:.1f} per active user."),
    ]
    viral_funnel = [
        StudioFunnelStep(key="active", label="Active users", count=active),
        StudioFunnelStep(key="sharers", label="Shared at least once", count=len(sharers)),
        StudioFunnelStep(key="shares", label="Shares sent", count=len(shares_in)),
        StudioFunnelStep(key="opens", label="Shared links opened (people)", count=len(human_opens)),
        StudioFunnelStep(key="new_visitors", label="New visitors from shares", count=len(referred_new)),
        StudioFunnelStep(key="activated", label="…who explored an idea", count=len(activated)),
        StudioFunnelStep(key="reshared", label="…who shared onward", count=len(reshared)),
    ]

    channel_names = sorted({share.get("channel") or "unattributed" for share in shares_in} | {row.get("channel") or "unattributed" for row in human_opens} | {s.get("referral_channel") or "unattributed" for s in referred_new})
    share_by_channel = Counter(share.get("channel") or "unattributed" for share in shares_in)
    open_by_channel = Counter(row.get("channel") or "unattributed" for row in human_opens)
    visit_by_channel = Counter(s.get("referral_channel") or "unattributed" for s in referred_new)
    act_by_channel = Counter(s.get("referral_channel") or "unattributed" for s in activated)
    channels = sorted([
        ChannelRow(channel=name, shares=share_by_channel[name], opens=open_by_channel[name], new_visitors=visit_by_channel[name], activated=act_by_channel[name], conversion=_ratio(act_by_channel[name], share_by_channel[name]))
        for name in channel_names
    ], key=lambda row: (row.new_visitors, row.opens, row.shares), reverse=True)
    platforms = Counter(row.get("platform") or "Other bot" for row in opens if row.get("crawler"))
    preview_platforms = [PlatformRow(platform=name, fetches=count) for name, count in platforms.most_common()]

    share_times = defaultdict(list)
    for share in shares:
        if share.get("ref"):
            share_times[(share["ref"], share["idea_id"])].append(_aware(share["clicked_at"]))
    cycle_hours = []
    for s in referred_new:
        created = _aware(s.get("created_at"))
        prior = [stamp for stamp in share_times.get((s.get("referred_by_token"), s.get("referred_idea_id")), []) if stamp <= created]
        if prior:
            cycle_hours.append((created - max(prior)).total_seconds() / 3600)
    median_cycle = statistics.median(cycle_hours) if cycle_hours else None
    viral_cycle = _metric("viral_cycle", "Viral cycle time", median_cycle, "—" if median_cycle is None else (f"{median_cycle * 60:.0f} min" if median_cycle < 1 else f"{median_cycle:.1f} h"), f"Median time from a share to the referred visitor's first open ({len(cycle_hours)} measured).")

    token_owner = {s["share_token"]: s["id"] for s in sessions if s.get("share_token")}
    parent = {s["id"]: token_owner.get(s.get("referred_by_token")) for s in sessions if s.get("acquired_via") == "share"}
    depth_cache: dict[str, int] = {}

    def depth(session_id: str | None, guard: int = 0) -> int:
        if not session_id or session_id not in parent or guard > 50:
            return 0
        if session_id not in depth_cache:
            depth_cache[session_id] = 1 + depth(parent[session_id], guard + 1)
        return depth_cache[session_id]

    generation_counts = Counter(min(depth(s["id"]), 3) for s in referred_new)
    generations = [GenerationRow(generation=label, visitors=generation_counts[level]) for level, label in ((1, "1st hop"), (2, "2nd hop"), (3, "3rd hop +"))]
    chain_max_depth = max((depth(session_id) for session_id in parent), default=0)

    idea_lookup = {idea["id"]: idea for idea in ideas}
    spread: dict[str, Counter] = defaultdict(Counter)
    for share in shares_in:
        spread[share["idea_id"]]["shares"] += 1
    for row in human_opens:
        spread[row["idea_id"]]["opens"] += 1
    for s in referred_new:
        spread[s.get("referred_idea_id") or ""]["new_visitors"] += 1
    for s in activated:
        spread[s.get("referred_idea_id") or ""]["activated"] += 1
    top_spreading = [
        SpreadingIdea(idea_id=idea_id, observation=(idea_lookup[idea_id].get("observation", "")[:110]), tickers=idea_lookup[idea_id].get("tickers", []), shares=row["shares"], opens=row["opens"], new_visitors=row["new_visitors"], activated=row["activated"])
        for idea_id, row in sorted(spread.items(), key=lambda item: (item[1]["new_visitors"], item[1]["opens"], item[1]["shares"]), reverse=True)
        if idea_id in idea_lookup
    ][:8]

    span = min(days or 60, 90)
    day_keys = [(now - timedelta(days=offset)).date().isoformat() for offset in range(span - 1, -1, -1)]
    day = lambda value: _aware(value).date().isoformat() if value else ""
    direct_days = Counter(day(s.get("created_at")) for s in new_sessions if s.get("acquired_via") != "share")
    referred_days = Counter(day(s.get("created_at")) for s in referred_new)
    idea_days = Counter(day(idea.get("submitted_at")) for idea in ideas_in)
    share_days = Counter(day(share.get("clicked_at")) for share in shares_in)
    acquisition_trend = [AcquisitionPoint(date=key, direct=direct_days[key], referred=referred_days[key], ideas=idea_days[key], shares=share_days[key]) for key in day_keys]

    limit_sessions = {event.get("session_id") for event in by_event["rate_limit_hit"]}
    plus_sessions = {row["session_id"] for row in interests if row.get("kind") == "plus"}
    broker_sessions = {row["session_id"] for row in interests if row.get("kind") == "broker"}
    new_emails = [row for row in emails if in_range(row.get("consent_at"))]
    ideas_per_session = Counter(idea["session_id"] for idea in ideas_in)
    power_ids = {session_id for session_id, count in ideas_per_session.items() if count >= 3}
    paid_intent = limit_sessions | plus_sessions | power_ids | {row["session_id"] for row in new_emails}
    monetization = [
        _metric("limit_hits", "Daily-limit hits", float(len(by_event["rate_limit_hit"])), f"{len(by_event['rate_limit_hit']):,}", f"{len(limit_sessions):,} users ({_pct(_ratio(len(limit_sessions), active))} of active) wanted more than 3 ideas/day."),
        _metric("plus_interest", "Plus interest", float(len(plus_sessions)), f"{len(plus_sessions):,}", f"{_pct(_ratio(len(plus_sessions), len(limit_sessions)))} of limit-hitters tapped 'Preview Plus'."),
        _metric("broker_interest", "Broker handoff interest", float(len(broker_sessions)), f"{len(broker_sessions):,}", f"{_pct(_ratio(len(broker_sessions), active))} of active users — the affiliate revenue signal."),
        _metric("email_list", "Email list", float(len(emails)), f"{len(emails):,}", f"+{len(new_emails):,} in range. Owned channel for launches and re-engagement."),
        _metric("power_users", "Power users (3+ ideas)", float(len(power_ids)), f"{len(power_ids):,}", f"{_pct(_ratio(len(power_ids), active))} of active users."),
        _metric("busy_hits", "Global AI cap hits", float(len(by_event["global_cap_hit"])), f"{len(by_event['global_cap_hit']):,}", "Visitors turned away by the daily AI budget — raise GLOBAL_DAILY_AI_CAP if this grows."),
        _metric("paid_intent", "Paid-intent audience", float(len(paid_intent)), f"{len(paid_intent):,}", f"Limit-hitters ∪ Plus interest ∪ power users ∪ new emails = {_pct(_ratio(len(paid_intent), active))} of active."),
    ]
    shares_per_session = Counter(share["session_id"] for share in shares_in)
    limits_per_session = Counter(event.get("session_id") for event in by_event["rate_limit_hit"])
    referred_per_token = Counter(s.get("referred_by_token") for s in sessions if s.get("acquired_via") == "share")
    session_lookup = {s["id"]: s for s in sessions}
    power_users = [
        PowerUser(
            label=_anon(session_id), ideas=count, shares=shares_per_session[session_id], limit_hits=limits_per_session[session_id],
            referred_visitors=referred_per_token[session_lookup.get(session_id, {}).get("share_token")] if session_lookup.get(session_id, {}).get("share_token") else 0,
            last_seen=day(session_lookup.get(session_id, {}).get("last_seen_at")) or None,
        )
        for session_id, count in ideas_per_session.most_common(8) if count >= 2
    ]

    ai_ideas = [idea for idea in ideas_in if idea.get("discovery_mode") == "ai"]
    measured = [idea["ai_cost_usd"] for idea in ideas if idea.get("ai_cost_usd")]
    average_cost = statistics.mean(measured) if measured else DEFAULT_IDEA_USD
    measured_in = [idea["ai_cost_usd"] for idea in ai_ideas if idea.get("ai_cost_usd")]
    total_cost = sum(measured_in) + (len(ai_ideas) - len(measured_in)) * average_cost
    engaged_ids = {event.get("idea_id") for name in ENGAGED_EVENTS for event in by_event[name]} | {idea["id"] for idea in ideas_in if idea.get("recap_completed_at")}
    engaged_ideas = [idea for idea in ideas_in if idea["id"] in engaged_ids]
    fallback = sum(1 for idea in ideas_in if idea.get("discovery_mode") == "curated_fallback")
    generation = [idea["generation_ms"] for idea in ideas_in if idea.get("generation_ms")]
    unit_economics = [
        _metric("ai_cost", "AI spend (est.)", total_cost, _usd(total_cost), f"Vertex Gemini 2.5 Flash · {len(measured_in)}/{len(ai_ideas)} ideas measured from token usage."),
        _metric("cost_per_idea", "Cost / idea", _ratio(total_cost, len(ai_ideas)), _usd(_ratio(total_cost, len(ai_ideas)))),
        _metric("cost_per_engaged", "Cost / engaged idea", _ratio(total_cost, len(engaged_ideas)), _usd(_ratio(total_cost, len(engaged_ideas))), f"{_pct(_ratio(len(engaged_ideas), len(ideas_in)))} of ideas led to details, markers, Nifty, or recap."),
        _metric("cost_per_share", "Cost / share", _ratio(total_cost, len(shares_in)), _usd(_ratio(total_cost, len(shares_in)))),
        _metric("viral_cac", "Viral CAC", _ratio(total_cost, len(referred_new)), _usd(_ratio(total_cost, len(referred_new))), "AI spend ÷ visitors acquired through shares (no ad spend)."),
        _metric("voice_cost", "Voice transcription spend", sum(row.get("cost_usd", 0) for row in voice), _usd(sum(row.get("cost_usd", 0) for row in voice)), " · ".join(f"{engine.title()}: {sum(1 for row in voice if (row.get('engine') or 'whisper') == engine)} clips, {sum(row.get('seconds', 0) for row in voice if (row.get('engine') or 'whisper') == engine) / 60:.1f} min, {_usd(sum(row.get('cost_usd', 0) for row in voice if (row.get('engine') or 'whisper') == engine))}" for engine in ("deepgram", "whisper")) + "."),
        _metric("fallback_rate", "Fallback rate", _ratio(fallback, len(ideas_in)), _pct(_ratio(fallback, len(ideas_in))), "Curated fallback instead of live AI (cost-free but lower quality)."),
        _metric("generation", "Median AI wait", statistics.median(generation) / 1000 if generation else None, f"{statistics.median(generation) / 1000:.1f}s" if generation else "—"),
    ]

    actions = by_event["result_action_selected"]
    details = sum(1 for event in actions if event.get("properties", {}).get("action") == "details")
    tours = len(by_event["tour_completed"]) + len(by_event["tour_skipped"])
    matched = sum(1 for row in checks if row.get("matched"))
    returning = sum(1 for session_id in active_ids if (session_lookup.get(session_id, {}).get("pageviews") or 0) > 1)
    recaps = sum(1 for idea in ideas_in if idea.get("recap_completed_at"))
    chart_shares = sum(1 for share in shares_in if share.get("surface") == "chart")
    product_health = [
        _metric("recap_rate", "Recap completion", _ratio(recaps, len(ideas_in)), _pct(_ratio(recaps, len(ideas_in)))),
        _metric("price_to_quality", "Price → quality scroll", _ratio(len(by_event["performance_to_quality_continued"]), len(by_event["performance_section_viewed"])), _pct(_ratio(len(by_event["performance_to_quality_continued"]), len(by_event["performance_section_viewed"])))),
        _metric("details_choice", "Details vs intuition", _ratio(details, len(actions)), _pct(_ratio(details, len(actions))), "Share of result actions choosing 'Explore details'."),
        _metric("read_match", "Intuition match", _ratio(matched, len(checks)), _pct(_ratio(matched, len(checks))), f"{len(checks):,} gut checks answered."),
        _metric("returning", "Returning users", _ratio(returning, active), _pct(_ratio(returning, active))),
        _metric("chart_shares", "Chart shares", float(chart_shares), f"{chart_shares:,}", f"{_pct(_ratio(chart_shares, len(shares_in)))} of all shares."),
        _metric("event_opens", "Filing markers opened", float(len(by_event["chart_event_opened"])), f"{len(by_event['chart_event_opened']):,}"),
        _metric("benchmark", "Nifty comparisons", float(len(by_event["benchmark_toggled"])), f"{len(by_event['benchmark_toggled']):,}"),
        _metric("friend_landing", "Friend landing → own clue", _ratio(len(by_event["friend_landing_submitted"]), len(by_event["friend_landing_viewed"])), _pct(_ratio(len(by_event["friend_landing_submitted"]), len(by_event["friend_landing_viewed"]))), f"{len(by_event['friend_landing_viewed']):,} shared-link landings."),
        _metric("voice_ideas", "Ideas started by voice", _ratio(sum(1 for idea in ideas_in if idea.get("input_mode") == "voice"), len(ideas_in)), _pct(_ratio(sum(1 for idea in ideas_in if idea.get("input_mode") == "voice"), len(ideas_in))), f"{len({row['session_id'] for row in voice}):,} visitors used the mic · languages: {', '.join(f'{lang} {count}' for lang, count in Counter(row.get('language') or '?' for row in voice).most_common(3)) or '—'}."),
        _metric("tour", "Tour completion", _ratio(len(by_event["tour_completed"]), tours), _pct(_ratio(len(by_event["tour_completed"]), tours))),
        _metric("screener", "Screener handoffs", float(len(by_event["screener_outbound_clicked"])), f"{len(by_event['screener_outbound_clicked']):,}"),
    ]
    tickers = Counter(ticker for idea in ideas_in for ticker in idea.get("tickers", []))
    notes = [
        "Referral attribution started with tokenised share links; earlier shares and visits appear as unattributed.",
        "AI cost uses list prices (override with VERTEX_INPUT_USD_PER_M / VERTEX_OUTPUT_USD_PER_M). Ideas created before token tracking use the measured average.",
        "Link-preview fetches by WhatsApp/X bots are counted separately and never as visitors.",
    ]
    return StudioSummary(
        range_days=days, generated_at=now, headline=headline, viral_funnel=viral_funnel, channels=channels,
        preview_platforms=preview_platforms, viral_cycle=viral_cycle, chain_max_depth=chain_max_depth, generations=generations,
        top_spreading=top_spreading, acquisition_trend=acquisition_trend, monetization=monetization, power_users=power_users,
        unit_economics=unit_economics, product_health=product_health,
        top_companies=[TickerCount(ticker=ticker, mentions=count) for ticker, count in tickers.most_common(8)], notes=notes,
    )
