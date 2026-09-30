from collections import defaultdict
from datetime import datetime, timedelta, timezone
import logging
from urllib.parse import quote

import httpx

from lib.db import db
from models.aaspaas import (
    AnnualJourney,
    CorporateAction,
    FinanceData,
    HistoricalData,
    PriceMovement,
    PricePoint,
)

HEADERS = {"User-Agent": "Mozilla/5.0 Aaspaas educational client/1.0", "Accept": "application/json"}
FINANCE_TTL = timedelta(minutes=45)
HISTORY_TTL = timedelta(hours=6)
logger = logging.getLogger(__name__)


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _number(raw: object) -> float | None:
    if isinstance(raw, dict):
        raw = raw.get("raw")
    return float(raw) if isinstance(raw, (int, float)) else None


def _percent(raw: object) -> float | None:
    value = _number(raw)
    return value * 100 if value is not None and abs(value) < 2 else value


def yahoo_symbol(ticker: str, exchange: str) -> str:
    clean = ticker.upper().replace(".NS", "").replace(".BO", "")
    return f"{clean}.{'NS' if exchange == 'NSE' else 'BO'}"


async def get_finance(ticker: str, exchange: str) -> FinanceData:
    symbol = yahoo_symbol(ticker, exchange)
    now = datetime.now(timezone.utc)
    cached = await db.finance_cache.find_one({"symbol": symbol})
    if cached and _aware(cached["expires_at"]) > now:
        data = FinanceData.model_validate(cached["payload"])
        return data.model_copy(update={"status": "cached"})
    try:
        async with httpx.AsyncClient(timeout=9, headers=HEADERS, follow_redirects=True) as client:
            row: dict = {}
            quote_response = await client.get(
                "https://query1.finance.yahoo.com/v7/finance/quote", params={"symbols": symbol}
            )
            if quote_response.is_success:
                results = quote_response.json().get("quoteResponse", {}).get("result", [])
                row = results[0] if results else {}
            detail: dict = {}
            financial: dict = {}
            summary = await client.get(
                f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{quote(symbol)}",
                params={"modules": "summaryDetail,financialData"},
            )
            if summary.is_success:
                results = summary.json().get("quoteSummary", {}).get("result", [])
                if results:
                    detail = results[0].get("summaryDetail", {})
                    financial = results[0].get("financialData", {})
            data = FinanceData(
                market_cap=_number(row.get("marketCap")) or _number(detail.get("marketCap")),
                pe_ratio=_number(row.get("trailingPE")) or _number(detail.get("trailingPE")),
                roe=_percent(row.get("returnOnEquity")) or _percent(financial.get("returnOnEquity")),
                debt_to_equity=_number(row.get("debtToEquity")) or _number(financial.get("debtToEquity")),
                revenue_growth=_percent(row.get("revenueGrowth")) or _percent(financial.get("revenueGrowth")),
                available=bool(row or detail or financial),
                status="live" if row or detail or financial else "unavailable",
                fetched_at=now,
                note="Data may be delayed or incomplete.",
            )
            if data.available:
                await db.finance_cache.update_one(
                    {"symbol": symbol},
                    {"$set": {"symbol": symbol, "payload": data.model_dump(), "expires_at": now + FINANCE_TTL}},
                    upsert=True,
                )
            return data
    except Exception as exc:
        logger.warning("Yahoo finance unavailable for %s: %s", symbol, exc)
        if cached:
            data = FinanceData.model_validate(cached["payload"])
            return data.model_copy(update={"status": "stale", "note": "Showing cached Yahoo Finance data; refresh unavailable."})
        return FinanceData()


def _change(start: float, end: float) -> float:
    return (end / start - 1) * 100


def _historical_stats(points: list[PricePoint]) -> tuple[PriceMovement | None, PriceMovement | None, PriceMovement | None, list[AnnualJourney]]:
    if len(points) < 2:
        return None, None, None, []
    largest_day: PriceMovement | None = None
    for previous, current in zip(points, points[1:]):
        change = _change(previous.adjusted_close, current.adjusted_close)
        if largest_day is None or abs(change) > abs(largest_day.percent):
            largest_day = PriceMovement(kind="one_day", start_date=previous.date, end_date=current.date, percent=change)
    largest_month: PriceMovement | None = None
    for index in range(21, len(points)):
        change = _change(points[index - 21].adjusted_close, points[index].adjusted_close)
        if largest_month is None or abs(change) > abs(largest_month.percent):
            largest_month = PriceMovement(kind="one_month", start_date=points[index - 21].date, end_date=points[index].date, percent=change)
    peak = points[0]
    max_drawdown = PriceMovement(kind="drawdown", start_date=peak.date, end_date=peak.date, percent=0)
    for point in points:
        if point.adjusted_close > peak.adjusted_close:
            peak = point
        drawdown = _change(peak.adjusted_close, point.adjusted_close)
        if drawdown < max_drawdown.percent:
            max_drawdown = PriceMovement(kind="drawdown", start_date=peak.date, end_date=point.date, percent=drawdown)
    years: dict[int, list[PricePoint]] = defaultdict(list)
    for point in points:
        years[int(point.date[:4])].append(point)
    journey = [
        AnnualJourney(
            year=year,
            start_adjusted_close=rows[0].adjusted_close,
            end_adjusted_close=rows[-1].adjusted_close,
            return_percent=_change(rows[0].adjusted_close, rows[-1].adjusted_close),
        )
        for year, rows in sorted(years.items())
    ]
    return largest_day, largest_month, max_drawdown, journey


async def get_historical(ticker: str, exchange: str) -> HistoricalData:
    symbol = yahoo_symbol(ticker, exchange)
    now = datetime.now(timezone.utc)
    cached = await db.historical_cache.find_one({"symbol": symbol})
    if cached and _aware(cached["expires_at"]) > now:
        data = HistoricalData.model_validate(cached["payload"])
        return data.model_copy(update={"status": "cached"})
    end = now.date() + timedelta(days=1)
    start = now.date() - timedelta(days=366 * 5 + 14)
    params = {
        "period1": int(datetime.combine(start, datetime.min.time(), timezone.utc).timestamp()),
        "period2": int(datetime.combine(end, datetime.min.time(), timezone.utc).timestamp()),
        "interval": "1d",
        "includePrePost": "false",
        "events": "div,splits,capitalGains",
        "includeAdjustedClose": "true",
    }
    try:
        async with httpx.AsyncClient(timeout=12, headers=HEADERS, follow_redirects=True) as client:
            response = await client.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol)}", params=params
            )
            response.raise_for_status()
            result = (response.json().get("chart", {}).get("result") or [None])[0]
        if not result or not result.get("timestamp"):
            raise ValueError("No historical data")
        timestamps = result["timestamp"]
        quote_rows = (result.get("indicators", {}).get("quote") or [{}])[0]
        adjusted = (result.get("indicators", {}).get("adjclose") or [{}])[0].get("adjclose", [])
        closes = quote_rows.get("close") or []
        volumes = quote_rows.get("volume") or []
        points: list[PricePoint] = []
        for index, timestamp in enumerate(timestamps):
            close = closes[index] if index < len(closes) else None
            adjusted_close = adjusted[index] if index < len(adjusted) else close
            if not isinstance(close, (int, float)) or not isinstance(adjusted_close, (int, float)) or close <= 0 or adjusted_close <= 0:
                continue
            points.append(PricePoint(
                date=datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat(),
                close=float(close), adjusted_close=float(adjusted_close),
                volume=float(volumes[index]) if index < len(volumes) and isinstance(volumes[index], (int, float)) else None,
            ))
        if not points:
            raise ValueError("No usable prices")
        actions: list[CorporateAction] = []
        event_map = result.get("events", {})
        for key, action_type in (("dividends", "dividend"), ("splits", "split"), ("capitalGains", "capital_gain")):
            for event in (event_map.get(key) or {}).values():
                date = datetime.fromtimestamp(event["date"], timezone.utc).date().isoformat()
                value = _number(event.get("amount")) or _number(event.get("numerator"))
                label = event.get("splitRatio") or (f"₹{value:g}" if value is not None else action_type.replace("_", " ").title())
                actions.append(CorporateAction(date=date, type=action_type, value=value, label=str(label)))
        largest_day, largest_month, max_drawdown, journey = _historical_stats(points)
        last_52 = points[-252:]
        data = HistoricalData(
            available=True, status="live", as_of=points[-1].date,
            period_start=points[0].date, period_end=points[-1].date,
            points=points, corporate_actions=sorted(actions, key=lambda item: item.date),
            range_52_week_low=min(point.adjusted_close for point in last_52),
            range_52_week_high=max(point.adjusted_close for point in last_52),
            largest_day=largest_day, largest_month=largest_month, max_drawdown=max_drawdown,
            annual_journey=journey,
            note="Adjusted close; data may be delayed or incomplete. Price movement does not establish a cause.",
        )
        await db.historical_cache.update_one(
            {"symbol": symbol},
            {"$set": {"symbol": symbol, "payload": data.model_dump(), "expires_at": now + HISTORY_TTL}},
            upsert=True,
        )
        return data
    except Exception as exc:
        logger.warning("Yahoo history unavailable for %s: %s", symbol, exc)
        if cached:
            data = HistoricalData.model_validate(cached["payload"])
            return data.model_copy(update={"status": "stale", "note": "Showing cached adjusted prices; refresh unavailable."})
        return HistoricalData()