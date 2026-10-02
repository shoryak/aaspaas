import { apiGet } from "@/lib/api";
import type { CompanyFundamentals } from "@/lib/types";

/** One cached fundamentals fetch per listed symbol, shared by the peer table and the Financials tab. */
export const fundamentalsQuery = (exchange: "NSE" | "BSE", ticker: string) => ({
  queryKey: ["fundamentals", exchange, ticker] as const,
  queryFn: () => apiGet<CompanyFundamentals>(`/companies/${exchange}/${encodeURIComponent(ticker)}/fundamentals`),
  staleTime: 30 * 60 * 1000,
  retry: 1,
});

/** INR → "₹2,533 Cr" / "₹1.2L Cr" (lakh crore). */
export function crore(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value / 1e7), sign = value < 0 ? "−" : "";
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L Cr`;
  return `${sign}₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: abs < 100 ? 1 : 0 }).format(abs)} Cr`;
}
export const pct = (value: number | null | undefined) => value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;
export const signedPct = (value: number | null | undefined) => value === null || value === undefined ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
export const times = (value: number | null | undefined) => value === null || value === undefined ? "—" : `${value.toFixed(1)}×`;
/** Yahoo reports debt/equity as a percentage (26.9 → 0.27). */
export const debtEquity = (value: number | null | undefined) => value === null || value === undefined ? "—" : (value / 100).toFixed(2);
/** Gain/loss colour only for real signed numbers. */
export const tone = (value: number | null | undefined) => value === null || value === undefined || value === 0 ? "" : value > 0 ? "num-gain" : "num-loss";
export const lossOnly = (value: number | null | undefined) => value !== null && value !== undefined && value < 0 ? "num-loss" : "";

export type MetricKey = "market_cap" | "pe_ratio" | "roe" | "roce" | "operating_margin" | "net_income" | "operating_cash_flow" | "revenue_growth" | "debt_to_equity" | "price_change_1y";
export interface MetricDef { key: MetricKey; label: string; tag?: string; format: (value: number | null) => string; tone: (value: number | null) => string; what: string; why: string }

export const METRICS: MetricDef[] = [
  { key: "market_cap", label: "Market cap", format: crore, tone: () => "", what: "What the stock market values the whole company at today (share price × shares).", why: "It tells you size, not quality — a giant and a small rival can be equally good businesses." },
  { key: "pe_ratio", label: "P/E", format: times, tone: () => "", what: "Share price ÷ one year of earnings per share.", why: "A high P/E means the market already expects strong growth. Compare it within the group, not across sectors." },
  { key: "roe", label: "ROE", format: pct, tone: lossOnly, what: "Return on equity: yearly profit earned on shareholders’ money.", why: "A consistently higher ROE than rivals can hint at a real edge — but heavy debt can inflate it." },
  { key: "roce", label: "ROCE", tag: "calculated", format: pct, tone: lossOnly, what: "Return on capital employed: operating profit ÷ (total assets − current liabilities).", why: "It shows how well a business uses all its long-term capital, debt included. Aaspaas calculates it from Yahoo’s latest annual figures." },
  { key: "operating_margin", label: "Op. margin", format: pct, tone: lossOnly, what: "Operating profit as a share of revenue.", why: "Margins well above rivals often point to pricing power or a cost advantage; similar margins suggest the sector sets the terms." },
  { key: "net_income", label: "Net profit", tag: "latest FY", format: crore, tone: lossOnly, what: "Profit left after all costs, interest and tax in the latest fiscal year.", why: "The headline profit number. Check it against operating cash flow to see whether it turns into cash." },
  { key: "operating_cash_flow", label: "Op. cash flow", tag: "latest FY", format: crore, tone: lossOnly, what: "Cash the core business actually brought in during the latest fiscal year.", why: "Profit that rarely becomes cash deserves a closer look at receivables, inventory and one-offs." },
  { key: "revenue_growth", label: "Rev. growth", format: signedPct, tone, what: "How much sales grew versus a year earlier (Yahoo’s latest year-on-year figure).", why: "If every company in the group grows at the same pace, the sector — not the company — may be doing the work." },
  { key: "debt_to_equity", label: "Debt/equity", format: debtEquity, tone: () => "", what: "Borrowings compared with shareholders’ money (0.50 = half as much debt as equity).", why: "Debt can lift returns in good years and hurt when business slows. Note who in the group carries more." },
  { key: "price_change_1y", label: "1Y price", format: signedPct, tone, what: "Change in the adjusted share price over the past year.", why: "It reflects market mood over twelve months — not business quality, and not what happens next." },
];
