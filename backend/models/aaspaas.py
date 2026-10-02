from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class ScoreAxis(BaseModel):
    key: Literal["moat", "capital_allocation", "management", "growth_runway"]
    label: str
    rationale: str  # written lens only; Aaspaas no longer shows AI 1-5 scores


class Peer(BaseModel):
    company_name: str
    ticker: str
    exchange: Literal["NSE", "BSE"]
    reason: str  # AI context: why this is a direct rival


class FinanceData(BaseModel):
    market_cap: float | None = None
    pe_ratio: float | None = None
    roe: float | None = None
    debt_to_equity: float | None = None
    revenue_growth: float | None = None
    operating_margin: float | None = None
    source: str = "Yahoo Finance"
    available: bool = False
    status: Literal["live", "cached", "stale", "unavailable"] = "unavailable"
    fetched_at: datetime | None = None
    note: str = "Live data unavailable right now."


class PricePoint(BaseModel):
    date: str
    close: float
    adjusted_close: float
    volume: float | None = None


class CorporateAction(BaseModel):
    date: str
    type: Literal["dividend", "split", "capital_gain"]
    value: float | None = None
    label: str


class PriceMovement(BaseModel):
    kind: Literal["one_day", "one_month", "drawdown"]
    start_date: str
    end_date: str
    percent: float


class AnnualJourney(BaseModel):
    year: int
    start_adjusted_close: float
    end_adjusted_close: float
    return_percent: float


class HistoricalData(BaseModel):
    available: bool = False
    status: Literal["live", "cached", "stale", "unavailable"] = "unavailable"
    source: str = "Yahoo Finance chart"
    as_of: str | None = None
    period_start: str | None = None
    period_end: str | None = None
    points: list[PricePoint] = Field(default_factory=list)
    corporate_actions: list[CorporateAction] = Field(default_factory=list)
    range_52_week_low: float | None = None
    range_52_week_high: float | None = None
    largest_day: PriceMovement | None = None
    largest_month: PriceMovement | None = None
    max_drawdown: PriceMovement | None = None
    annual_journey: list[AnnualJourney] = Field(default_factory=list)
    note: str = "Five-year price history unavailable right now."


class CompanyInsight(BaseModel):
    id: str
    company_name: str
    ticker: str
    exchange: Literal["NSE", "BSE"]
    sector: str = "Unclassified"
    observation_phrase: str = "Your everyday observation"
    connection_strength: Literal["direct", "enabling", "adjacent"] = "adjacent"
    connection: str
    behavior_change: str = "A behaviour may be changing."
    revenue_driver: str = "The company gets paid when demand reaches its business."
    profit_sensitivity: str = "Volume, price, costs, and capital intensity can change profit."
    market_expectation: str = "Growth, margins, moat, and execution."
    business_model: str
    risk: str
    verify_tip: str
    what_must_be_true: str = "The observed behaviour must translate into material, durable revenue."
    what_breaks_chain: str = "The connection breaks if adoption does not reach this company's economics."
    research_checks: list[str] = Field(default_factory=lambda: [
        "Read the relevant annual-report segment note.",
        "Check management commentary for measurable demand evidence.",
        "Track the metric most likely to disprove the connection.",
    ])
    gut_check_question: str
    gut_check_lean: Literal["yes", "no"]
    revenue_question: str = "Which activity is most likely to drive this company's revenue?"
    revenue_options: list[str] = Field(default_factory=list)
    revenue_answer: str = ""
    scorecard: list[ScoreAxis] = Field(min_length=4, max_length=4)
    peers: list[Peer] | None = None  # None = not looked up yet (older ideas are backfilled on reopen)
    finance: FinanceData = Field(default_factory=FinanceData)
    historical: HistoricalData = Field(default_factory=HistoricalData)
    enrichment_status: Literal["pending", "ready", "partial"] = "pending"


class DiscoveryDraft(BaseModel):
    company_name: str
    ticker: str
    exchange: Literal["NSE", "BSE"]
    sector: str = "Unclassified"
    observation_phrase: str = "Your everyday observation"
    connection_strength: Literal["direct", "enabling", "adjacent"] = "adjacent"
    connection: str
    behavior_change: str = "Customer or business behaviour appears to be changing."
    revenue_driver: str = "The company gets paid when demand reaches its products or services."
    profit_sensitivity: str = "Volume, pricing, costs, and reinvestment can change profit."
    market_expectation: str = "growth, margins, moat, and execution"
    business_model: str
    risk: str
    verify_tip: str
    what_must_be_true: str = "The observed behaviour must translate into material, durable revenue."
    what_breaks_chain: str = "The link breaks if the exposure is too small or competitors capture the demand."
    research_checks: list[str] = Field(default_factory=lambda: ["Read the relevant annual-report segment note.", "Check management commentary for demand evidence.", "Track the metric most likely to disprove the connection."])
    gut_check_question: str
    gut_check_lean: Literal["yes", "no"]
    revenue_question: str = "Which activity is most likely to drive revenue?"
    revenue_options: list[str] = Field(default_factory=lambda: ["Selling products or services", "Stock-market activity", "A fixed grant"])
    revenue_answer: str = "Selling products or services"
    scorecard: list[ScoreAxis] = Field(min_length=4, max_length=4)
    peers: list[Peer] = Field(default_factory=list)


class DiscoveryResponse(BaseModel):
    observation_theme: str = "Everyday business"
    companies: list[DiscoveryDraft] = Field(max_length=4)


class IdeaCreate(BaseModel):
    observation: str = Field(min_length=8, max_length=1200)
    input_mode: Literal["typed", "voice"] = "typed"


class TranscriptionResponse(BaseModel):
    text: str
    language: str | None = None
    remaining: int


class VoiceAllowanceResponse(BaseModel):
    remaining: int
    daily_limit: int
    max_seconds: int
    live: bool = False


class VoicePassResponse(BaseModel):
    token: str
    max_seconds: int


class IdeaResponse(BaseModel):
    id: str
    observation: str
    companies: list[CompanyInsight]
    submitted_at: datetime
    discovery_mode: Literal["ai", "curated_fallback"]
    observation_theme: str = "Everyday business"
    generation_ms: int = 0
    daily_remaining: int = 0
    saved_tickers: list[str] = Field(default_factory=list)
    investor_type: str | None = None
    recap_completed_at: datetime | None = None


class EnrichmentResponse(BaseModel):
    idea_id: str
    ticker: str
    finance: FinanceData
    historical: HistoricalData
    enrichment_status: Literal["ready", "partial"]
    latency_ms: int


class GutCheckCreate(BaseModel):
    idea_id: str
    ticker: str
    question_format: Literal["moat", "business_model", "metric_guess"]
    answer: str | None = Field(default=None, max_length=200)
    skipped: bool = False
    matched: bool | None = None
    metric_distance: float | None = None


class GutCheckResponse(BaseModel):
    recorded: bool
    matched: bool | None = None


class ShareCreate(BaseModel):
    idea_id: str
    surface: Literal["recap", "chart"] = "recap"
    channel: Literal["whatsapp", "x", "copy", "native", "download"] = "native"


class ShareTokenResponse(BaseModel):
    token: str


class RecordedResponse(BaseModel):
    recorded: bool


class EngagementEventCreate(BaseModel):
    event_name: str = Field(min_length=2, max_length=80)
    idea_id: str | None = None
    ticker: str | None = None
    stage: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)


class FieldNoteCreate(BaseModel):
    ticker: str
    saved: bool = True


class RecapCreate(BaseModel):
    investor_type: Literal["Detective", "Contrarian", "Storyteller"]
    matched: int = Field(ge=0)
    attempted: int = Field(ge=0)
    skipped: int = Field(ge=0)


class EmailInterestCreate(BaseModel):
    email: EmailStr
    capture_location: Literal["recap", "limit_wall"]
    idea_id: str | None = None
    consent: bool


class ProductInterestCreate(BaseModel):
    kind: Literal["plus", "broker"]
    idea_id: str | None = None


class JournalItem(BaseModel):
    id: str
    observation: str
    submitted_at: datetime
    tickers: list[str]
    company_names: list[str]
    investor_type: str | None = None
    saved_tickers: list[str] = Field(default_factory=list)
    discovery_mode: Literal["ai", "curated_fallback"]


class AdminLogin(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class AdminLoginResponse(BaseModel):
    authenticated: bool


