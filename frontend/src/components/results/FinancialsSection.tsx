import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

import { useEngagement } from "@/hooks/useEngagement";
import { crore, fundamentalsQuery, lossOnly, signedPct, tone } from "@/lib/fundamentals";
import type { CompanyInsight, FinancialLine, FinancialLineKey, FinancialPoint } from "@/lib/types";

const ORDER: { key: FinancialLineKey; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "net_income", label: "Net income" },
  { key: "operating_cash_flow", label: "Operating cash flow" },
];

const series = (line: FinancialLine): FinancialPoint[] => line.ttm ? [...line.points, line.ttm] : line.points;

function Sparkline({ points, testId }: { points: FinancialPoint[]; testId: string }) {
  const values = points.map((point) => point.value);
  const low = Math.min(...values), high = Math.max(...values), spread = Math.max(high - low, Math.abs(high) * .02, 1);
  const x = (index: number) => points.length < 2 ? 60 : 4 + (index / (points.length - 1)) * 112;
  const y = (value: number) => 32 - ((value - low) / spread) * 28;
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return <svg className="fin-spark" viewBox="0 0 120 36" role="img" aria-label={`Trend across ${points.length} periods`} data-testid={testId}>
    {low < 0 && <path className="fin-spark-zero" d={`M0 ${y(0).toFixed(1)} H120`} />}
    {points.length > 1 && <path className="fin-spark-line" d={line} />}
    {points.map((point, index) => point.value < 0 && <circle key={point.as_of} className="fin-spark-loss" cx={x(index)} cy={y(point.value)} r={1.8} />)}
    <circle className={last.value < 0 ? "fin-spark-end loss" : "fin-spark-end"} cx={x(points.length - 1)} cy={y(last.value)} r={2.8} />
  </svg>;
}

function teachingLine(lines: FinancialLine[]) {
  const income = lines.find((line) => line.key === "net_income"), cash = lines.find((line) => line.key === "operating_cash_flow");
  if (!income || !cash) return null;
  const cashByDate = new Map(cash.points.map((point) => [point.as_of, point.value]));
  const pairs = income.points.filter((point) => cashByDate.has(point.as_of)).map((point) => [point.value, cashByDate.get(point.as_of)!] as const);
  if (!pairs.length) return null;
  const above = pairs.filter(([profit, flow]) => flow > profit).length, total = pairs.length;
  if (above >= Math.ceil(total * .75)) return `Operating cash flow has been above net income in ${above} of ${total} years, so reported profit is turning into cash.`;
  if (above <= Math.floor(total / 4)) return `Operating cash flow trailed net income in ${total - above} of ${total} years — worth checking where reported profit is going (receivables, inventory or one-offs).`;
  return `Operating cash flow beat net income in ${above} of ${total} years — a mixed record worth reading in the cash-flow statement.`;
}

export function FinancialsSection({ company, ideaId }: { company: CompanyInsight; ideaId: string }) {
  const facts = useQuery(fundamentalsQuery(company.exchange, company.ticker));
  const [open, setOpen] = useState<FinancialLineKey | null>(null);
  const { track } = useEngagement();
  const lines = facts.data?.lines ?? [];
  const hasAny = lines.some((line) => line.points.length > 0);
  const lesson = teachingLine(lines);
  const toggle = (key: FinancialLineKey) => {
    const next = open === key ? null : key;
    setOpen(next);
    if (next) track({ event_name: "financials_row_opened", idea_id: ideaId, ticker: company.ticker, properties: { line: next } });
  };
  return <section className="detail-section" data-testid="detail-section-financials">
    <span className="detail-section-kicker real-data-kicker">FINANCIALS · SOURCED FROM YAHOO FINANCE</span>
    <h2 data-testid="detail-financials-title">Does profit turn into cash?</h2>
    {facts.isLoading ? <div className="fin-rows" data-testid="financials-loading">{ORDER.map((item) => <div className="fin-row skeleton" key={item.key}><i /><i /><i /></div>)}</div>
      : !hasAny ? <p className="detail-unavailable" data-testid="financials-unavailable">Live financials unavailable right now. Nothing is being estimated.</p>
      : <>
        {lesson && <p className="fin-lesson" data-testid="financials-lesson">{lesson}</p>}
        <div className="fin-rows" data-testid="financials-rows">{ORDER.map(({ key, label }) => {
          const line = lines.find((item) => item.key === key);
          const points = line ? series(line) : [];
          if (!line || points.length === 0) return <div className="fin-row missing" key={key} data-testid={`financials-row-${key}`}><span className="fin-label">{label}</span><span className="fin-missing">not available</span></div>;
          const first = points[0], latest = points[points.length - 1];
          const change = first.value > 0 && points.length > 1 ? (latest.value / first.value - 1) * 100 : null;
          return <div className={open === key ? "fin-row open" : "fin-row"} key={key} data-testid={`financials-row-${key}`}>
            <button type="button" className="fin-row-button" onClick={() => toggle(key)} aria-expanded={open === key} data-testid={`financials-toggle-${key}`}>
              <span className="fin-label">{label}<small>{first.label} → {latest.label}</small></span>
              <Sparkline points={points} testId={`financials-spark-${key}`} />
              <span className="fin-latest"><strong className={lossOnly(latest.value)} data-testid={`financials-latest-${key}`}>{crore(latest.value)}</strong><small>{latest.label}</small></span>
              <span className={`fin-change ${tone(change)}`} data-testid={`financials-change-${key}`}>{change === null ? "n/a" : signedPct(change)}<small>over period</small></span>
              <ChevronDown size={15} className="fin-chevron" />
            </button>
            {open === key && <table className="fin-years" data-testid={`financials-years-${key}`}><thead><tr><th>Period</th><th>Value</th><th>Change</th></tr></thead><tbody>{points.map((point, index) => {
              const previous = points[index - 1];
              const yoy = previous && previous.value > 0 ? (point.value / previous.value - 1) * 100 : null;
              return <tr key={point.as_of}><td>{point.label}<small>{point.as_of}</small></td><td className={lossOnly(point.value)}>{crore(point.value)}</td><td className={tone(yoy)}>{index === 0 ? "—" : yoy === null ? "n/a" : signedPct(yoy)}</td></tr>;
            })}</tbody></table>}
          </div>;
        })}</div>
      </>}
    <p className="detail-source-note" data-testid="financials-source">Yahoo Finance · annual reported figures · may be delayed or incomplete. TTM = trailing twelve months. ₹ crore.</p>
  </section>;
}
