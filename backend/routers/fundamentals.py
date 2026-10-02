import logging

from fastapi import APIRouter, HTTPException, Path

from lib.ai_cost import ai_cost_usd
from lib.db import db
from lib.fundamentals import get_fundamentals
from lib.peers import find_peers, validate_peers
from models.aaspaas import Peer
from models.fundamentals import CompanyFundamentals, PeerGroup, PeerGroupsResponse

router = APIRouter(tags=["fundamentals"])
logger = logging.getLogger(__name__)
TICKER_PATTERN = r"^[A-Za-z0-9&\-]{1,20}$"


@router.get("/companies/{exchange}/{ticker}/fundamentals", response_model=CompanyFundamentals)
async def company_fundamentals(exchange: str = Path(pattern="^(NSE|BSE)$"), ticker: str = Path(pattern=TICKER_PATTERN)):
    return await get_fundamentals(ticker.upper(), exchange)


@router.get("/ideas/{idea_id}/peers", response_model=PeerGroupsResponse)
async def idea_peers(idea_id: str):
    idea = await db.ideas.find_one({"id": idea_id})
    if not idea:
        raise HTTPException(status_code=404, detail="Discovery not found")
    companies = idea.get("companies", [])
    status = "ready"
    if companies and any(company.get("peers") is None for company in companies):
        # Older ideas: find rivals once, then store them. Never counts against the daily discovery allowance.
        try:
            proposed, usage = await find_peers(companies, use_ai=idea.get("discovery_mode") == "ai")
            validated = await validate_peers(companies, proposed)
        except Exception as exc:
            logger.warning("Peer backfill failed for %s: %s", idea_id, exc)
            validated, usage = None, None
        if validated is None:
            status = "unavailable"
        else:
            update = {f"companies.{index}.peers": [peer.model_dump() for peer in peers] for index, peers in enumerate(validated)}
            await db.ideas.update_one({"id": idea_id}, {"$set": update, **({"$inc": {"ai_cost_usd": ai_cost_usd(usage)}} if usage else {})})
            for company, peers in zip(companies, validated):
                company["peers"] = [peer.model_dump() for peer in peers]
    groups = [PeerGroup(ticker=company["ticker"], peers=[Peer(**peer) for peer in company.get("peers") or []]) for company in companies]
    return PeerGroupsResponse(idea_id=idea_id, status=status, groups=groups)

