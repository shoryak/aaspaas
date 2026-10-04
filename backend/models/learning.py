from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class LessonModule(BaseModel):
    key: str
    number: int
    title: str
    subtitle: str = ""


class Lesson(BaseModel):
    number: int
    slug: str = Field(pattern=r"^[a-z0-9-]{2,60}$")
    module: str
    title: str
    promise: str = ""
    key_idea: str = ""
    paragraphs: list[str] = Field(default_factory=list)
    example: str = ""
    checks: list[str] = Field(default_factory=list)
    metric: str = ""
    duration: str = ""
    youtube_url: str = ""
    reel_url: str = ""
    published: bool = True
    is_tax: bool = False
    last_checked: str = ""


class LearnResponse(BaseModel):
    modules: list[LessonModule]
    lessons: list[Lesson]
    watched: list[str] = Field(default_factory=list)


class SiteVideos(BaseModel):
    landing: str = ""
    friend: str = ""


class TrendingClue(BaseModel):
    id: str
    date: str
    observation: str
    source: str
    source_url: str | None = None
    idea_id: str | None = None
    tickers: list[str] = Field(default_factory=list)
    hidden: bool = False


class TrendingDay(BaseModel):
    date: str
    status: Literal["fresh", "previous", "empty"]
    clues: list[TrendingClue] = Field(default_factory=list)
    archive_dates: list[str] = Field(default_factory=list)


class TrendingPick(BaseModel):
    index: int
    observation: str


class TrendingSkip(BaseModel):
    index: int
    reason: str


class TrendingSelection(BaseModel):
    picks: list[TrendingPick] = Field(default_factory=list)
    skipped: list[TrendingSkip] = Field(default_factory=list)


class TrendingLogItem(BaseModel):
    title: str
    source: str
    picked: bool
    reason: str = ""


class TrendingLogResponse(BaseModel):
    date: str
    items: list[TrendingLogItem] = Field(default_factory=list)
    clues: list[TrendingClue] = Field(default_factory=list)


class AccountResponse(BaseModel):
    signed_in: bool
    email: str | None = None
    updates_opt_in: bool = False


class SignInRequest(BaseModel):
    email: EmailStr
    updates: bool = False
    return_to: str = Field(default="/", max_length=300)
    location: Literal["portfolio", "learn", "header"] = "portfolio"


class SignInRequested(BaseModel):
    sent: bool
    email: str


class CodeVerify(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class Holding(BaseModel):
    id: str
    ticker: str
    exchange: Literal["NSE", "BSE"]
    company_name: str
    sector: str = "Unclassified"
    units: float
    invested: float
    first_bought: str
    note: str
    change_mind: str = ""
    check_back: str | None = None
    price: float | None = None
    value: float | None = None
    gain: float | None = None
    gain_pct: float | None = None
    holding_days: int = 0


class PortfolioPoint(BaseModel):
    date: str
    value: float
    nifty: float


class SectorShare(BaseModel):
    sector: str
    percent: float


class Portfolio(BaseModel):
    id: str
    name: str
    start_cash: float
    cash: float
    value: float
    gain: float
    gain_pct: float
    holdings: list[Holding] = Field(default_factory=list)
    series: list[PortfolioPoint] = Field(default_factory=list)
    sector_mix: list[SectorShare] = Field(default_factory=list)
    due_check_backs: list[str] = Field(default_factory=list)
    created_at: datetime


class PortfolioSummary(BaseModel):
    id: str
    name: str
    holdings: int
    cash: float


class PortfolioList(BaseModel):
    portfolios: list[PortfolioSummary]
    limit: int


class PortfolioName(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class BuyRequest(BaseModel):
    ticker: str = Field(pattern=r"^[A-Za-z0-9&\-]{1,20}$")
    exchange: Literal["NSE", "BSE"]
    company_name: str = Field(max_length=120)
    sector: str = Field(default="Unclassified", max_length=80)
    amount: float = Field(gt=0)
    note: str = Field(min_length=3, max_length=200)
    change_mind: str = Field(default="", max_length=200)
    check_back: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class SellRequest(BaseModel):
    holding_id: str
    fraction: float = Field(gt=0, le=1)


class SellResponse(BaseModel):
    proceeds: float
    short_term_gain: float
    long_term_gain: float
    portfolio: Portfolio


class PartnerMessageCreate(BaseModel):
    conversation_id: str | None = None
    idea_id: str | None = None
    ticker: str = Field(pattern=r"^[A-Za-z0-9&\-]{1,20}$")
    exchange: Literal["NSE", "BSE"]
    company_name: str = Field(max_length=120)
    surface: Literal["detail", "holding", "recap"] = "detail"
    message: str = Field(min_length=3, max_length=600)


class PartnerBias(BaseModel):
    name: str
    why: str


class PartnerReply(BaseModel):
    supported: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    biases: list[PartnerBias] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)
    evidence_to_change: str = ""
    lesson_slug: str = ""
    advice_redirected: bool = False


class PartnerTurn(BaseModel):
    role: Literal["user", "partner"]
    text: str | None = None
    reply: PartnerReply | None = None


class PartnerConversation(BaseModel):
    id: str
    ticker: str
    company_name: str
    turns: list[PartnerTurn] = Field(default_factory=list)
    remaining_today: int
    max_turns: int
