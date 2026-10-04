"""Practice portfolios: ₹1,00,000 of pretend cash, adjusted-close prices, Nifty 50 shadow. No real orders, ever."""
import asyncio
import uuid
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from lib.accounts import require_account
from lib.db import db
from lib.session import utc_now
from lib.yahoo import get_historical
from models.learning import BuyRequest, Holding, Portfolio, PortfolioList, PortfolioName, PortfolioPoint, PortfolioSummary, SectorShare, SellRequest, SellResponse

router = APIRouter(tags=["portfolio"])
START_CASH = 100_000.0
PORTFOLIO_LIMIT = 3
HOLDING_LIMIT = 15


async def _event(name: str, account: dict, **properties) -> None:
    await db.engagement_events.insert_one({"id": str(uuid.uuid4()), "event_name": name, "session_id": account.get("primary_session_id"), "properties": {"account_id": account["id"], **properties}, "created_at": utc_now()})


async def _owned(portfolio_id: str, account: dict) -> dict:
    doc = await db.portfolios.find_one({"id": portfolio_id, "account_id": account["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Practice portfolio not found")
    return doc


def _at(series: dict[str, float], dates: list[str], day: str) -> float | None:
    """Adjusted close on `day`, carrying the last known price forward."""
    if day in series:
        return series[day]
    earlier = [d for d in dates if d <= day]
    return series[earlier[-1]] if earlier else None


async def _view(doc: dict) -> Portfolio:
    keys = {(row["ticker"], row["exchange"]) for row in doc.get("transactions", [])} | {(h["ticker"], h["exchange"]) for h in doc.get("holdings", [])}
    keys = sorted(keys)
    histories, nifty = await asyncio.gather(asyncio.gather(*(get_historical(t, e) for t, e in keys)), get_historical("NIFTY50", "NSE", symbol="^NSEI"))
    prices = {ticker: {p.date: p.adjusted_close for p in history.points} for (ticker, _), history in zip(keys, histories)}
    price_dates = {ticker: sorted(series) for ticker, series in prices.items()}
    today = date.today()
    holdings: list[Holding] = []
    total_value = doc["cash"]
    sectors: dict[str, float] = defaultdict(float)
    for row in doc.get("holdings", []):
        units = sum(lot["units"] for lot in row["lots"])
        invested = sum(lot["units"] * lot["price"] for lot in row["lots"])
        dates = price_dates.get(row["ticker"], [])
        price = prices[row["ticker"]][dates[-1]] if dates else None
        value = units * price if price is not None else None
        total_value += value if value is not None else invested
        sectors[row.get("sector") or "Unclassified"] += value if value is not None else invested
        first = min(lot["date"] for lot in row["lots"])
        holdings.append(Holding(
            id=row["id"], ticker=row["ticker"], exchange=row["exchange"], company_name=row["company_name"], sector=row.get("sector") or "Unclassified",
            units=units, invested=invested, first_bought=first, note=row["note"], change_mind=row.get("change_mind", ""), check_back=row.get("check_back"),
            price=price, value=value, gain=(value - invested) if value is not None else None,
            gain_pct=((value / invested - 1) * 100) if value is not None and invested else None,
            holding_days=(today - date.fromisoformat(first)).days,
        ))
    invested_total = total_value - doc["cash"]
    sector_mix = [SectorShare(sector=name, percent=amount / invested_total * 100) for name, amount in sorted(sectors.items(), key=lambda item: -item[1])] if invested_total > 0 else []
    series: list[PortfolioPoint] = []
    nifty_map = {p.date: p.adjusted_close for p in nifty.points}
    nifty_dates = sorted(nifty_map)
    start = doc["created_at"].date().isoformat()
    timeline = [d for d in nifty_dates if d >= start] or ([nifty_dates[-1]] if nifty_dates else [])
    if timeline:
        txs = sorted(doc.get("transactions", []), key=lambda row: row["date"])
        step = max(1, len(timeline) // 120)
        for day in timeline[::step] + ([timeline[-1]] if (len(timeline) - 1) % step else []):
            cash, shadow_cash, shadow_units, units = doc["start_cash"], doc["start_cash"], 0.0, defaultdict(float)
            for tx in txs:
                if tx["date"] > day:
                    break
                level = _at(nifty_map, nifty_dates, tx["date"])
                sign = 1 if tx["kind"] == "buy" else -1
                cash -= sign * tx["amount"]
                units[tx["ticker"]] += sign * tx["units"]
                if level:
                    shadow_cash -= sign * tx["amount"]
                    shadow_units += sign * tx["amount"] / level
            value = cash + sum(qty * (_at(prices.get(t, {}), price_dates.get(t, []), day) or 0) for t, qty in units.items())
            series.append(PortfolioPoint(date=day, value=round(value, 2), nifty=round(shadow_cash + shadow_units * (_at(nifty_map, nifty_dates, day) or 0), 2)))
    gain = total_value - doc["start_cash"]
    return Portfolio(
        id=doc["id"], name=doc["name"], start_cash=doc["start_cash"], cash=doc["cash"], value=total_value, gain=gain, gain_pct=gain / doc["start_cash"] * 100,
        holdings=holdings, series=series, sector_mix=sector_mix, created_at=doc["created_at"],
        due_check_backs=[h.ticker for h in holdings if h.check_back and h.check_back <= today.isoformat()],
    )


@router.get("/portfolios", response_model=PortfolioList)
async def list_portfolios(account: dict = Depends(require_account)):
    rows = await db.portfolios.find({"account_id": account["id"]}, {"_id": 0}).sort("created_at", 1).to_list(20)
    return PortfolioList(portfolios=[PortfolioSummary(id=r["id"], name=r["name"], holdings=len(r.get("holdings", [])), cash=r["cash"]) for r in rows], limit=PORTFOLIO_LIMIT)


@router.post("/portfolios", response_model=Portfolio)
async def create_portfolio(payload: PortfolioName, account: dict = Depends(require_account)):
    if await db.portfolios.count_documents({"account_id": account["id"]}) >= PORTFOLIO_LIMIT:
        await _event("portfolio_limit_hit", account)
        raise HTTPException(status_code=409, detail={"code": "plus_limit", "message": "More portfolios come with Aaspaas Plus (coming soon)."})
    doc = {"id": str(uuid.uuid4()), "account_id": account["id"], "name": payload.name.strip(), "start_cash": START_CASH, "cash": START_CASH, "holdings": [], "transactions": [], "created_at": utc_now()}
    await db.portfolios.insert_one(dict(doc))
    await _event("portfolio_created", account)
    return await _view(doc)


@router.get("/portfolios/{portfolio_id}", response_model=Portfolio)
async def get_portfolio(portfolio_id: str, account: dict = Depends(require_account)):
    return await _view(await _owned(portfolio_id, account))


@router.patch("/portfolios/{portfolio_id}", response_model=Portfolio)
async def rename_portfolio(portfolio_id: str, payload: PortfolioName, account: dict = Depends(require_account)):
    doc = await _owned(portfolio_id, account)
    await db.portfolios.update_one({"id": portfolio_id}, {"$set": {"name": payload.name.strip()}})
    return await _view({**doc, "name": payload.name.strip()})


@router.delete("/portfolios/{portfolio_id}", response_model=PortfolioList)
async def delete_portfolio(portfolio_id: str, account: dict = Depends(require_account)):
    await _owned(portfolio_id, account)
    await db.portfolios.delete_one({"id": portfolio_id})
    await _event("portfolio_deleted", account)
    return await list_portfolios(account)


@router.post("/portfolios/{portfolio_id}/reset", response_model=Portfolio)
async def reset_portfolio(portfolio_id: str, account: dict = Depends(require_account)):
    doc = await _owned(portfolio_id, account)
    update = {"cash": doc["start_cash"], "holdings": [], "transactions": [], "created_at": utc_now()}
    await db.portfolios.update_one({"id": portfolio_id}, {"$set": update})
    await _event("portfolio_reset", account)
    return await _view({**doc, **update})


@router.post("/portfolios/{portfolio_id}/buy", response_model=Portfolio)
async def buy(portfolio_id: str, payload: BuyRequest, account: dict = Depends(require_account)):
    doc = await _owned(portfolio_id, account)
    ticker = payload.ticker.upper()
    if payload.amount > doc["cash"] + 0.005:
        raise HTTPException(status_code=400, detail="That's more than the pretend cash left in this portfolio.")
    existing = next((h for h in doc["holdings"] if h["ticker"] == ticker), None)
    if not existing and len(doc["holdings"]) >= HOLDING_LIMIT:
        raise HTTPException(status_code=400, detail=f"A practice portfolio holds up to {HOLDING_LIMIT} companies.")
    history = await get_historical(ticker, payload.exchange)
    if not history.available or not history.points:
        raise HTTPException(status_code=503, detail="No recent price is available for this company right now.")
    last = history.points[-1]
    units = payload.amount / last.adjusted_close
    lot = {"date": last.date, "units": units, "price": last.adjusted_close}
    if existing:
        existing["lots"].append(lot)
        existing.update(note=payload.note, change_mind=payload.change_mind or existing.get("change_mind", ""), check_back=payload.check_back or existing.get("check_back"))
    else:
        doc["holdings"].append({"id": str(uuid.uuid4()), "ticker": ticker, "exchange": payload.exchange, "company_name": payload.company_name, "sector": payload.sector,
                                "note": payload.note, "change_mind": payload.change_mind, "check_back": payload.check_back, "lots": [lot]})
    doc["cash"] -= payload.amount
    doc["transactions"].append({"date": last.date, "kind": "buy", "ticker": ticker, "exchange": payload.exchange, "units": units, "amount": payload.amount})
    await db.portfolios.update_one({"id": portfolio_id}, {"$set": {"cash": doc["cash"], "holdings": doc["holdings"], "transactions": doc["transactions"]}})
    await _event("portfolio_holding_added", account, ticker=ticker, holdings=len(doc["holdings"]))
    return await _view(doc)


@router.post("/portfolios/{portfolio_id}/sell", response_model=SellResponse)
async def sell(portfolio_id: str, payload: SellRequest, account: dict = Depends(require_account)):
    doc = await _owned(portfolio_id, account)
    holding = next((h for h in doc["holdings"] if h["id"] == payload.holding_id), None)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    history = await get_historical(holding["ticker"], holding["exchange"])
    if not history.available or not history.points:
        raise HTTPException(status_code=503, detail="No recent price is available for this company right now.")
    last = history.points[-1]
    remaining = sum(lot["units"] for lot in holding["lots"]) * payload.fraction
    sold, short_gain, long_gain, lots = 0.0, 0.0, 0.0, []
    for lot in sorted(holding["lots"], key=lambda item: item["date"]):  # FIFO, like the tax rules
        take = min(lot["units"], remaining)
        if take > 0:
            gain = take * (last.adjusted_close - lot["price"])
            if (date.fromisoformat(last.date) - date.fromisoformat(lot["date"])).days > 365:
                long_gain += gain
            else:
                short_gain += gain
            sold += take
            remaining -= take
        if lot["units"] - take > 1e-9:
            lots.append({**lot, "units": lot["units"] - take})
    proceeds = sold * last.adjusted_close
    doc["holdings"] = [h if h["id"] != holding["id"] else {**h, "lots": lots} for h in doc["holdings"] if h["id"] != holding["id"] or lots]
    doc["cash"] += proceeds
    doc["transactions"].append({"date": last.date, "kind": "sell", "ticker": holding["ticker"], "exchange": holding["exchange"], "units": sold, "amount": proceeds})
    await db.portfolios.update_one({"id": portfolio_id}, {"$set": {"cash": doc["cash"], "holdings": doc["holdings"], "transactions": doc["transactions"]}})
    await _event("portfolio_holding_sold", account, ticker=holding["ticker"], fraction=payload.fraction)
    return SellResponse(proceeds=proceeds, short_term_gain=short_gain, long_term_gain=long_gain, portfolio=await _view(doc))
