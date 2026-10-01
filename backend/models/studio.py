from datetime import datetime

from pydantic import BaseModel


class StudioMetric(BaseModel):
    key: str
    label: str
    display: str
    value: float | None = None
    hint: str = ""


class StudioFunnelStep(BaseModel):
    key: str
    label: str
    count: int


class ChannelRow(BaseModel):
    channel: str
    shares: int
    opens: int
    new_visitors: int
    activated: int
    conversion: float | None = None


class PlatformRow(BaseModel):
    platform: str
    fetches: int


class GenerationRow(BaseModel):
    generation: str
    visitors: int


class SpreadingIdea(BaseModel):
    idea_id: str
    observation: str
    tickers: list[str]
    shares: int
    opens: int
    new_visitors: int
    activated: int


class AcquisitionPoint(BaseModel):
    date: str
    direct: int
    referred: int
    ideas: int
    shares: int


class PowerUser(BaseModel):
    label: str
    ideas: int
    shares: int
    limit_hits: int
    referred_visitors: int
    last_seen: str | None = None


class TickerCount(BaseModel):
    ticker: str
    mentions: int


class StudioSummary(BaseModel):
    range_days: int
    generated_at: datetime
    headline: list[StudioMetric]
    viral_funnel: list[StudioFunnelStep]
    channels: list[ChannelRow]
    preview_platforms: list[PlatformRow]
    viral_cycle: StudioMetric
    chain_max_depth: int
    generations: list[GenerationRow]
    top_spreading: list[SpreadingIdea]
    acquisition_trend: list[AcquisitionPoint]
    monetization: list[StudioMetric]
    power_users: list[PowerUser]
    unit_economics: list[StudioMetric]
    product_health: list[StudioMetric]
    top_companies: list[TickerCount]
    notes: list[str]
