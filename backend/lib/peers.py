"""Direct listed rivals for each discovered company: named by the AI, kept only when Yahoo resolves them."""
import asyncio
import logging
import re

from lib.vertex import generate_json, vertex_configured
from lib.yahoo import get_finance
from models.aaspaas import Peer
from models.fundamentals import PeerBackfillResponse

logger = logging.getLogger(__name__)
MAX_PEERS = 2
TICKER_RE = re.compile(r"^[A-Z0-9&\-]{1,20}$")
PEER_INSTRUCTION = (
    "peers: 2-3 direct listed competitors on NSE/BSE in the same sector as that company (most direct first), never another company "
    "from this list. Each peer has company_name, ticker without suffix, exchange NSE/BSE, and reason (one plain line of at most 14 words "
    "on why it is a direct rival, e.g. 'also sells packaged snacks through kirana stores'). Use an empty peers list when no genuine listed rival exists."
)
SYSTEM = "You are Aaspaas, an educational Indian equity research guide. Name only real, currently listed NSE/BSE companies. Never give advice or numbers. Return only valid JSON."

# Curated rivals for the curated fallback companies (used when live AI is unavailable).
CURATED_PEERS: dict[str, list[tuple[str, str, str]]] = {
    "DELHIVERY": [("Blue Dart Express", "BLUEDART", "also runs express parcel delivery across India"), ("TCI Express", "TCIEXP", "also moves time-sensitive parcels for businesses")],
    "ETERNAL": [("Swiggy", "SWIGGY", "also runs food delivery and quick-commerce apps")],
    "NAUKRI": [("Just Dial", "JUSTDIAL", "also earns from online listings and classifieds"), ("IndiaMART InterMESH", "INDIAMART", "also runs a paid online classifieds marketplace")],
    "WAAREERTL": [("Sterling and Wilson Renewable Energy", "SWSOLAR", "also builds solar plants for other owners")],
    "KPIGREEN": [("Adani Green Energy", "ADANIGREEN", "also sells renewable power from its own plants"), ("NTPC Green Energy", "NTPCGREEN", "also develops and sells solar and wind power")],
}


def clean_ticker(raw: str) -> str:
    return raw.strip().upper().removesuffix(".NS").removesuffix(".BO")


def curated_peers(ticker: str) -> list[Peer]:
    return [Peer(company_name=name, ticker=symbol, exchange="NSE", reason=reason) for name, symbol, reason in CURATED_PEERS.get(ticker.upper(), [])]


async def validate_peers(companies: list[dict], proposed: list[list[Peer]]) -> list[list[Peer]] | None:
    """Drop peers Yahoo can't resolve and any repeat of a company already in the table. None = Yahoo unreachable, retry later."""
    seen = {clean_ticker(company["ticker"]) for company in companies}
    candidates: list[tuple[int, Peer]] = []
    for index, peers in enumerate(proposed):
        for peer in peers:
            ticker = clean_ticker(peer.ticker)
            if not TICKER_RE.match(ticker) or ticker in seen:
                continue
            seen.add(ticker)
            candidates.append((index, peer.model_copy(update={"ticker": ticker})))
    results = await asyncio.gather(*(get_finance(peer.ticker, peer.exchange) for _, peer in candidates))
    if candidates and not any(result.available for result in results):
        probe = await get_finance(companies[0]["ticker"], companies[0]["exchange"]) if companies else None
        if not probe or not probe.available:
            return None
    validated: list[list[Peer]] = [[] for _ in proposed]
    for (index, peer), finance in zip(candidates, results):
        if finance.available and finance.market_cap and len(validated[index]) < MAX_PEERS:
            validated[index].append(peer)
    return validated


async def find_peers(companies: list[dict], use_ai: bool) -> tuple[list[list[Peer]], dict | None]:
    """Backfill for ideas saved before peers existed. Raises if the AI call fails."""
    if not use_ai or not vertex_configured():
        return [curated_peers(company["ticker"]) for company in companies], None
    listing = "\n".join(f"- {company['company_name']} ({company['exchange']}: {company['ticker']}, sector: {company.get('sector', 'Unclassified')})" for company in companies)
    prompt = f"""Companies:\n{listing}\nReturn one JSON object with groups: one entry per company with its ticker exactly as given and {PEER_INSTRUCTION}"""
    data, usage = await generate_json(SYSTEM, prompt, PeerBackfillResponse, max_output_tokens=3000)
    by_ticker = {clean_ticker(group.ticker): group.peers for group in PeerBackfillResponse.model_validate(data).groups}
    return [by_ticker.get(clean_ticker(company["ticker"]), []) for company in companies], usage
