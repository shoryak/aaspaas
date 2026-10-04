import logging
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, Response
from lib.db import db
from lib.ai_cost import ai_cost_usd
from lib.dates import today_iso
from lib.peers import PEER_INSTRUCTION, curated_peers, validate_peers
from lib.vertex import generate_json, vertex_configured
from lib.session import daily_ip_fingerprint, ensure_session, utc_now
from models.aaspaas import (
    CompanyInsight,
    DiscoveryResponse,
    IdeaCreate,
    IdeaResponse,
)

router = APIRouter(tags=["discovery"])
DAILY_LIMIT = 3  # per anonymous visitor
IP_DAILY_LIMIT = int(os.environ.get("IP_DAILY_LIMIT", "30"))  # per network; generous for mobile CGNAT
GLOBAL_DAILY_AI_CAP = int(os.environ.get("GLOBAL_DAILY_AI_CAP", "1500"))  # protects total Vertex spend
logger = logging.getLogger(__name__)


def _fallback_axes() -> list[dict]:
    return [
        {"key": "moat", "label": "Moat & pricing power", "rationale": "Customer switching and pricing still need checking."},
        {"key": "capital_allocation", "label": "Capital allocation discipline", "rationale": "Review reinvestment, dilution, and returns on new capital."},
        {"key": "management", "label": "Management quality", "rationale": "Read disclosures and execution history before forming a view."},
        {"key": "growth_runway", "label": "Growth runway", "rationale": "Category growth may still be offset by competition."},
    ]


def _fallback_discovery(observation: str) -> DiscoveryResponse:
    lower = observation.lower()
    if any(word in lower for word in ("solar", "panel", "renewable")):
        entries = [
            ("Waaree Renewable Technologies", "WAAREERTL", "Renewable energy", "enabling"),
            ("Borosil Renewables", "BORORENEW", "Solar materials", "enabling"),
            ("KPI Green Energy", "KPIGREEN", "Renewable power", "direct"),
        ]
        theme = "Solar adoption"
    elif any(word in lower for word in ("quick commerce", "delivery", "apartment", "grocery")):
        entries = [
            ("Delhivery", "DELHIVERY", "Logistics", "enabling"),
            ("Eternal", "ETERNAL", "Consumer internet", "direct"),
            ("Info Edge", "NAUKRI", "Internet platforms", "adjacent"),
        ]
        theme = "Convenience commerce"
    else:
        entries = [
            ("Delhivery", "DELHIVERY", "Logistics", "enabling"),
            ("Eternal", "ETERNAL", "Consumer internet", "adjacent"),
            ("Info Edge", "NAUKRI", "Internet platforms", "adjacent"),
        ]
        theme = "Everyday business"
    phrase = observation[:90].strip()
    companies = []
    for name, ticker, sector, strength in entries:
        companies.append({
            "company_name": name, "ticker": ticker, "exchange": "NSE", "sector": sector,
            "observation_phrase": phrase, "connection_strength": strength,
            "connection": f"This is a cautious starting hypothesis for: {phrase}.",
            "behavior_change": "People or businesses appear to be changing what they buy or how they buy it.",
            "revenue_driver": f"{name} gets paid when that behaviour reaches its products or services.",
            "profit_sensitivity": "Profit can change with volume, pricing, operating costs, and reinvestment needs.",
            "market_expectation": "whether growth and margins can persist without weakening the moat",
            "business_model": f"{name} earns from products or services linked to the observed activity. The exact revenue exposure needs verification in segment reporting.",
            "risk": "The visible habit may not translate into material revenue for this company.",
            "verify_tip": "Check the latest annual-report segment note and management commentary for a measurable link.",
            "what_must_be_true": "The observed behaviour must reach this company at a meaningful scale and with durable economics.",
            "what_breaks_chain": "The chain breaks if competitors capture the demand or the exposure is too small to matter.",
            "research_checks": ["Read the relevant annual-report segment note.", "Check management commentary for demand evidence.", "Track revenue growth and margins for disconfirming evidence."],
            "gut_check_question": "Could this business raise prices without quickly losing demand?",
            "gut_check_lean": "yes" if strength == "direct" else "no",
            "revenue_question": f"What is the most plausible way {name} gets paid here?",
            "revenue_options": ["Selling products or services tied to demand", "Earning only from stock-market activity", "Receiving a fixed government grant"],
            "revenue_answer": "Selling products or services tied to demand",
            "scorecard": _fallback_axes(),
            "peers": [peer.model_dump() for peer in curated_peers(ticker)],
        })
    return DiscoveryResponse.model_validate({"observation_theme": theme, "companies": companies})


async def _discover(observation: str, idea_id: str) -> tuple[DiscoveryResponse, bool, dict | None]:
    if not vertex_configured():
        return _fallback_discovery(observation), True, None
    system = """You are Aaspaas, an educational Indian equity research guide. Map an everyday observation to genuinely exposed NSE/BSE companies. Never give advice, targets, recommendations, ratings, scores, or financial numbers. Prefer a non-obvious supplier or enabling business when genuine. Distinguish facts from interpretation. Return only valid JSON."""
    prompt = f"""Observation: {observation}
Return one JSON object with observation_theme and exactly 3 companies, or an empty companies list when no honest listed-company link exists. Keep every prose field to one short sentence of at most 22 words. Every company needs:
company_name; ticker without suffix; exchange NSE/BSE; sector; observation_phrase copied from the user's words; connection_strength direct/enabling/adjacent; connection; behavior_change; revenue_driver; profit_sensitivity; market_expectation; business_model (2-3 plain sentences); risk; verify_tip; what_must_be_true; what_breaks_chain; exactly 3 research_checks; gut_check_question (yes/no about moat or pricing power); gut_check_lean yes/no (the answer your written moat lens leans toward); revenue_question; exactly 3 conversational revenue_options; revenue_answer exactly matching one option; scorecard with exactly four written lenses; and {PEER_INSTRUCTION}
Scorecard keys and labels: moat / Moat & pricing power; capital_allocation / Capital allocation discipline; management / Management quality; growth_runway / Growth runway. Each lens has only a one-line written rationale — no score or rating.
Do not invent current or historical numbers. Keep every sentence compact enough for a mobile story."""
    try:
        data, token_usage = await generate_json(system, prompt, DiscoveryResponse)
        return DiscoveryResponse.model_validate(data), False, token_usage
    except Exception as exc:
        logger.warning("Vertex discovery fallback for %s: %s", idea_id, exc)
        return _fallback_discovery(observation), True, None


async def _consume_daily_allowance(request: Request, session_id: str) -> int:
    day = today_iso("UTC")
    fingerprint = daily_ip_fingerprint(request, day)
    session_count = await db.submission_attempts.count_documents({"day": day, "session_id": session_id})
    ip_count = await db.submission_attempts.count_documents({"day": day, "ip_fingerprint": fingerprint})
    reset_at = datetime.combine((utc_now() + timedelta(days=1)).date(), datetime.min.time(), timezone.utc)
    if session_count >= DAILY_LIMIT or ip_count >= IP_DAILY_LIMIT:
        await db.engagement_events.insert_one({
            "id": str(uuid.uuid4()), "event_name": "rate_limit_hit", "session_id": session_id,
            "properties": {"day": day, "scope": "session" if session_count >= DAILY_LIMIT else "network"}, "created_at": utc_now(),
        })
        message = "Today's three discoveries are complete." if session_count >= DAILY_LIMIT else "Your network has used today's shared allowance."
        raise HTTPException(status_code=429, detail={"message": message, "reset_at": reset_at.isoformat(), "daily_limit": DAILY_LIMIT})
    if await db.submission_attempts.count_documents({"day": day}) >= GLOBAL_DAILY_AI_CAP:
        await db.engagement_events.insert_one({
            "id": str(uuid.uuid4()), "event_name": "global_cap_hit", "session_id": session_id,
            "properties": {"day": day, "cap": GLOBAL_DAILY_AI_CAP}, "created_at": utc_now(),
        })
        raise HTTPException(status_code=503, detail={"code": "busy", "message": "Aaspaas is busy today.", "reset_at": reset_at.isoformat()})
    await db.submission_attempts.insert_one({
        "id": str(uuid.uuid4()), "day": day, "session_id": session_id,
        "ip_fingerprint": fingerprint, "created_at": utc_now(),
    })
    return max(DAILY_LIMIT - session_count - 1, 0)


async def build_idea(observation: str, session_id: str, *, input_mode: str = "typed", daily_remaining: int = 0, extra: dict | None = None) -> dict:
    """Run discovery + peer validation and store the idea. Shared by visitor submissions and daily trending clues."""
    started = time.perf_counter()
    idea_id = str(uuid.uuid4())
    discovered, used_fallback, token_usage = await _discover(observation, idea_id)
    drafts = discovered.companies[:4]
    validated = await validate_peers([draft.model_dump() for draft in drafts], [draft.peers for draft in drafts])
    companies = [
        CompanyInsight(id=str(uuid.uuid4()), **{**draft.model_dump(), "peers": validated[index] if validated is not None else None})
        for index, draft in enumerate(drafts)
    ]
    doc = {
        "id": idea_id, "observation": observation, "input_mode": input_mode,
        "companies": [company.model_dump() for company in companies],
        "tickers": [company.ticker for company in companies], "session_id": session_id,
        "submitted_at": utc_now(), "discovery_mode": "curated_fallback" if used_fallback else "ai",
        "observation_theme": discovered.observation_theme, "generation_ms": round((time.perf_counter() - started) * 1000),
        "daily_remaining": daily_remaining, "saved_tickers": [], "is_demo": False,
        **({"ai_usage": token_usage, "ai_cost_usd": ai_cost_usd(token_usage)} if token_usage else {}),
        **(extra or {}),
    }
    await db.ideas.insert_one(dict(doc))
    return doc


@router.post("/ideas", response_model=IdeaResponse)
async def create_idea(payload: IdeaCreate, request: Request, response: Response):
    session_id = ensure_session(request, response)
    daily_remaining = await _consume_daily_allowance(request, session_id)
    doc = await build_idea(payload.observation, session_id, input_mode=payload.input_mode, daily_remaining=daily_remaining)
    idea_id, submitted_at, generation_ms, discovery_mode = doc["id"], doc["submitted_at"], doc["generation_ms"], doc["discovery_mode"]
    discovered_theme = doc["observation_theme"]
    await db.sessions.update_one(
        {"id": session_id},
        {"$setOnInsert": {"id": session_id, "created_at": submitted_at, "is_demo": False}, "$set": {"last_seen_at": submitted_at}},
        upsert=True,
    )
    await db.engagement_events.insert_one({
        "id": str(uuid.uuid4()), "event_name": "idea_created", "idea_id": idea_id,
        "session_id": session_id, "properties": {"generation_ms": generation_ms, "discovery_mode": discovery_mode, "theme": discovered_theme},
        "created_at": submitted_at,
    })
    return IdeaResponse(**doc)