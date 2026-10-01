import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { downsample, niceTicks, pointsForPeriod, rupees, shortDate, signedPercent, slug, toTime } from "@/lib/performance";
import type { PeriodKey } from "@/lib/performance";
import type { CompanyInsight } from "@/lib/types";

const SERIES_COLORS = ["#e0a35a", "#a394cf", "#7fb2d6", "#e9e5da"];
const MARGIN = { top: 18, right: 18, bottom: 30, left: 52 };

interface SeriesPoint { t: number; pct: number; price: number; date: string }
interface Series { ticker: string; name: string; color: string; points: SeriesPoint[]; endPct: number }

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function nearest(points: SeriesPoint[], t: number) {
  let low = 0, high = points.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (points[mid].t < t) low = mid + 1; else high = mid;
  }
  const prev = points[Math.max(low - 1, 0)];
  return Math.abs(prev.t - t) < Math.abs(points[low].t - t) ? prev : points[low];
}

export function PerformanceOverlayChart({ companies, period, loading }: { companies: CompanyInsight[]; period: PeriodKey; loading: boolean }) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoverT, setHoverT] = useState<number | null>(null);

  const series = useMemo<Series[]>(() => companies.flatMap((company, index) => {
    if (!company.historical.available) return [];
    const raw = pointsForPeriod(company.historical.points, period);
    if (raw.length < 2) return [];
    const base = raw[0].adjusted_close;
    const points = raw.map((point) => ({ t: toTime(point.date), pct: (point.adjusted_close / base - 1) * 100, price: point.adjusted_close, date: point.date }));
    return [{ ticker: company.ticker, name: company.company_name, color: SERIES_COLORS[index % SERIES_COLORS.length], points, endPct: points[points.length - 1].pct }];
  }), [companies, period]);

  const visible = series.filter((item) => !hidden.has(item.ticker));
  const height = width < 560 ? 270 : 360;
  const innerW = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const scale = useMemo(() => {
    const pool = visible.length ? visible : series;
    const tMin = Math.min(...pool.map((item) => item.points[0].t));
    const tMax = Math.max(...pool.map((item) => item.points[item.points.length - 1].t));
    const values = pool.flatMap((item) => item.points.map((point) => point.pct));
    const lo = Math.min(0, ...values), hi = Math.max(0, ...values), pad = Math.max((hi - lo) * .08, 2);
    return { tMin, tMax, yMin: lo - pad, yMax: hi + pad };
  }, [visible, series]);

  const x = (t: number) => MARGIN.left + ((t - scale.tMin) / Math.max(scale.tMax - scale.tMin, 1)) * innerW;
  const y = (pct: number) => MARGIN.top + (1 - (pct - scale.yMin) / Math.max(scale.yMax - scale.yMin, 1e-6)) * innerH;
  const paths = series.map((item) => downsample(item.points, Math.max(60, Math.floor(innerW / 2))).map((point, index) => `${index === 0 ? "M" : "L"}${x(point.t).toFixed(1)},${y(point.pct).toFixed(1)}`).join(" "));
  const yTicks = series.length ? niceTicks(scale.yMin, scale.yMax, width < 560 ? 4 : 5) : [];
  const xCount = width < 560 ? 3 : 5;
  const xTicks: number[] = series.length ? Array.from({ length: xCount }, (_, index) => scale.tMin + ((scale.tMax - scale.tMin) * index) / (xCount - 1)) : [];

  const onPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!series.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left - MARGIN.left) / innerW, 0), 1);
    setHoverT(scale.tMin + ratio * (scale.tMax - scale.tMin));
  };
  const hoverRows = hoverT === null ? [] : visible.map((item) => ({ item, point: nearest(item.points, hoverT) })).sort((a, b) => b.point.pct - a.point.pct);
  const hoverX = hoverRows.length ? x(hoverRows[0].point.t) : 0;

  const toggle = (ticker: string) => setHidden((current) => {
    const next = new Set(current);
    if (next.has(ticker)) next.delete(ticker); else next.add(ticker);
    return next;
  });

  return <div className="overlay-chart" data-testid="overlay-chart">
    <div className="overlay-chart-head">
      <div><span className="overlay-kicker" data-testid="overlay-chart-kicker">ALL COMPANIES · ONE CANVAS · {period}</span><p data-testid="overlay-chart-caption">Each line starts at 0% on the first trading day of the period, so different share prices compare fairly.</p></div>
      <span className="overlay-hint" data-testid="overlay-chart-hint">Hover or tap the chart · tap a name to hide it</span>
    </div>
    <div className="overlay-legend" data-testid="overlay-legend">
      {companies.map((company) => {
        const item = series.find((row) => row.ticker === company.ticker);
        const off = hidden.has(company.ticker);
        return <button type="button" key={company.ticker} disabled={!item} aria-pressed={item ? !off : undefined} className={off ? "off" : ""} onClick={() => toggle(company.ticker)} data-testid={`overlay-legend-${slug(company.ticker)}`}>
          <i style={{ background: item?.color ?? "#4a4c50" }} />
          <span className="overlay-legend-ticker">{company.ticker}</span>
          <strong className={item ? item.endPct >= 0 ? "movement-positive" : "movement-negative" : ""} data-testid={`overlay-legend-change-${slug(company.ticker)}`}>{item ? signedPercent(item.endPct) : loading ? "loading" : "no history"}</strong>
        </button>;
      })}
    </div>
    <div className="overlay-canvas" ref={wrapRef} style={{ height }}>
      {!series.length ? <div className={loading ? "overlay-empty overlay-loading" : "overlay-empty"} data-testid={loading ? "overlay-chart-loading" : "overlay-chart-unavailable"}>{loading ? <><i /><i /><i /></> : <p>Price history is unavailable for these companies right now. No movement is estimated.</p>}</div> : width > 0 && <>
        <svg width={width} height={height} role="img" aria-label={`Percentage movement of ${series.map((item) => item.ticker).join(", ")} over ${period}`} onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={(event) => { if (event.pointerType === "mouse") setHoverT(null); }} data-testid="overlay-chart-svg">
          {yTicks.map((tick) => <g key={tick} className="overlay-tick"><line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "overlay-zero" : ""} /><text x={MARGIN.left - 9} y={y(tick)} dy="0.32em" textAnchor="end">{`${tick > 0 ? "+" : ""}${tick}%`}</text></g>)}
          {xTicks.map((tick, index) => <text key={tick} className="overlay-xlabel" x={x(tick)} y={height - 9} textAnchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"}>{shortDate(tick)}</text>)}
          {series.map((item, index) => <path key={`${item.ticker}-${period}`} d={paths[index]} pathLength={1} className={hidden.has(item.ticker) ? "overlay-line hidden-line" : "overlay-line"} style={{ stroke: item.color, animationDelay: `${index * 160}ms` }} data-testid={`overlay-line-${slug(item.ticker)}`} />)}
          {visible.map((item) => { const last = item.points[item.points.length - 1]; return <circle key={`${item.ticker}-end-${period}`} className="overlay-end-dot" cx={x(last.t)} cy={y(last.pct)} r={3.5} style={{ fill: item.color }} />; })}
          {hoverRows.length > 0 && <g className="overlay-hover" data-testid="overlay-hover-marker"><line x1={hoverX} x2={hoverX} y1={MARGIN.top} y2={MARGIN.top + innerH} />{hoverRows.map(({ item, point }) => <circle key={item.ticker} cx={x(point.t)} cy={y(point.pct)} r={5} style={{ stroke: item.color }} />)}</g>}
        </svg>
        {hoverRows.length > 0 && <div className="overlay-tooltip" style={{ left: hoverX, transform: hoverX > width * .55 ? "translateX(calc(-100% - 14px))" : "translateX(14px)" }} data-testid="overlay-tooltip">
          <span className="overlay-tooltip-date" data-testid="overlay-tooltip-date">{new Date(hoverRows[0].point.t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>
          {hoverRows.map(({ item, point }) => <div key={item.ticker} className="overlay-tooltip-row" data-testid={`overlay-tooltip-row-${slug(item.ticker)}`}><i style={{ background: item.color }} /><span>{item.ticker}</span><strong className={point.pct >= 0 ? "movement-positive" : "movement-negative"}>{signedPercent(point.pct)}</strong><em>{rupees(point.price)}</em></div>)}
        </div>}
      </>}
    </div>
    <p className="overlay-source" data-testid="overlay-chart-source">Yahoo Finance · daily adjusted close · rebased to 0% · movement is not a ranking or a recommendation</p>
  </div>;
}
