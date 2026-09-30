from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class ScoreAxis(BaseModel):
    key: Literal["moat", "capital_allocation", "management", "growth_runway"]
    label: str
    score: int = Field(ge=1, le=5)
    rationale: str


class FinanceData(BaseModel):
    market_cap: float | None = None
    pe_ratio: float | None = None
    roe: float | None = None
    debt_to_equity: float | None = None
    revenue_growth: float | None = None
    source: str = "Yahoo Finance"
    available: bool = False
    note: str = "Live data unavailable right now."


class CompanyInsight(BaseModel):
    id: str
    company_name: str
    ticker: str
    exchange: Literal["NSE", "BSE"]
    connection: str
    business_model: str
    risk: str
    verify_tip: str
    gut_check_question: str
    gut_check_lean: Literal["yes", "no"]
    scorecard: list[ScoreAxis] = Field(min_length=4, max_length=4)
    finance: FinanceData = Field(default_factory=FinanceData)


class DiscoveryDraft(BaseModel):
    company_name: str
    ticker: str
    exchange: Literal["NSE", "BSE"]
    connection: str
    business_model: str
    risk: str
    verify_tip: str
    gut_check_question: str
    gut_check_lean: Literal["yes", "no"]
    scorecard: list[ScoreAxis] = Field(min_length=4, max_length=4)


class DiscoveryResponse(BaseModel):
    companies: list[DiscoveryDraft] = Field(max_length=4)


class IdeaCreate(BaseModel):
    observation: str = Field(min_length=8, max_length=1200)


class IdeaResponse(BaseModel):
    id: str
    observation: str
    companies: list[CompanyInsight]
    submitted_at: datetime
    discovery_mode: Literal["ai", "curated_fallback"]


class GutCheckCreate(BaseModel):
    idea_id: str
    ticker: str
    answer: Literal["yes", "no"]


class GutCheckResponse(BaseModel):
    recorded: bool
    matched: bool


class ShareCreate(BaseModel):
    idea_id: str


class ShareResponse(BaseModel):
    recorded: bool


class PageviewResponse(BaseModel):
    recorded: bool


class AdminLogin(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class AdminLoginResponse(BaseModel):
    authenticated: bool


class TrendPoint(BaseModel):
    date: str
    ideas: int
    shares: int


class CompanyFrequency(BaseModel):
    ticker: str
    mentions: int


class AnalyticsSummary(BaseModel):
    ideas_submitted: int
    sessions: int
    pageviews: int
    shares: int
    gut_checks: int
    gut_check_accuracy: float | None = None
    share_click_rate: float | None = None
    trend: list[TrendPoint]
    top_companies: list[CompanyFrequency]