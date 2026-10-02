from typing import Literal

from pydantic import BaseModel, Field

from models.aaspaas import Peer


class FinancialPoint(BaseModel):
    label: str  # "FY25", "Dec 24" or "TTM"
    as_of: str
    value: float


class FinancialLine(BaseModel):
    key: Literal["revenue", "net_income", "operating_cash_flow"]
    label: str
    points: list[FinancialPoint] = Field(default_factory=list)  # oldest → newest annual figures
    ttm: FinancialPoint | None = None


class CompanyFundamentals(BaseModel):
    ticker: str
    exchange: Literal["NSE", "BSE"]
    available: bool = False
    status: Literal["live", "cached", "stale", "unavailable"] = "unavailable"
    market_cap: float | None = None
    pe_ratio: float | None = None
    roe: float | None = None
    roce: float | None = None  # calculated: operating income ÷ (total assets − current liabilities)
    operating_margin: float | None = None
    net_income: float | None = None  # latest fiscal year, INR
    operating_cash_flow: float | None = None  # latest fiscal year, INR
    revenue_growth: float | None = None
    debt_to_equity: float | None = None  # Yahoo reports this as a percentage
    price_change_1y: float | None = None  # adjusted close
    fiscal_year: str | None = None
    lines: list[FinancialLine] = Field(default_factory=list)
    source: str = "Yahoo Finance"
    note: str = "Live data unavailable right now."


class PeerGroup(BaseModel):
    ticker: str
    peers: list[Peer] = Field(default_factory=list)


class PeerGroupsResponse(BaseModel):
    idea_id: str
    status: Literal["ready", "unavailable"]
    groups: list[PeerGroup] = Field(default_factory=list)


class PeerBackfillResponse(BaseModel):
    groups: list[PeerGroup] = Field(default_factory=list)
