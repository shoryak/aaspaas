"""Sourced fundamentals for the peer table and the Financials tab (Yahoo Finance only; never estimated)."""
import asyncio
from datetime import date, datetime, timedelta, timezone
import logging
from urllib.parse import quote

import httpx

from lib.db import db
from lib.yahoo import HEADERS, _aware, get_finance, get_historical, yahoo_symbol
from models.fundamentals import CompanyFundamentals, FinancialLine, FinancialPoint

TIMESERIES_TTL = timedelta(hours=12)
TYPES = [
    "annualTotalRevenue", "annualNetIncome", "annualOperatingCashFlow", "annualOperatingIncome", "annualEBIT",
    "annualTotalAssets", "annualCurrentLiabilities", "trailingTotalRevenue", "trailingNetIncome", "trailingOperatingCashFlow",
]
LINES = [("revenue", "Revenue", "TotalRevenue"), ("net_income", "Net income", "NetIncome"), ("operating_cash_flow", "Operating cash flow", "OperatingCashFlow")]
logger = logging.getLogger(__name__)


def _period_label(as_of: str) -> str:
    day = date.fromisoformat(as_of)
    return f"FY{day.year % 100:02d}" if day.month == 3 else day.strftime("%b %y")


async def _timeseries(symbol: str) -> tuple[dict[str, list[tuple[str, float]]], bool]:
    """Annual + trailing statement series keyed by Yahoo type. Returns (series, from_cache)."""
    now = datetime.now(timezone.utc)
    cached = await db.fundamentals_cache.find_one({"symbol": symbol})
    if cached and _aware(cached["expires_at"]) > now:
        return cached["payload"], True
    params = {"type": ",".join(TYPES), "period1": int((now - timedelta(days=366 * 6)).timestamp()), "period2": int(now.timestamp())}
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS, follow_redirects=True) as client:
            response = await client.get(f"https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{quote(symbol)}", params=params)
            response.raise_for_status()
        series: dict[str, list[tuple[str, float]]] = {}
        for result in response.json().get("timeseries", {}).get("result") or []:
            kind = (result.get("meta", {}).get("type") or [None])[0]
            rows = [row for row in result.get(kind) or [] if row and isinstance(row.get("reportedValue", {}).get("raw"), (int, float))]
            if kind and rows:
                series[kind] = sorted((row["asOfDate"], float(row["reportedValue"]["raw"])) for row in rows)
        if series:
            await db.fundamentals_cache.update_one(
                {"symbol": symbol}, {"$set": {"symbol": symbol, "payload": series, "expires_at": now + TIMESERIES_TTL}}, upsert=True
            )
        return series, False
    except Exception as exc:
        logger.warning("Yahoo fundamentals unavailable for %s: %s", symbol, exc)
        return (cached["payload"], True) if cached else ({}, False)


def _price_change_1y(points: list) -> float | None:
    if len(points) < 2:
        return None
    cutoff = (date.fromisoformat(points[-1].date) - timedelta(days=365)).isoformat()
    base = next((point for point in reversed(points) if point.date <= cutoff), None)
    return (points[-1].adjusted_close / base.adjusted_close - 1) * 100 if base else None


def _roce(series: dict[str, list[tuple[str, float]]]) -> float | None:
    operating = series.get("annualOperatingIncome") or series.get("annualEBIT") or []
    if not operating:
        return None
    as_of, profit = operating[-1]
    assets = dict(series.get("annualTotalAssets") or []).get(as_of)
    current = dict(series.get("annualCurrentLiabilities") or []).get(as_of)
    if assets is None or current is None or assets - current <= 0:
        return None
    return profit / (assets - current) * 100


async def get_fundamentals(ticker: str, exchange: str) -> CompanyFundamentals:
    symbol = yahoo_symbol(ticker, exchange)
    finance, (series, from_cache), history = await asyncio.gather(
        get_finance(ticker, exchange), _timeseries(symbol), get_historical(ticker, exchange)
    )
    lines: list[FinancialLine] = []
    for key, label, suffix in LINES:
        annual = [FinancialPoint(label=_period_label(as_of), as_of=as_of, value=value) for as_of, value in (series.get(f"annual{suffix}") or [])[-4:]]
        trailing = series.get(f"trailing{suffix}") or []
        ttm = FinancialPoint(label="TTM", as_of=trailing[-1][0], value=trailing[-1][1]) if trailing and (not annual or trailing[-1][0] > annual[-1].as_of) else None
        lines.append(FinancialLine(key=key, label=label, points=annual, ttm=ttm))
    by_key = {line.key: line for line in lines}
    latest = lambda key: by_key[key].points[-1].value if by_key[key].points else None  # noqa: E731
    available = finance.available or bool(series) or history.available
    if not available:
        status = "unavailable"
    elif finance.available:
        status = finance.status
    else:
        status = "cached" if from_cache else "live"
    return CompanyFundamentals(
        ticker=ticker, exchange=exchange, available=available, status=status,
        market_cap=finance.market_cap, pe_ratio=finance.pe_ratio, roe=finance.roe, roce=_roce(series),
        operating_margin=finance.operating_margin, net_income=latest("net_income"), operating_cash_flow=latest("operating_cash_flow"),
        revenue_growth=finance.revenue_growth, debt_to_equity=finance.debt_to_equity,
        price_change_1y=_price_change_1y(history.points) if history.available else None,
        fiscal_year=by_key["net_income"].points[-1].label if by_key["net_income"].points else None,
        lines=lines,
        note="Yahoo Finance · annual reported figures · may be delayed or incomplete." if available else "Live data unavailable right now.",
    )
