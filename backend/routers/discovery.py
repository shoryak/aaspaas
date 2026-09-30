import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, Response
from google import genai
from google.genai import types
from google.oauth2 import service_account

from lib.db import db
from lib.dates import today_iso
from lib.session import daily_ip_fingerprint, ensure_session, utc_now
from models.aaspaas import (
    CompanyInsight,
    DiscoveryResponse,
    IdeaCreate,
    IdeaResponse,
)

router = APIRouter(tags=["discovery"])
DAILY_LIMIT = 3
logger = logging.getLogger(__name__)


def _fallback_axes() -> list[dict]:
    return [
        {"key": "moat", "label": "Moat & pricing power", "score": 3, "rationale": "Customer switching and pricing still need checking."},
        {"key": "capital_allocation", "label": "Capital allocation discipline", "score": 3, "rationale": "Review reinvestment, dilution, and returns on new capital."},
        {"key": "management", "label": "Management quality", "score": 3, "rationale": "Read disclosures and execution history before forming a view."},
        {"key": "growth_runway", "label": "Growth runway", "score": 3, "rationale": "Category growth may still be offset by competition."},
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
        })
    return DiscoveryResponse.model_validate({"observation_theme": theme, "companies": companies})


def _json_from_text(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).replace("```", "").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("LLM did not return JSON")
    return json.loads(cleaned[start : end + 1])


async def _discover(observation: str, idea_id: str) -> tuple[DiscoveryResponse, bool]:
    credentials_json = os.environ.get("GCP_SERVICE_ACCOUNT_JSON")
    project = os.environ.get("GCP_PROJECT_ID")
    if not credentials_json or not project:
        return _fallback_discovery(observation), True
    system = """You are Aaspaas, an educational Indian equity research guide. Map an everyday observation to genuinely exposed NSE/BSE companies. Never give advice, targets, recommendations, or financial numbers. Prefer a non-obvious supplier or enabling business when genuine. Distinguish facts from interpretation. Return only valid JSON."""
    prompt = f"""Observation: {observation}
Return one JSON object with observation_theme and exactly 3 companies, or an empty companies list when no honest listed-company link exists. Keep every prose field to one short sentence of at most 22 words. Every company needs:
company_name; ticker without suffix; exchange NSE/BSE; sector; observation_phrase copied from the user's words; connection_strength direct/enabling/adjacent; connection; behavior_change; revenue_driver; profit_sensitivity; market_expectation; business_model (2-3 plain sentences); risk; verify_tip; what_must_be_true; what_breaks_chain; exactly 3 research_checks; gut_check_question; gut_check_lean yes/no; revenue_question; exactly 3 conversational revenue_options; revenue_answer exactly matching one option; and scorecard with exactly four axes.
Scorecard keys and labels: moat / Moat & pricing power; capital_allocation / Capital allocation discipline; management / Management quality; growth_runway / Growth runway. Each needs score 1-5 and a one-line rationale.
Do not invent current or historical numbers. Keep every sentence compact enough for a mobile story."""
    chunks: list[str] = []
    client = None
    try:
        credentials = service_account.Credentials.from_service_account_info(
            json.loads(credentials_json), scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        client = genai.Client(
            vertexai=True, project=project, location=os.environ.get("VERTEX_LOCATION", "us-central1"),
            credentials=credentials, http_options=types.HttpOptions(api_version="v1"),
        )
        stream = await client.aio.models.generate_content_stream(
            model=os.environ.get("VERTEX_MODEL", "gemini-2.5-flash"), contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system, temperature=0.2, max_output_tokens=12000,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                response_mime_type="application/json", response_schema=DiscoveryResponse,
            ),
        )
        async for chunk in stream:
            if chunk.text:
                chunks.append(chunk.text)
        return DiscoveryResponse.model_validate(_json_from_text("".join(chunks))), False
    except Exception as exc:
        logger.warning("Vertex discovery fallback for %s: %s", idea_id, exc)
        return _fallback_discovery(observation), True
    finally:
        if client is not None:
            await client.aio.aclose()


async def _consume_daily_allowance(request: Request, session_id: str) -> int:
    day = today_iso("UTC")
    fingerprint = daily_ip_fingerprint(request, day)
    session_count = await db.submission_attempts.count_documents({"day": day, "session_id": session_id})
    ip_count = await db.submission_attempts.count_documents({"day": day, "ip_fingerprint": fingerprint})
    if session_count >= DAILY_LIMIT or ip_count >= DAILY_LIMIT:
        reset_at = datetime.combine((utc_now() + timedelta(days=1)).date(), datetime.min.time(), timezone.utc)
        await db.engagement_events.insert_one({
            "id": str(uuid.uuid4()), "event_name": "rate_limit_hit", "session_id": session_id,
            "properties": {"day": day}, "created_at": utc_now(),
        })
        raise HTTPException(status_code=429, detail={"message": "Today's three discoveries are complete.", "reset_at": reset_at.isoformat(), "daily_limit": DAILY_LIMIT})
    await db.submission_attempts.insert_one({
        "id": str(uuid.uuid4()), "day": day, "session_id": session_id,
        "ip_fingerprint": fingerprint, "created_at": utc_now(),
    })
    return DAILY_LIMIT - max(session_count, ip_count) - 1


@router.post("/ideas", response_model=IdeaResponse)
async def create_idea(payload: IdeaCreate, request: Request, response: Response):
    session_id = ensure_session(request, response)
    daily_remaining = await _consume_daily_allowance(request, session_id)
    started = time.perf_counter()
    idea_id = str(uuid.uuid4())
    discovered, used_fallback = await _discover(payload.observation, idea_id)
    companies = [CompanyInsight(id=str(uuid.uuid4()), **draft.model_dump()) for draft in discovered.companies[:4]]
    submitted_at = utc_now()
    generation_ms = round((time.perf_counter() - started) * 1000)
    discovery_mode = "curated_fallback" if used_fallback else "ai"
    doc = {
        "id": idea_id, "observation": payload.observation,
        "companies": [company.model_dump() for company in companies],
        "tickers": [company.ticker for company in companies], "session_id": session_id,
        "submitted_at": submitted_at, "discovery_mode": discovery_mode,
        "observation_theme": discovered.observation_theme, "generation_ms": generation_ms,
        "daily_remaining": daily_remaining, "saved_tickers": [], "is_demo": False,
    }
    await db.ideas.insert_one(doc)
    await db.sessions.update_one(
        {"id": session_id},
        {"$setOnInsert": {"id": session_id, "created_at": submitted_at, "is_demo": False}, "$set": {"last_seen_at": submitted_at}},
        upsert=True,
    )
    await db.engagement_events.insert_one({
        "id": str(uuid.uuid4()), "event_name": "idea_created", "idea_id": idea_id,
        "session_id": session_id, "properties": {"generation_ms": generation_ms, "discovery_mode": discovery_mode, "theme": discovered.observation_theme},
        "created_at": submitted_at,
    })
    return IdeaResponse(**doc)