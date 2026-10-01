export type GutAnswer = "yes" | "no";
export type DataStatus = "live" | "cached" | "stale" | "unavailable";
export type ConnectionStrength = "direct" | "enabling" | "adjacent";
export type QuestionFormat = "moat" | "business_model" | "metric_guess";

export interface ScoreAxis {
  key: "moat" | "capital_allocation" | "management" | "growth_runway";
  label: string;
  score: number;
  rationale: string;
}

export interface FinanceData {
  market_cap: number | null;
  pe_ratio: number | null;
  roe: number | null;
  debt_to_equity: number | null;
  revenue_growth: number | null;
  source: string;
  available: boolean;
  status: DataStatus;
  fetched_at: string | null;
  note: string;
}

export interface PricePoint { date: string; close: number; adjusted_close: number; volume: number | null }
export interface CorporateAction { date: string; type: "dividend" | "split" | "capital_gain"; value: number | null; label: string }
export interface PriceMovement { kind: "one_day" | "one_month" | "drawdown"; start_date: string; end_date: string; percent: number }
export interface AnnualJourney { year: number; start_adjusted_close: number; end_adjusted_close: number; return_percent: number }

export interface HistoricalData {
  available: boolean;
  status: DataStatus;
  source: string;
  as_of: string | null;
  period_start: string | null;
  period_end: string | null;
  points: PricePoint[];
  corporate_actions: CorporateAction[];
  range_52_week_low: number | null;
  range_52_week_high: number | null;
  largest_day: PriceMovement | null;
  largest_month: PriceMovement | null;
  max_drawdown: PriceMovement | null;
  annual_journey: AnnualJourney[];
  note: string;
}

export interface CompanyInsight {
  id: string;
  company_name: string;
  ticker: string;
  exchange: "NSE" | "BSE";
  sector: string;
  observation_phrase: string;
  connection_strength: ConnectionStrength;
  connection: string;
  behavior_change: string;
  revenue_driver: string;
  profit_sensitivity: string;
  market_expectation: string;
  business_model: string;
  risk: string;
  verify_tip: string;
  what_must_be_true: string;
  what_breaks_chain: string;
  research_checks: string[];
  gut_check_question: string;
  gut_check_lean: GutAnswer;
  revenue_question: string;
  revenue_options: string[];
  revenue_answer: string;
  scorecard: ScoreAxis[];
  finance: FinanceData;
  historical: HistoricalData;
  enrichment_status: "pending" | "ready" | "partial";
}

export interface IdeaResponse {
  id: string;
  observation: string;
  companies: CompanyInsight[];
  submitted_at: string;
  discovery_mode: "ai" | "curated_fallback";
  observation_theme: string;
  generation_ms: number;
  daily_remaining: number;
  saved_tickers: string[];
  investor_type: string | null;
  recap_completed_at: string | null;
}

export interface EnrichmentResponse {
  idea_id: string;
  ticker: string;
  finance: FinanceData;
  historical: HistoricalData;
  enrichment_status: "ready" | "partial";
  latency_ms: number;
}

export interface AnswerRecord {
  matched: boolean | null;
  skipped: boolean;
  format: QuestionFormat;
  answer: string | null;
}

export interface JournalItem {
  id: string;
  observation: string;
  submitted_at: string;
  tickers: string[];
  company_names: string[];
  investor_type: string | null;
  saved_tickers: string[];
  discovery_mode: "ai" | "curated_fallback";
}

export interface StudioMetric { key: string; label: string; display: string; value: number | null; hint: string }
export interface StudioFunnelStep { key: string; label: string; count: number }
export interface ChannelRow { channel: string; shares: number; opens: number; new_visitors: number; activated: number; conversion: number | null }
export interface PlatformRow { platform: string; fetches: number }
export interface GenerationRow { generation: string; visitors: number }
export interface SpreadingIdea { idea_id: string; observation: string; tickers: string[]; shares: number; opens: number; new_visitors: number; activated: number }
export interface AcquisitionPoint { date: string; direct: number; referred: number; ideas: number; shares: number }
export interface PowerUser { label: string; ideas: number; shares: number; limit_hits: number; referred_visitors: number; last_seen: string | null }
export interface TickerCount { ticker: string; mentions: number }
export interface StudioSummary {
  range_days: number;
  generated_at: string;
  headline: StudioMetric[];
  viral_funnel: StudioFunnelStep[];
  channels: ChannelRow[];
  preview_platforms: PlatformRow[];
  viral_cycle: StudioMetric;
  chain_max_depth: number;
  generations: GenerationRow[];
  top_spreading: SpreadingIdea[];
  acquisition_trend: AcquisitionPoint[];
  monetization: StudioMetric[];
  power_users: PowerUser[];
  unit_economics: StudioMetric[];
  product_health: StudioMetric[];
  top_companies: TickerCount[];
  notes: string[];
}
export type MarketEventKind = "results" | "filing" | "dividend" | "split";
export interface MarketEvent {
  date: string;
  ticker: string;
  company_name: string;
  kind: MarketEventKind;
  category: string;
  summary: string;
  url: string | null;
  source: "NSE" | "Yahoo Finance";
}
export interface MarketContextResponse {
  idea_id: string;
  benchmark_name: string;
  benchmark_points: PricePoint[];
  benchmark_status: "live" | "cached" | "stale" | "unavailable";
  events: MarketEvent[];
  events_status: "live" | "cached" | "partial" | "unavailable";
  note: string;
}

export interface TranscriptionResponse { text: string; language: string | null; remaining: number }
export interface VoiceAllowanceResponse { remaining: number; daily_limit: number; max_seconds: number; live: boolean }
export interface VoicePassResponse { token: string; max_seconds: number }
