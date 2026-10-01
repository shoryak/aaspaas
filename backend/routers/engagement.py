import asyncio
import time
import uuid

from fastapi import APIRouter, HTTPException, Query, Request, Response

from lib.db import db
from lib.referral import ensure_share_token
from lib.session import ensure_session, utc_now
from lib.yahoo import get_finance, get_historical
from models.aaspaas import (
    EmailInterestCreate,
    EngagementEventCreate,
    EnrichmentResponse,
    FieldNoteCreate,
    GutCheckCreate,
    GutCheckResponse,
    IdeaResponse,
    JournalItem,
    ProductInterestCreate,
    RecapCreate,
    RecordedResponse,
    ShareCreate,
)

router = APIRouter(tags=["engagement"])


async def _owned_idea(idea_id: str, session_id: str) -> dict:
    idea = await db.ideas.find_one({"id": idea_id, "session_id": session_id})
    if not idea:
        raise HTTPException(status_code=404, detail="Discovery not found in this browser")
    return idea


@router.get("/ideas/{idea_id}", response_model=IdeaResponse)
async def get_idea(idea_id: str, request: Request, response: Response, shared: bool = Query(False)):
    session_id = ensure_session(request, response)
    query = {"id": idea_id} if shared else {"id": idea_id, "session_id": session_id}
    idea = await db.ideas.find_one(query)
    if not idea:
        raise HTTPException(status_code=404, detail="Discovery not found")
    idea.setdefault("discovery_mode", "curated_fallback")
    return IdeaResponse(**idea)


@router.get("/discoveries", response_model=list[JournalItem])
async def list_discoveries(request: Request, response: Response):
    session_id = ensure_session(request, response)
    rows = await db.ideas.find({"session_id": session_id, "is_demo": False}).sort("submitted_at", -1).to_list(30)
    return [JournalItem(
        id=row["id"], observation=row["observation"], submitted_at=row["submitted_at"],
        tickers=row.get("tickers", []), company_names=[item.get("company_name", item.get("ticker", "")) for item in row.get("companies", [])],
        investor_type=row.get("investor_type"), saved_tickers=row.get("saved_tickers", []),
        discovery_mode=row.get("discovery_mode", "curated_fallback"),
    ) for row in rows]


@router.get("/ideas/{idea_id}/companies/{ticker}/enrichment", response_model=EnrichmentResponse)
async def enrich_company(idea_id: str, ticker: str, request: Request, response: Response):
    session_id = ensure_session(request, response)
    idea = await db.ideas.find_one({"id": idea_id})
    if not idea:
        raise HTTPException(status_code=404, detail="Discovery not found")
    company = next((item for item in idea.get("companies", []) if item.get("ticker") == ticker), None)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    started = time.perf_counter()
    finance, historical = await asyncio.gather(
        get_finance(ticker, company["exchange"]), get_historical(ticker, company["exchange"])
    )
    status = "ready" if finance.available and historical.available else "partial"
    latency_ms = round((time.perf_counter() - started) * 1000)
    await db.ideas.update_one(
        {"id": idea_id, "companies.ticker": ticker},
        {"$set": {"companies.$.finance": finance.model_dump(), "companies.$.historical": historical.model_dump(), "companies.$.enrichment_status": status}},
    )
    await db.engagement_events.insert_one({
        "id": str(uuid.uuid4()), "event_name": "enrichment_complete", "idea_id": idea_id,
        "ticker": ticker, "session_id": session_id,
        "properties": {"latency_ms": latency_ms, "finance_status": finance.status, "history_status": historical.status},
        "created_at": utc_now(),
    })
    return EnrichmentResponse(idea_id=idea_id, ticker=ticker, finance=finance, historical=historical, enrichment_status=status, latency_ms=latency_ms)


@router.post("/gut-checks", response_model=GutCheckResponse)
async def record_gut_check(payload: GutCheckCreate, request: Request, response: Response):
    session_id = ensure_session(request, response)
    if not await db.ideas.find_one({"id": payload.idea_id}, {"id": 1}):
        raise HTTPException(status_code=404, detail="Discovery not found")
    await db.gut_checks.insert_one({
        "id": str(uuid.uuid4()), **payload.model_dump(), "session_id": session_id,
        "answered_at": utc_now(), "is_demo": False,
    })
    return GutCheckResponse(recorded=True, matched=payload.matched)


@router.post("/shares", response_model=RecordedResponse)
async def record_share(payload: ShareCreate, request: Request, response: Response):
    session_id = ensure_session(request, response)
    if not await db.ideas.find_one({"id": payload.idea_id}, {"id": 1}):
        raise HTTPException(status_code=404, detail="Discovery not found")
    ref = await ensure_share_token(session_id)
    await db.share_events.insert_one({
        "id": str(uuid.uuid4()), "idea_id": payload.idea_id, "surface": payload.surface, "channel": payload.channel,
        "ref": ref, "session_id": session_id,
        "clicked_at": utc_now(), "is_demo": False,
    })
    return RecordedResponse(recorded=True)


@router.post("/events", response_model=RecordedResponse)
async def record_event(payload: EngagementEventCreate, request: Request, response: Response):
    session_id = ensure_session(request, response)
    await db.engagement_events.insert_one({
        "id": str(uuid.uuid4()), **payload.model_dump(), "session_id": session_id, "created_at": utc_now(),
    })
    return RecordedResponse(recorded=True)


@router.post("/ideas/{idea_id}/field-notes", response_model=RecordedResponse)
async def save_field_note(idea_id: str, payload: FieldNoteCreate, request: Request, response: Response):
    session_id = ensure_session(request, response)
    await _owned_idea(idea_id, session_id)
    operation = {"$addToSet": {"saved_tickers": payload.ticker}} if payload.saved else {"$pull": {"saved_tickers": payload.ticker}}
    await db.ideas.update_one({"id": idea_id}, operation)
    await db.engagement_events.insert_one({
        "id": str(uuid.uuid4()), "event_name": "field_note_saved" if payload.saved else "field_note_removed",
        "idea_id": idea_id, "ticker": payload.ticker, "session_id": session_id, "created_at": utc_now(),
    })
    return RecordedResponse(recorded=True)


@router.post("/ideas/{idea_id}/recap", response_model=RecordedResponse)
async def complete_recap(idea_id: str, payload: RecapCreate, request: Request, response: Response):
    session_id = ensure_session(request, response)
    await _owned_idea(idea_id, session_id)
    now = utc_now()
    await db.ideas.update_one({"id": idea_id}, {"$set": {"investor_type": payload.investor_type, "recap_completed_at": now}})
    await db.engagement_events.insert_one({
        "id": str(uuid.uuid4()), "event_name": "recap_completed", "idea_id": idea_id,
        "session_id": session_id, "properties": payload.model_dump(), "created_at": now,
    })
    return RecordedResponse(recorded=True)


@router.post("/email-interest", response_model=RecordedResponse)
async def capture_email(payload: EmailInterestCreate, request: Request, response: Response):
    if not payload.consent:
        raise HTTPException(status_code=422, detail="Consent is required")
    session_id = ensure_session(request, response)
    await db.email_interests.update_one(
        {"email": str(payload.email).lower(), "session_id": session_id},
        {"$set": {"email": str(payload.email).lower(), "session_id": session_id, "idea_id": payload.idea_id,
                  "capture_location": payload.capture_location, "consent_at": utc_now(), "status": "subscribed"}},
        upsert=True,
    )
    return RecordedResponse(recorded=True)


@router.post("/product-interest", response_model=RecordedResponse)
async def record_product_interest(payload: ProductInterestCreate, request: Request, response: Response):
    session_id = ensure_session(request, response)
    await db.product_interests.insert_one({
        "id": str(uuid.uuid4()), **payload.model_dump(), "session_id": session_id, "created_at": utc_now(),
    })
    await db.engagement_events.insert_one({
        "id": str(uuid.uuid4()), "event_name": f"{payload.kind}_interest_clicked", "idea_id": payload.idea_id,
        "session_id": session_id, "created_at": utc_now(),
    })
    return RecordedResponse(recorded=True)


@router.post("/pageviews", response_model=RecordedResponse)
async def record_pageview(request: Request, response: Response):
    session_id = ensure_session(request, response)
    now = utc_now()
    await db.sessions.update_one(
        {"id": session_id},
        {"$setOnInsert": {"id": session_id, "created_at": now, "is_demo": False}, "$set": {"last_seen_at": now}, "$inc": {"pageviews": 1}},
        upsert=True,
    )
    return RecordedResponse(recorded=True)