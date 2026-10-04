export type GutAnswer = "yes" | "no";
export type DataStatus = "live" | "cached" | "stale" | "unavailable";
export type ConnectionStrength = "direct" | "enabling" | "adjacent";
export type QuestionFormat = "moat" | "business_model" | "metric_guess";

export interface ScoreAxis {
  key: "moat" | "capital_allocation" | "management" | "growth_runway";
  label: string;
  rationale: string;
}

export interface Peer { company_name: string; ticker: string; exchange: "NSE" | "BSE"; reason: string }

export interface FinanceData {
  market_cap: number | null;
  pe_ratio: number | null;
  roe: number | null;
  debt_to_equity: number | null;
  revenue_growth: number | null;
  operating_margin: number | null;
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
  peers: Peer[] | null;
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
  place?: Place | null;
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
  place?: Place | null;
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

export type FinancialLineKey = "revenue" | "net_income" | "operating_cash_flow";
export interface FinancialPoint { label: string; as_of: string; value: number }
export interface FinancialLine { key: FinancialLineKey; label: string; points: FinancialPoint[]; ttm: FinancialPoint | null }
export interface CompanyFundamentals {
  ticker: string;
  exchange: "NSE" | "BSE";
  available: boolean;
  status: DataStatus;
  market_cap: number | null;
  pe_ratio: number | null;
  roe: number | null;
  roce: number | null;
  operating_margin: number | null;
  net_income: number | null;
  operating_cash_flow: number | null;
  revenue_growth: number | null;
  debt_to_equity: number | null;
  price_change_1y: number | null;
  fiscal_year: string | null;
  lines: FinancialLine[];
  source: string;
  note: string;
}
export interface Place { area: string | null; city: string; state: string | null; source: "gps" | "picked" | "typed" }
export interface CityThemes { city: string; state: string | null; people: number; themes: string[]; tickers: string[] }
export interface CitiesResponse { min_people: number; window_days: number; cities: CityThemes[]; gathering: number }
export interface PeerGroup { ticker: string; peers: Peer[] }
export interface PeerGroupsResponse { idea_id: string; status: "ready" | "unavailable"; groups: PeerGroup[] }

export interface LessonModule { key: string; number: number; title: string; subtitle: string }
export interface Lesson {
  number: number; slug: string; module: string; title: string; promise: string; key_idea: string;
  paragraphs: string[]; example: string; checks: string[]; metric: string; duration: string;
  youtube_url: string; reel_url: string; published: boolean; is_tax: boolean; last_checked: string;
}
export interface LearnResponse { modules: LessonModule[]; lessons: Lesson[]; watched: string[] }
export interface SiteVideos { landing: string; friend: string }
export interface TrendingClue { id: string; date: string; observation: string; source: string; source_url: string | null; idea_id: string | null; tickers: string[]; hidden: boolean; city: string | null }
export interface TrendingDay { date: string; status: "fresh" | "previous" | "empty"; clues: TrendingClue[]; archive_dates: string[] }
export interface TrendingLogItem { title: string; source: string; picked: boolean; reason: string }
export interface TrendingLogResponse { date: string; items: TrendingLogItem[]; clues: TrendingClue[] }
export interface AccountResponse { signed_in: boolean; email: string | null; updates_opt_in: boolean }
export interface SignInRequested { sent: boolean; email: string }
export interface Holding {
  id: string; ticker: string; exchange: "NSE" | "BSE"; company_name: string; sector: string; units: number; invested: number;
  first_bought: string; note: string; change_mind: string; check_back: string | null; price: number | null; value: number | null;
  gain: number | null; gain_pct: number | null; holding_days: number;
}
export interface PortfolioPoint { date: string; value: number; nifty: number }
export interface SectorShare { sector: string; percent: number }
export interface Portfolio {
  id: string; name: string; start_cash: number; cash: number; value: number; gain: number; gain_pct: number;
  holdings: Holding[]; series: PortfolioPoint[]; sector_mix: SectorShare[]; due_check_backs: string[]; created_at: string;
}
export interface PortfolioSummary { id: string; name: string; holdings: number; cash: number }
export interface PortfolioList { portfolios: PortfolioSummary[]; limit: number }
export interface SellResponse { proceeds: number; short_term_gain: number; long_term_gain: number; portfolio: Portfolio }
export interface PartnerBias { name: string; why: string }
export interface PartnerReply { supported: string[]; assumptions: string[]; biases: PartnerBias[]; questions: string[]; evidence_to_change: string; lesson_slug: string; advice_redirected: boolean }
export interface PartnerTurn { role: "user" | "partner"; text: string | null; reply: PartnerReply | null }
export interface PartnerConversation { id: string; ticker: string; company_name: string; turns: PartnerTurn[]; remaining_today: number; max_turns: number }
/** A company anyone can add to a practice portfolio or discuss with the thinking partner. */
export interface CompanyRef { ticker: string; exchange: "NSE" | "BSE"; company_name: string; sector?: string; idea_id?: string }
