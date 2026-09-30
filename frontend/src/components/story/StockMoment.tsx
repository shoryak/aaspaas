import { useMemo, useState } from "react";
import { Activity, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HistoricalData, PriceMovement } from "@/lib/types";

const money = (value: number | null) => value === null ? "—" : `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

function movementLabel(movement: PriceMovement) {
  if (movement.kind === "one_day") return "one trading day";
  if (movement.kind === "one_month") return "about one trading month";
  return "peak-to-trough drawdown";
}

function Chart({ data, ticker }: { data: HistoricalData; ticker: string }) {
  const path = useMemo(() => {
    if (data.points.length < 2) return "";
    const sampled = data.points.filter((_, index) => index % 5 === 0 || index === data.points.length - 1);
    const values = sampled.map((point) => point.adjusted_close);
    const low = Math.min(...values), high = Math.max(...values), spread = Math.max(high - low, 1);
    return sampled.map((point, index) => {
      const x = (index / Math.max(sampled.length - 1, 1)) * 600;
      const y = 170 - ((point.adjusted_close - low) / spread) * 145;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [data.points]);
  return <div className="full-chart" data-testid={`full-chart-${ticker.toLowerCase()}`}>
    <svg viewBox="0 0 600 190" role="img" aria-label={`${ticker} five-year adjusted share-price journey`}>
      <path className="chart-gridline" d="M0 25 H600 M0 97 H600 M0 170 H600" />
      <path className="chart-line" d={path} />
    </svg>
    <div className="chart-axis"><span data-testid="chart-period-start">{data.period_start}</span><span data-testid="chart-period-end">{data.period_end}</span></div>
    {data.corporate_actions.length > 0 && <div className="corporate-actions" data-testid="corporate-actions"><span className="mono-label">CORPORATE ACTIONS RETURNED</span>{data.corporate_actions.slice(-5).map((action) => <span key={`${action.date}-${action.type}`} data-testid={`corporate-action-${action.date}`}>{action.date} · {action.type.replace("_", " ")} {action.label}</span>)}</div>}
  </div>;
}

export function StockMoment({ data, ticker, variant, loading, onExpand, onContinue }: { data: HistoricalData; ticker: string; variant: "wildest" | "journey"; loading: boolean; onExpand: () => void; onContinue: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const movement = useMemo(() => {
    const candidates = [data.largest_day, data.largest_month, data.max_drawdown].filter(Boolean) as PriceMovement[];
    return candidates.sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent))[0] ?? null;
  }, [data]);
  const journey = data.points.length > 1 ? ((data.points.at(-1)!.adjusted_close / data.points[0].adjusted_close) - 1) * 100 : null;
  if (loading) return <section className="story-beat market-beat" data-testid="stock-moment-loading"><div className="story-skeleton skeleton-label" /><div className="story-skeleton skeleton-title" /><div className="story-skeleton skeleton-chart" /><p className="skeleton-copy">Checking five years of adjusted prices, splits, and dividends…</p></section>;
  return <section className="story-beat market-beat" data-testid={`stock-moment-${ticker.toLowerCase()}`}>
    <div className="market-source-row"><span className="story-kicker" data-testid="stock-moment-kicker">VERIFIED PRICE BEHAVIOUR</span><Badge className={`status-badge status-${data.status}`} data-testid="historical-status-badge">{data.status}</Badge></div>
    {!data.available ? <><h1 data-testid="historical-unavailable-title">The price trail is quiet for now.</h1><p className="market-teaching" data-testid="historical-unavailable-copy">Yahoo Finance history is unavailable. The business lesson and qualitative read can still continue without inventing a market moment.</p></> : variant === "wildest" && movement ? <>
      <p className="moment-overline" data-testid="stock-hook-format">WILDEST MOMENT · {movementLabel(movement)}</p>
      <h1 className="moment-number" data-testid="stock-movement-percent">{signed(movement.percent)}</h1>
      <p className="moment-dates" data-testid="stock-movement-dates">{movement.start_date} → {movement.end_date}</p>
      <p className="market-teaching" data-testid="stock-moment-teaching">That move is verified. Its cause is not. It teaches us that market expectations can reset faster than business facts become clear—so the next step is to inspect filings and announcements around those dates.</p>
    </> : <>
      <p className="moment-overline" data-testid="stock-hook-format">FIVE-YEAR JOURNEY · ADJUSTED CLOSE</p>
      <h1 className="moment-number" data-testid="five-year-journey-percent">{journey === null ? "—" : signed(journey)}</h1>
      <p className="moment-dates" data-testid="five-year-journey-dates">{data.period_start} → {data.period_end}</p>
      <p className="market-teaching" data-testid="stock-moment-teaching">This is the share-price journey, not a verdict on the business. The line reflects changing expectations, uncertainty, and corporate actions—not a recommendation or a missed opportunity.</p>
    </>}
    {data.available && <div className="market-facts" data-testid="historical-facts"><span>52-week range <strong>{money(data.range_52_week_low)} — {money(data.range_52_week_high)}</strong></span><span>As of <strong>{data.as_of}</strong></span></div>}
    {data.available && <button type="button" className="chart-toggle" onClick={() => { const next = !expanded; setExpanded(next); if (next) onExpand(); }} data-testid="full-chart-toggle-button">{expanded ? "Close five-year research layer" : "Open full five-year chart"}{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>}
    {expanded && <Chart data={data} ticker={ticker} />}
    <p className="source-caption" data-testid="historical-source-caption">Source: {data.source} · adjusted close · {data.note}</p>
    <Button className="story-cta" onClick={onContinue} data-testid="stock-moment-continue-button">Try one light read <Activity size={16} /><ArrowRight size={15} /></Button>
  </section>;
}