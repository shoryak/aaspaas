from typing import Literal

from pydantic import BaseModel, Field

from models.aaspaas import PricePoint

EventKind = Literal["results", "filing", "dividend", "split"]


class MarketEvent(BaseModel):
    date: str
    ticker: str
    company_name: str
    kind: EventKind
    category: str
    summary: str
    url: str | None = None
    source: Literal["NSE", "Yahoo Finance"]


class MarketContextResponse(BaseModel):
    idea_id: str
    benchmark_name: str = "Nifty 50"
    benchmark_points: list[PricePoint] = Field(default_factory=list)
    benchmark_status: Literal["live", "cached", "stale", "unavailable"] = "unavailable"
    events: list[MarketEvent] = Field(default_factory=list)
    events_status: Literal["live", "cached", "partial", "unavailable"] = "unavailable"
    note: str = "Filings and payouts are shown as context near a date. They do not establish why a price moved."
