"""AI thinking partner: questions the reader's reasoning using only Aaspaas's sourced data. Never advises."""
import json
import os
import uuid

from fastapi import APIRouter, HTTPException, Request, Response

from lib.ai_cost import ai_cost_usd
from lib.dates import today_iso
from lib.db import db
from lib.fundamentals import get_fundamentals
from lib.session import ensure_session, utc_now
from lib.vertex import generate_json
from models.learning import PartnerConversation, PartnerMessageCreate, PartnerReply, PartnerTurn

router = APIRouter(tags=["partner"])
DAILY_LIMIT = 10
MAX_TURNS = 6
GLOBAL_CAP = int(os.environ.get("PARTNER_GLOBAL_DAILY_CAP", "2000"))
LESSONS = "revenue-vs-profit, margins, cash-flow, balance-sheet, roce, roe, debt, moat, management, quality-of-growth, tax-on-shares, sip"
SYSTEM = f"""You are Aaspaas's thinking partner, an educational reasoning coach for Indian retail learners. You are NOT a chartered accountant, adviser or analyst and never say you are.
Hard rules: never say buy, sell or hold; never give price targets, position sizes, allocations, timing or predictions; never rank companies. If asked whether to buy/sell, set advice_redirected true, say you can't advise, and turn it into the reader's own checklist questions.
Use ONLY the sourced figures supplied (label them 'Yahoo data'). Never invent numbers; if a figure is missing, say it is unavailable.
Reply in four parts: supported (what the supplied numbers support, each citing the figure), assumptions (what the reader takes on trust), biases (name + why: familiarity, recency, anchoring on share price, confirmation, fear of missing out, or none), questions (2-3 next questions) plus evidence_to_change. lesson_slug: one of [{LESSONS}] or empty. Keep each item under 30 words. Return only JSON."""


def _facts(f) -> dict:
    keys = ("market_cap", "pe_ratio", "roe", "roce", "operating_margin", "net_income", "operating_cash_flow", "revenue_growth", "debt_to_equity", "price_change_1y")
    crore = {"market_cap", "net_income", "operating_cash_flow"}
    out = {(f"{k}_inr_crore" if k in crore else k): round(getattr(f, k) / (1e7 if k in crore else 1), 2) for k in keys if getattr(f, k) is not None}
    if "debt_to_equity" in out:
        out["debt_to_equity"] = round(out["debt_to_equity"] / 100, 2)  # Yahoo reports a percentage
    out["annual_lines"] = {line.key: [(p.label, round(p.value / 1e7)) for p in line.points] for line in f.lines}  # ₹ crore
    return out


@router.get("/partner/conversations", response_model=list[PartnerConversation])
async def conversations(request: Request, response: Response):
    session_id = ensure_session(request, response)
    used = await db.partner_usage.count_documents({"session_id": session_id, "day": today_iso("Asia/Kolkata")})
    rows = await db.partner_chats.find({"session_id": session_id}, {"_id": 0}).sort("updated_at", -1).to_list(20)
    return [PartnerConversation(**row, remaining_today=max(DAILY_LIMIT - used, 0), max_turns=MAX_TURNS) for row in rows]


@router.post("/partner/messages", response_model=PartnerConversation)
async def send_message(payload: PartnerMessageCreate, request: Request, response: Response):
    session_id = ensure_session(request, response)
    day = today_iso("Asia/Kolkata")
    used = await db.partner_usage.count_documents({"session_id": session_id, "day": day})
    if used >= DAILY_LIMIT:
        raise HTTPException(status_code=429, detail={"code": "partner_limit", "message": "That's today's 10 thinking-partner messages. Come back tomorrow."})
    if await db.partner_usage.count_documents({"day": day}) >= GLOBAL_CAP:
        raise HTTPException(status_code=503, detail={"code": "busy", "message": "The thinking partner is resting for today. Come back tomorrow."})
    chat = await db.partner_chats.find_one({"id": payload.conversation_id, "session_id": session_id}, {"_id": 0}) if payload.conversation_id else None
    if chat and sum(1 for turn in chat["turns"] if turn["role"] == "user") >= MAX_TURNS:
        raise HTTPException(status_code=400, detail="This conversation has reached 6 turns. Start a fresh one.")
    ticker = payload.ticker.upper()
    facts = await get_fundamentals(ticker, payload.exchange)
    company = {}
    if payload.idea_id:
        idea = await db.ideas.find_one({"id": payload.idea_id}, {"companies": 1})
        company = next((c for c in (idea or {}).get("companies", []) if c.get("ticker") == ticker), {}) or {}
    context = {
        "company": payload.company_name, "ticker": ticker, "sourced_yahoo_data": _facts(facts) if facts.available else "unavailable",
        "business_model": company.get("business_model"), "known_risk": company.get("risk"),
        "rivals": [p.get("company_name") for p in company.get("peers") or []],
    }
    history = [{"role": t["role"], "text": t.get("text") or json.dumps(t.get("reply"))} for t in (chat or {}).get("turns", [])][-8:]
    prompt = f"Context (sourced; numbers in INR, annual lines in ₹ crore): {json.dumps(context, default=str)}\nConversation so far: {json.dumps(history)}\nReader's latest message: {payload.message}"
    try:
        data, usage = await generate_json(SYSTEM, prompt, PartnerReply, max_output_tokens=1500)
        reply = PartnerReply.model_validate(data)
    except Exception:
        raise HTTPException(status_code=503, detail={"code": "unavailable", "message": "The thinking partner is unavailable right now. Try again shortly."})
    now = utc_now()
    turns = [*(chat or {}).get("turns", []), PartnerTurn(role="user", text=payload.message).model_dump(), PartnerTurn(role="partner", reply=reply).model_dump()]
    cost = ai_cost_usd(usage)
    if chat:
        await db.partner_chats.update_one({"id": chat["id"]}, {"$set": {"turns": turns, "updated_at": now}, "$inc": {"ai_cost_usd": cost}})
        chat_id = chat["id"]
    else:
        chat_id = str(uuid.uuid4())
        await db.partner_chats.insert_one({"id": chat_id, "session_id": session_id, "idea_id": payload.idea_id, "ticker": ticker, "exchange": payload.exchange, "company_name": payload.company_name, "surface": payload.surface, "turns": turns, "created_at": now, "updated_at": now, "ai_cost_usd": cost})
    await db.partner_usage.insert_one({"day": day, "session_id": session_id, "conversation_id": chat_id, "redirected": reply.advice_redirected, "cost_usd": cost, "created_at": now})
    return PartnerConversation(id=chat_id, ticker=ticker, company_name=payload.company_name, turns=[PartnerTurn(**t) for t in turns], remaining_today=max(DAILY_LIMIT - used - 1, 0), max_turns=MAX_TURNS)
