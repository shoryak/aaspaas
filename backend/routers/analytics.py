import hashlib
import hmac
import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response

from lib.db import db
from models.aaspaas import (
    AdminLogin,
    AdminLoginResponse,
    AnalyticsSummary,
    CompanyFrequency,
    TrendPoint,
)

router = APIRouter(tags=["analytics"])
ADMIN_COOKIE = "aaspaas_admin"


def _admin_token() -> str:
    password = os.environ.get("ADMIN_PASSWORD", "")
    return hashlib.sha256(f"aaspaas:{password}".encode()).hexdigest()


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


@router.get("/admin/summary", response_model=AnalyticsSummary)
async def admin_summary(request: Request):
    _require_admin(request)
    ideas_count = await db.ideas.count_documents({})
    sessions_count = await db.sessions.count_documents({})
    shares_count = await db.share_events.count_documents({})
    gut_checks_count = await db.gut_checks.count_documents({})
    matched_count = await db.gut_checks.count_documents({"matched": True})
    pageviews_result = await db.sessions.aggregate([{"$group": {"_id": None, "total": {"$sum": "$pageviews"}}}]).to_list(1)
    pageviews = int(pageviews_result[0]["total"]) if pageviews_result else 0
    top_rows = await db.ideas.aggregate([
        {"$unwind": "$tickers"}, {"$group": {"_id": "$tickers", "mentions": {"$sum": 1}}},
        {"$sort": {"mentions": -1}}, {"$limit": 8},
    ]).to_list(8)
    trend_rows = await db.ideas.aggregate([
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$submitted_at"}}, "ideas": {"$sum": 1}}},
        {"$sort": {"_id": 1}}, {"$limit": 14},
    ]).to_list(14)
    share_trend_rows = await db.share_events.aggregate([
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$clicked_at"}}, "shares": {"$sum": 1}}},
    ]).to_list(100)
    shares_by_day = {row["_id"]: row["shares"] for row in share_trend_rows}
    trend = [TrendPoint(date=row["_id"], ideas=row["ideas"], shares=shares_by_day.get(row["_id"], 0)) for row in trend_rows]
    return AnalyticsSummary(
        ideas_submitted=ideas_count, sessions=sessions_count, pageviews=pageviews,
        shares=shares_count, gut_checks=gut_checks_count,
        gut_check_accuracy=(matched_count / gut_checks_count if gut_checks_count else None),
        share_click_rate=(shares_count / ideas_count if ideas_count else None),
        trend=trend,
        top_companies=[CompanyFrequency(ticker=row["_id"], mentions=row["mentions"]) for row in top_rows],
    )