import hashlib
import hmac
import os
import statistics

from fastapi import APIRouter, HTTPException, Request, Response

from lib.db import db
from models.aaspaas import (
    AdminLogin,
    AdminLoginResponse,
    AnalyticsSummary,
    CompanyFrequency,
    DashboardMetric,
    FunnelStep,
    TrendPoint,
)

router = APIRouter(tags=["analytics"])
ADMIN_COOKIE = "aaspaas_admin"


def _admin_token() -> str:
    return hashlib.sha256(f"aaspaas:{os.environ.get('ADMIN_PASSWORD', '')}".encode()).hexdigest()


def _require_admin(request: Request) -> None:
    if not hmac.compare_digest(request.cookies.get(ADMIN_COOKIE, ""), _admin_token()):
        raise HTTPException(status_code=401, detail="Admin authentication required")


@router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(payload: AdminLogin, response: Response):
    expected = os.environ.get("ADMIN_PASSWORD", "")
    if not expected or not hmac.compare_digest(payload.password, expected):
        raise HTTPException(status_code=401, detail="Incorrect password")
    response.set_cookie(ADMIN_COOKIE, _admin_token(), httponly=True, samesite="lax", max_age=28800)
    return AdminLoginResponse(authenticated=True)


async def _event_count(name: str) -> int:
    return await db.engagement_events.count_documents({"event_name": name})


def _ratio(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0


@router.get("/admin/summary", response_model=AnalyticsSummary)
async def admin_summary(request: Request):
    _require_admin(request)
    ideas_count = await db.ideas.count_documents({})
    sessions_count = await db.sessions.count_documents({})
    shares_count = await db.share_events.count_documents({})
    checks_count = await db.gut_checks.count_documents({})
    matched_count = await db.gut_checks.count_documents({"matched": True})
    company_total_rows = await db.ideas.aggregate([{"$project": {"count": {"$size": {"$ifNull": ["$companies", []]}}}}, {"$group": {"_id": None, "total": {"$sum": "$count"}}}]).to_list(1)
    company_total = company_total_rows[0]["total"] if company_total_rows else 0
    pageview_rows = await db.sessions.aggregate([{"$group": {"_id": None, "total": {"$sum": "$pageviews"}}}]).to_list(1)
    pageviews = int(pageview_rows[0]["total"]) if pageview_rows else 0
    top_rows = await db.ideas.aggregate([
        {"$unwind": "$tickers"}, {"$group": {"_id": "$tickers", "mentions": {"$sum": 1}}},
        {"$sort": {"mentions": -1}}, {"$limit": 8},
    ]).to_list(8)
    trend_rows = await db.ideas.aggregate([
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$submitted_at"}}, "ideas": {"$sum": 1}}},
        {"$sort": {"_id": 1}}, {"$limit": 14},
    ]).to_list(14)
    share_rows = await db.share_events.aggregate([
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$clicked_at"}}, "shares": {"$sum": 1}}},
    ]).to_list(100)
    shares_by_day = {row["_id"]: row["shares"] for row in share_rows}
    recap_count = await _event_count("recap_completed")
    hook_views = await _event_count("stock_hook_viewed")
    hook_continues = await _event_count("stock_hook_continued")
    chart_expands = await _event_count("chart_expanded")
    chain_completes = await _event_count("cause_chain_completed")
    journal_opens = await _event_count("journal_opened")
    email_prompts = await _event_count("email_prompt_shown")
    email_count = await db.email_interests.count_documents({"status": "subscribed"})
    limit_hits = await _event_count("rate_limit_hit")
    fallback_count = await db.ideas.count_documents({"discovery_mode": "curated_fallback"})
    screener_clicks = await _event_count("screener_outbound_clicked")
    performance_views = await _event_count("performance_section_viewed")
    quality_continuations = await _event_count("performance_to_quality_continued")
    detail_choices = await db.engagement_events.count_documents({"event_name": "result_action_selected", "properties.action": "details"})
    intuition_choices = await db.engagement_events.count_documents({"event_name": "result_action_selected", "properties.action": "intuition"})
    result_choices = detail_choices + intuition_choices
    return_visitors = await db.sessions.count_documents({"pageviews": {"$gt": 1}})
    generation_rows = await db.ideas.find({"generation_ms": {"$gt": 0}}, {"generation_ms": 1}).to_list(10000)
    median_generation = statistics.median([row["generation_ms"] for row in generation_rows]) if generation_rows else 0
    dwell_rows = await db.engagement_events.find({"event_name": "stage_dwell", "properties.duration_ms": {"$gt": 0}}, {"properties.duration_ms": 1}).to_list(10000)
    dwell_values = [row.get("properties", {}).get("duration_ms", 0) for row in dwell_rows]
    median_dwell = statistics.median(dwell_values) / 1000 if dwell_values else 0
    engagement = [
        DashboardMetric(key="completion", label="Completion", value=_ratio(recap_count, ideas_count), display=f"{_ratio(recap_count, ideas_count):.0%}"),
        DashboardMetric(key="first_company", label="Median first company", value=float(median_generation), display=f"{median_generation / 1000:.1f}s"),
        DashboardMetric(key="hook_continuation", label="Hook continuation", value=_ratio(hook_continues, hook_views), display=f"{_ratio(hook_continues, hook_views):.0%}"),
        DashboardMetric(key="chart_expansion", label="Chart expansion", value=_ratio(chart_expands, hook_views), display=f"{_ratio(chart_expands, hook_views):.0%}"),
        DashboardMetric(key="chain_completion", label="Chain completion", value=_ratio(chain_completes, company_total), display=f"{_ratio(chain_completes, company_total):.0%}"),
        DashboardMetric(key="question_engagement", label="Question engagement", value=_ratio(checks_count, company_total), display=f"{_ratio(checks_count, company_total):.0%}"),
        DashboardMetric(key="dwell", label="Median stage dwell", value=float(median_dwell), display=f"{median_dwell:.1f}s"),
        DashboardMetric(key="return_visitors", label="Return visitors", value=float(return_visitors), display=str(return_visitors)),
        DashboardMetric(key="journal_opens", label="Journal opens", value=float(journal_opens), display=str(journal_opens)),
        DashboardMetric(key="email_conversion", label="Email conversion", value=_ratio(email_count, email_prompts), display=f"{_ratio(email_count, email_prompts):.0%}"),
        DashboardMetric(key="limit_hits", label="Limit hits", value=float(limit_hits), display=str(limit_hits)),
        DashboardMetric(key="fallback", label="Fallback rate", value=_ratio(fallback_count, ideas_count), display=f"{_ratio(fallback_count, ideas_count):.0%}"),
        DashboardMetric(key="screener", label="Screener clicks", value=float(screener_clicks), display=str(screener_clicks)),
        DashboardMetric(key="performance_quality", label="Price → quality", value=_ratio(quality_continuations, performance_views), display=f"{_ratio(quality_continuations, performance_views):.0%}"),
        DashboardMetric(key="details_choice", label="Details choice", value=_ratio(detail_choices, result_choices), display=f"{_ratio(detail_choices, result_choices):.0%}"),
        DashboardMetric(key="intuition_choice", label="Intuition choice", value=_ratio(intuition_choices, result_choices), display=f"{_ratio(intuition_choices, result_choices):.0%}"),
    ]
    return AnalyticsSummary(
        ideas_submitted=ideas_count, sessions=sessions_count, pageviews=pageviews,
        shares=shares_count, gut_checks=checks_count,
        gut_check_accuracy=(matched_count / checks_count if checks_count else None),
        share_click_rate=(shares_count / ideas_count if ideas_count else None),
        trend=[TrendPoint(date=row["_id"], ideas=row["ideas"], shares=shares_by_day.get(row["_id"], 0)) for row in trend_rows],
        top_companies=[CompanyFrequency(ticker=row["_id"], mentions=row["mentions"]) for row in top_rows],
        engagement=engagement,
        funnel=[
            FunnelStep(key="ideas", label="Ideas created", count=ideas_count),
            FunnelStep(key="hooks", label="Stock hooks viewed", count=hook_views),
            FunnelStep(key="recaps", label="Recaps completed", count=recap_count),
            FunnelStep(key="shares", label="Shares clicked", count=shares_count),
        ],
    )