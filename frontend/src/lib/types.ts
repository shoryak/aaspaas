export type GutAnswer = "yes" | "no";

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
  note: string;
}

export interface CompanyInsight {
  id: string;
  company_name: string;
  ticker: string;
  exchange: "NSE" | "BSE";
  connection: string;
  business_model: string;
  risk: string;
  verify_tip: string;
  gut_check_question: string;
  gut_check_lean: GutAnswer;
  scorecard: ScoreAxis[];
  finance: FinanceData;
}

export interface IdeaResponse {
  id: string;
  observation: string;
  companies: CompanyInsight[];
  submitted_at: string;
  discovery_mode: "ai" | "curated_fallback";
}

export interface GutCheckResponse {
  recorded: boolean;
  matched: boolean;
}

export interface AnalyticsSummary {
  ideas_submitted: number;
  sessions: number;
  pageviews: number;
  shares: number;
  gut_checks: number;
  gut_check_accuracy: number | null;
  share_click_rate: number | null;
  trend: { date: string; ideas: number; shares: number }[];
  top_companies: { ticker: string; mentions: number }[];
}