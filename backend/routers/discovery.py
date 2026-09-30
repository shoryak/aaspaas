import asyncio
import hashlib
import json
import os
import re
import uuid
from datetime import datetime, timezone

import httpx
from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
from fastapi import APIRouter, HTTPException, Request, Response

from lib.db import db
from models.aaspaas import (
    CompanyInsight,
    DiscoveryResponse,
    FinanceData,
    GutCheckCreate,
    GutCheckResponse,
    IdeaCreate,
    IdeaResponse,
    ShareCreate,
    ShareResponse,
)

router = APIRouter(tags=["discovery"])
SESSION_COOKIE = "aaspaas_session"


def _fallback_axes() -> list[dict]:
    return [
        {"key": "moat", "label": "Moat & pricing power", "score": 3, "rationale": "A useful first hypothesis, but customer switching and pricing need checking."},
        {"key": "capital_allocation", "label": "Capital allocation discipline", "score": 3, "rationale": "Look at reinvestment, dilution, and returns on new capital."},
        {"key": "management", "label": "Management quality", "score": 3, "rationale": "Read disclosures and execution history before forming a view."},
        {"key": "growth_runway", "label": "Growth runway", "score": 3, "rationale": "The category can grow, but competition may compress the opportunity."},
    ]


def _fallback_discovery(observation: str) -> DiscoveryResponse:
    lower = observation.lower()
    if any(word in lower for word in ("solar", "panel", "renewable")):
        entries = [
            ("Waaree Renewables", "WAAREEREN", "NSE", "Makes and operates solar power assets and earns from the equipment and energy ecosystem around new installations."),
            ("Borosil Renewables", "BORORENEW", "NSE", "Manufactures specialised solar glass, a less visible component that helps panels generate electricity."),
            ("KPI Green Energy", "KPIGREEN", "NSE", "Builds and operates renewable power projects, earning from selling generated electricity and project development."),
        ]
    elif any(word in lower for word in ("quick commerce", "delivery", "apartment lobby", "grocery")):
        entries = [
            ("Delhivery", "DELHIVERY", "NSE", "Runs logistics infrastructure for shipments, including the fulfilment and last-mile layer behind many digital orders."),
            ("Eternal", "ETERNAL", "NSE", "Operates consumer internet businesses including a food and quick-commerce marketplace, earning from transactions and services."),
            ("Vishnu Prakash", "VPRPL", "NSE", "Builds water and infrastructure projects; a reminder to verify whether the visible delivery habit really reaches this supplier layer."),
        ]
    elif any(word in lower for word in ("wedding", "invite", "matrimony", "marriage")):
        entries = [
            ("Matrimony.com", "MATRIMONY", "NSE", "Runs online matchmaking platforms and earns through paid memberships and related marriage-service offerings."),
            ("Info Edge", "NAUKRI", "NSE", "Owns digital classified and matchmaking assets; verify the exact contribution of its marriage platform rather than assuming the invite site is listed."),
            ("Nazara Technologies", "NAZARA", "NSE", "Builds and distributes digital consumer products; this is an adjacent platform hypothesis that needs especially careful verification."),
        ]
    else:
        entries = [
            ("Delhivery", "DELHIVERY", "NSE", "Runs logistics infrastructure for digital commerce, earning from moving, sorting, and delivering shipments."),
            ("Eternal", "ETERNAL", "NSE", "Operates consumer internet marketplaces and earns from transactions, services, and fulfilment layers."),
            ("Info Edge", "NAUKRI", "NSE", "Operates digital platforms and earns from paid listings, recruitment, and other online services."),
        ]
    drafts = []
    for name, ticker, exchange, model in entries:
        drafts.append({
            "company_name": name,
            "ticker": ticker,
            "exchange": exchange,
            "connection": f"This is a cautious starting hypothesis for the observation: {observation}.",
            "business_model": model,
            "risk": "The visible habit may not translate into material revenue for this company, so do not treat the connection as proof.",
            "verify_tip": "Check the latest annual report segment note, revenue growth, and management commentary for a measurable link.",
            "gut_check_question": "Does this company have enough customer or distribution advantage to raise prices without losing demand?",
            "gut_check_lean": "yes" if name in ("Delhivery", "Matrimony.com", "Borosil Renewables") else "no",
            "scorecard": _fallback_axes(),
        })
    return DiscoveryResponse.model_validate({"companies": drafts})


def _session_id(request: Request, response: Response) -> str:
    session_id = request.cookies.get(SESSION_COOKIE)
    if session_id:
        return session_id
    session_id = str(uuid.uuid4())
    response.set_cookie(SESSION_COOKIE, session_id, httponly=True, samesite="lax", max_age=31536000)
    return session_id


def _value(raw: object) -> float | None:
    if isinstance(raw, dict):
        raw = raw.get("raw")
    return float(raw) if isinstance(raw, (int, float)) else None


def _percent_value(raw: object) -> float | None:
    value = _value(raw)
    return value * 100 if value is not None and abs(value) < 2 else value


async def _fetch_finance(ticker: str, exchange: str) -> FinanceData:
    symbol = f"{ticker.upper().replace('.NS', '').replace('.BO', '')}.{ 'NS' if exchange == 'NSE' else 'BO' }"
    headers = {"User-Agent": "Mozilla/5.0 Aaspaas/1.0", "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=8, headers=headers, follow_redirects=True) as client:
            response = await client.get("https://query1.finance.yahoo.com/v7/finance/quote", params={"symbols": symbol})
            if response.is_success:
                results = response.json().get("quoteResponse", {}).get("result", [])
                if results:
                    row = results[0]
                    return FinanceData(
                        market_cap=_value(row.get("marketCap")),
                        pe_ratio=_value(row.get("trailingPE")),
                        roe=_percent_value(row.get("returnOnEquity")),
                        debt_to_equity=_value(row.get("debtToEquity")),
                        revenue_growth=_percent_value(row.get("revenueGrowth")),
                        available=any(row.get(key) is not None for key in ("marketCap", "trailingPE", "returnOnEquity")),
                        note="Data may be delayed or incomplete.",
                    )

            summary = await client.get(
                f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}",
                params={"modules": "summaryDetail,financialData"},
            )
            if summary.is_success:
                result = summary.json().get("quoteSummary", {}).get("result", [])
                if result:
                    data = result[0]
                    detail = data.get("summaryDetail", {})
                    financial = data.get("financialData", {})
                    return FinanceData(
                        market_cap=_value(detail.get("marketCap")),
                        pe_ratio=_value(detail.get("trailingPE")),
                        roe=_percent_value(financial.get("returnOnEquity")),
                        debt_to_equity=_value(financial.get("debtToEquity")),
                        revenue_growth=_percent_value(financial.get("revenueGrowth")),
                        available=True,
                        note="Data may be delayed or incomplete.",
                    )
    except Exception:
        pass
    return FinanceData()


def _json_from_text(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).replace("```", "").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("LLM did not return a JSON object")
    return json.loads(cleaned[start : end + 1])


async def _discover(observation: str, idea_id: str) -> tuple[DiscoveryResponse, bool]:
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return _fallback_discovery(observation), True
    system_message = """You are Aaspaas, an educational Indian equity research guide. Follow the user's observation to real companies listed on NSE or BSE. Never give buy/sell advice, price targets, or invented financial numbers. Prefer a non-obvious supplier, platform, or ancillary company when it is genuinely exposed. If no real listed company maps, return an empty companies array. Return ONLY valid JSON matching the requested schema."""
    prompt = f"""Observation from a reader: {observation}

Identify 3 or 4 genuinely exposed Indian listed companies, or zero if the observation does not map honestly. Use ordinary NSE/BSE tickers without .NS/.BO suffixes. Each company must include:
- company_name, ticker, exchange (NSE or BSE)
- connection: exactly one sentence connecting it to the observation
- business_model: 2 or 3 plain-language sentences explaining how it makes money
- risk: one honest sentence about where this idea could be wrong
- verify_tip: one sentence naming a real number or filing to check yourself
- gut_check_question: one yes/no question about moat or pricing power
- gut_check_lean: yes or no, the answer your own moat read leans toward
- scorecard: exactly these four axes, each score 1-5 and a one-line rationale: moat, capital_allocation, management, growth_runway

JSON shape: {{"companies":[{{"company_name":"...","ticker":"...","exchange":"NSE","connection":"...","business_model":"...","risk":"...","verify_tip":"...","gut_check_question":"...","gut_check_lean":"yes","scorecard":[{{"key":"moat","label":"Moat & pricing power","score":1,"rationale":"..."}},{{"key":"capital_allocation","label":"Capital allocation discipline","score":1,"rationale":"..."}},{{"key":"management","label":"Management quality","score":1,"rationale":"..."}},{{"key":"growth_runway","label":"Growth runway","score":1,"rationale":"..."}}]}}]}}"""
    chat = LlmChat(api_key=api_key, session_id=f"aaspaas-{idea_id}", system_message=system_message).with_model("openai", "gpt-5.4")
    chunks: list[str] = []
    try:
        async for event in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(event, TextDelta):
                chunks.append(event.content)
            elif isinstance(event, StreamDone):
                break
    except Exception:
        return _fallback_discovery(observation), True
    try:
        return DiscoveryResponse.model_validate(_json_from_text("".join(chunks))), False
    except Exception:
        return _fallback_discovery(observation), True


@router.post("/ideas", response_model=IdeaResponse)
async def create_idea(payload: IdeaCreate, request: Request, response: Response):
    idea_id = str(uuid.uuid4())
    session_id = _session_id(request, response)
    discovered, used_fallback = await _discover(payload.observation, idea_id)
    drafts = discovered.companies[:4]
    finance = await asyncio.gather(*[_fetch_finance(item.ticker, item.exchange) for item in drafts])
    companies = [
        CompanyInsight(id=str(uuid.uuid4()), **draft.model_dump(), finance=finance[index])
        for index, draft in enumerate(drafts)
    ]
    submitted_at = datetime.now(timezone.utc)
    doc = {
        "id": idea_id,
        "observation": payload.observation,
        "companies": [company.model_dump() for company in companies],
        "tickers": [company.ticker for company in companies],
        "session_id": session_id,
        "submitted_at": submitted_at,
        "is_demo": False,
    }
    await db.ideas.insert_one(doc)
    await db.sessions.update_one(
        {"id": session_id},
        {"$setOnInsert": {"id": session_id, "created_at": submitted_at, "is_demo": False}, "$set": {"last_seen_at": submitted_at}},
        upsert=True,
    )
    return IdeaResponse(id=idea_id, observation=payload.observation, companies=companies, submitted_at=submitted_at, discovery_mode="curated_fallback" if used_fallback else "ai")


@router.post("/gut-checks", response_model=GutCheckResponse)
async def record_gut_check(payload: GutCheckCreate, request: Request, response: Response):
    session_id = _session_id(request, response)
    idea = await db.ideas.find_one({"id": payload.idea_id})
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    company = next((item for item in idea.get("companies", []) if item.get("ticker") == payload.ticker), None)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    matched = payload.answer == company.get("gut_check_lean")
    await db.gut_checks.insert_one({
        "id": str(uuid.uuid4()), "idea_id": payload.idea_id, "session_id": session_id,
        "ticker": payload.ticker, "answer": payload.answer, "matched": matched,
        "answered_at": datetime.now(timezone.utc), "is_demo": False,
    })
    return GutCheckResponse(recorded=True, matched=matched)


@router.post("/shares", response_model=ShareResponse)
async def record_share(payload: ShareCreate, request: Request, response: Response):
    session_id = _session_id(request, response)
    if not await db.ideas.find_one({"id": payload.idea_id}, {"id": 1}):
        raise HTTPException(status_code=404, detail="Idea not found")
    await db.share_events.insert_one({
        "id": str(uuid.uuid4()), "idea_id": payload.idea_id, "session_id": session_id,
        "clicked_at": datetime.now(timezone.utc), "is_demo": False,
    })
    return ShareResponse(recorded=True)


@router.post("/pageviews", response_model=dict)
async def record_pageview(request: Request, response: Response):
    session_id = _session_id(request, response)
    now = datetime.now(timezone.utc)
    await db.sessions.update_one(
        {"id": session_id},
        {"$setOnInsert": {"id": session_id, "created_at": now, "is_demo": False}, "$set": {"last_seen_at": now}, "$inc": {"pageviews": 1}},
        upsert=True,
    )
    return {"recorded": True}