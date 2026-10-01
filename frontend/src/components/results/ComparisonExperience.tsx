import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BarChart3, Bookmark, BookmarkCheck, Building2, ExternalLink, Lightbulb, ListChecks, Search, ShieldAlert, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";

import { InteractionPanel } from "@/components/story/InteractionPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEngagement } from "@/hooks/useEngagement";
import { apiGet, apiPost } from "@/lib/api";
import { downsample, periodStats, pointsForPeriod, rupees, signedPercent, slug } from "@/lib/performance";
import type { PeriodKey } from "@/lib/performance";
import { PerformanceOverlayChart } from "@/components/results/PerformanceOverlayChart";
import { SnapNav } from "@/components/results/SnapNav";
import type { AnswerRecord, CompanyInsight, EnrichmentResponse, IdeaResponse, MarketContextResponse, PricePoint, ScoreAxis } from "@/lib/types";

type SortKey = "quality" | ScoreAxis["key"] | "pe" | "market_cap";

const CATEGORIES: { key: SortKey; label: string; hint: string }[] = [
  { key: "quality", label: "Overall quality", hint: "Average of four lenses" },
  { key: "moat", label: "Moat & pricing power", hint: "AI judgment" },
  { key: "capital_allocation", label: "Capital allocation", hint: "AI judgment" },
  { key: "management", label: "Management", hint: "AI judgment" },
  { key: "growth_runway", label: "Growth runway", hint: "AI judgment" },
  { key: "pe", label: "P/E · lowest", hint: "Yahoo Finance" },
  { key: "market_cap", label: "Market cap · largest", hint: "Yahoo Finance" },
];
type DetailSection = "standout" | "risk" | "model" | "scorecard" | "market" | "verify" | "instinct";

const averageScore = (company: CompanyInsight) => company.scorecard.reduce((sum, axis) => sum + axis.score, 0) / Math.max(company.scorecard.length, 1);
const axisScore = (company: CompanyInsight, key: ScoreAxis["key"]) => company.scorecard.find((axis) => axis.key === key)?.score ?? 0;
const marketCap = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const number = (value: number | null) => value === null ? "—" : value.toFixed(1);
const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;

function categoryValue(company: CompanyInsight, key: SortKey): number | null {
  if (key === "quality") return averageScore(company);
  if (key === "pe") return company.finance.pe_ratio !== null && company.finance.pe_ratio > 0 ? company.finance.pe_ratio : null;
  if (key === "market_cap") return company.finance.market_cap;
  return axisScore(company, key) || null;
}
function categoryDisplay(key: SortKey, value: number | null) {
  if (value === null) return "No data";
  if (key === "quality") return `${value.toFixed(1)} / 5`;
  if (key === "pe") return `P/E ${value.toFixed(1)}`;
  if (key === "market_cap") return `₹${marketCap(value)}`;
  return `${value} / 5`;
}
function rankBy(companies: CompanyInsight[], key: SortKey) {
  const direction = key === "pe" ? 1 : -1;
  return [...companies].sort((a, b) => {
    const left = categoryValue(a, key), right = categoryValue(b, key);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return (left - right) * direction;
  });
}

function CategoryCards({ companies, active, onSelect }: { companies: CompanyInsight[]; active: SortKey; onSelect: (key: SortKey) => void }) {
  return <div className="category-cards" role="group" aria-label="Rank business cards by" data-testid="category-cards">{CATEGORIES.map((category) => {
    const [leader] = rankBy(companies, category.key);
    const value = leader ? categoryValue(leader, category.key) : null;
    const tied = value === null ? [] : companies.filter((company) => categoryValue(company, category.key) === value);
    return <button type="button" key={category.key} className={active === category.key ? "category-card active" : "category-card"} aria-pressed={active === category.key} onClick={() => onSelect(category.key)} data-testid={`category-card-${category.key}`}>
      <span className="category-card-label">{category.label}</span>
      <strong className="category-card-leader" data-testid={`category-leader-${category.key}`}>{value === null ? "—" : tied.length > 1 ? `${tied.length}-way tie` : leader.ticker}</strong>
      <span className="category-card-value" data-testid={`category-value-${category.key}`}>{categoryDisplay(category.key, value)}</span>
      {tied.length > 1 && <span className="category-card-tied" data-testid={`category-tied-${category.key}`}>{tied.map((company) => company.ticker).join(" · ")}</span>}
      <small className="category-card-hint">{category.hint}</small>
    </button>;
  })}</div>;
}

function MiniPips({ score, label, testId, active }: { score: number; label: string; testId: string; active: boolean }) {
  return <div className={active ? "comparison-pip-row active" : "comparison-pip-row"} data-testid={testId}><span data-testid={`${testId}-label`}>{label}</span><div aria-label={`${label}: ${score} out of 5`} data-testid={`${testId}-pips`}>{[1, 2, 3, 4, 5].map((pip) => <i key={pip} className={pip <= score ? "filled" : ""} />)}</div></div>;
}

function ComparisonCard({ company, rank, loading, sort, onExplore, onIntuition }: { company: CompanyInsight; rank: number; loading: boolean; sort: SortKey; onExplore: () => void; onIntuition: () => void }) {
  return <article className="comparison-card" data-testid={`comparison-card-${slug(company.ticker)}`}>
    <div className="comparison-card-button">
      <div className="comparison-rank-row"><span data-testid={`comparison-rank-${slug(company.ticker)}`}>#{rank}</span><Badge className={`strength-badge strength-${company.connection_strength}`} data-testid={`comparison-strength-${slug(company.ticker)}`}>{company.connection_strength}</Badge></div>
      <p className="comparison-ticker" data-testid={`comparison-ticker-${slug(company.ticker)}`}>{company.exchange} · {company.ticker}</p>
      <h2 data-testid={`comparison-name-${slug(company.ticker)}`}>{company.company_name}</h2>
      <p className="comparison-connection" data-testid={`comparison-connection-${slug(company.ticker)}`}>{company.connection}</p>
      <div className={sort === "quality" ? "comparison-score active" : "comparison-score"} data-testid={`comparison-score-${slug(company.ticker)}`}><strong>{averageScore(company).toFixed(1)}</strong><span>quality read / 5</span></div>
      <div className="comparison-pips" data-testid={`comparison-pips-${slug(company.ticker)}`}>
        <MiniPips score={axisScore(company, "moat")} label="Moat" testId={`mini-moat-${slug(company.ticker)}`} active={sort === "moat"} />
        <MiniPips score={axisScore(company, "capital_allocation")} label="Capital" testId={`mini-capital-${slug(company.ticker)}`} active={sort === "capital_allocation"} />
        <MiniPips score={axisScore(company, "management")} label="Management" testId={`mini-management-${slug(company.ticker)}`} active={sort === "management"} />
        <MiniPips score={axisScore(company, "growth_runway")} label="Growth" testId={`mini-growth-${slug(company.ticker)}`} active={sort === "growth_runway"} />
      </div>
      {loading ? <div className="comparison-data-skeleton" data-testid={`comparison-data-loading-${slug(company.ticker)}`}><i /><i /></div> : <div className="comparison-data-chips" data-testid={`comparison-data-${slug(company.ticker)}`}><span className={sort === "pe" ? "active" : ""}>P/E <strong>{number(company.finance.pe_ratio)}</strong></span><span className={sort === "market_cap" ? "active" : ""}>Market cap <strong>{marketCap(company.finance.market_cap)}</strong></span></div>}
      <div className="company-card-actions" data-testid={`business-actions-${slug(company.ticker)}`}><Button type="button" onClick={onExplore} data-testid={`business-explore-${slug(company.ticker)}`}>Explore details <ArrowRight size={14} /></Button><Button type="button" variant="outline" onClick={onIntuition} data-testid={`business-intuition-${slug(company.ticker)}`}>Test your intuition <Target size={14} /></Button></div>
    </div>
  </article>;
}

function PerformanceMiniChart({ points, ticker }: { points: PricePoint[]; ticker: string }) {
  const chart = useMemo(() => {
    if (points.length < 2) return null;
    const sampled = downsample(points, 110);
    const values = sampled.map((point) => point.adjusted_close);
    const low = Math.min(...values), high = Math.max(...values), spread = Math.max(high - low, high * .01);
    const coords = sampled.map((point, index) => [(index / (sampled.length - 1)) * 320, 96 - ((point.adjusted_close - low) / spread) * 80] as const);
    const line = coords.map(([cx, cy], index) => `${index === 0 ? "M" : "L"}${cx.toFixed(1)},${cy.toFixed(1)}`).join(" ");
    return { line, area: `${line} L320,112 L0,112 Z`, low, high, end: coords[coords.length - 1] };
  }, [points]);
  if (!chart) return null;
  const fillId = `mini-fill-${slug(ticker)}`;
  return <svg className="performance-mini-chart" viewBox="0 0 320 116" role="img" aria-label={`${ticker} adjusted share price in rupees`} data-testid={`performance-chart-${slug(ticker)}`}>
    <defs><linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#e0a35a" stopOpacity=".28" /><stop offset="100%" stopColor="#e0a35a" stopOpacity="0" /></linearGradient></defs>
    <path className="performance-chart-grid" d="M0 16 H320 M0 56 H320 M0 96 H320" />
    <path className="performance-chart-area" d={chart.area} fill={`url(#${fillId})`} />
    <path className="performance-chart-line" d={chart.line} pathLength={1} />
    <circle className="performance-chart-end" cx={chart.end[0]} cy={chart.end[1]} r={3.2} />
    <text className="performance-chart-label" x={2} y={11} data-testid={`performance-chart-high-${slug(ticker)}`}>{`HIGH ${rupees(chart.high)}`}</text>
    <text className="performance-chart-label" x={2} y={110} data-testid={`performance-chart-low-${slug(ticker)}`}>{`LOW ${rupees(chart.low)}`}</text>
  </svg>;
}

function PerformanceCard({ company, period, loading, onExplore, onIntuition }: { company: CompanyInsight; period: PeriodKey; loading: boolean; onExplore: () => void; onIntuition: () => void }) {
  const points = pointsForPeriod(company.historical.points, period);
  const stats = periodStats(points);
  return <article className="performance-card" data-testid={`performance-card-${slug(company.ticker)}`}><div className="performance-card-top"><div><span className="performance-ticker" data-testid={`performance-ticker-${slug(company.ticker)}`}>{company.exchange} · {company.ticker}</span><h3 data-testid={`performance-name-${slug(company.ticker)}`}>{company.company_name}</h3></div><Badge className={`status-badge status-${company.historical.status}`} data-testid={`performance-status-${slug(company.ticker)}`}>{company.historical.status}</Badge></div>{loading ? <div className="performance-skeleton" data-testid={`performance-loading-${slug(company.ticker)}`}><i /><i /><i /></div> : stats && company.historical.available ? <><PerformanceMiniChart key={period} points={points} ticker={company.ticker} /><div className="performance-price-row" data-testid={`performance-prices-${slug(company.ticker)}`}><span>Share price</span><strong>{rupees(stats.startPrice)}</strong><ArrowRight size={13} /><strong>{rupees(stats.endPrice)}</strong></div><div className="performance-stat-row"><div><span>Total adjusted movement</span><strong className={stats.movement >= 0 ? "movement-positive" : "movement-negative"} data-testid={`performance-movement-${slug(company.ticker)}`}>{signedPercent(stats.movement)}</strong></div><div><span>Maximum drawdown</span><strong className="movement-negative" data-testid={`performance-drawdown-${slug(company.ticker)}`}>{`${stats.drawdown.toFixed(1)}%`}</strong></div></div><div className="performance-dates" data-testid={`performance-dates-${slug(company.ticker)}`}><span>{stats.start}</span><ArrowRight size={12} /><span>{stats.end}</span></div></> : <div className="performance-unavailable" data-testid={`performance-unavailable-${slug(company.ticker)}`}><BarChart3 size={22} /><strong>Price history unavailable</strong><p>No movement is estimated. Business context remains available below.</p></div>}<p className="performance-source" data-testid={`performance-source-${slug(company.ticker)}`}>Yahoo Finance · adjusted close in ₹ · as of {company.historical.as_of ?? "unavailable"}</p><div className="company-card-actions performance-actions" data-testid={`performance-actions-${slug(company.ticker)}`}><Button type="button" onClick={onExplore} data-testid={`performance-explore-${slug(company.ticker)}`}>Explore details <ArrowRight size={14} /></Button><Button type="button" variant="outline" onClick={onIntuition} data-testid={`performance-intuition-${slug(company.ticker)}`}>Test your intuition <Target size={14} /></Button></div></article>;
}

function PerformanceSection({ ideaId, observation, companies, loading, onExplore, onIntuition, onPeriodChange }: { ideaId: string; observation: string; companies: CompanyInsight[]; loading: boolean[]; onExplore: (ticker: string) => void; onIntuition: (ticker: string) => void; onPeriodChange: (period: PeriodKey) => void }) {
  const [period, setPeriod] = useState<PeriodKey>("5Y");
  const context = useQuery({ queryKey: ["market-context", ideaId], queryFn: () => apiGet<MarketContextResponse>(`/ideas/${ideaId}/market-context`), staleTime: 10 * 60 * 1000, retry: 1 });
  return <section className="performance-section" data-testid="performance-section"><div className="snap-panel" data-snap-panel="All stocks"><div className="performance-section-heading"><div><span className="mono-label" data-testid="performance-kicker">VERIFIED MARKET CONTEXT · NOT A RANKING</span><h2 data-testid="performance-title">How these stocks<br /><em>travelled.</em></h2><p data-testid="performance-intro">Adjusted-price history can spark a question. It cannot prove business quality, predict future returns, or tell you to buy or sell.</p></div><div className="performance-period-control" data-testid="performance-period-control"><span>Shared period</span><div>{(["1Y", "3Y", "5Y"] as PeriodKey[]).map((option) => <button type="button" className={period === option ? "active" : ""} onClick={() => { setPeriod(option); onPeriodChange(option); }} key={option} data-testid={`performance-period-${option.toLowerCase()}`}>{option}</button>)}</div></div></div><PerformanceOverlayChart ideaId={ideaId} observation={observation} companies={companies} period={period} loading={loading.some(Boolean)} context={context.data} /></div><div className="performance-grid" data-testid="performance-grid">{companies.map((company, index) => <div className="snap-panel" data-snap-panel={`${company.ticker} · price`} key={company.id}><PerformanceCard company={company} period={period} loading={loading[index]} onExplore={() => onExplore(company.ticker)} onIntuition={() => onIntuition(company.ticker)} />{index === companies.length - 1 && <p className="performance-disclaimer" data-testid="performance-disclaimer">Source: Yahoo Finance daily adjusted close. Dividends and splits returned by the source remain visible in each company’s Stock journey detail. Historical movement is educational context—not a recommendation.</p>}</div>)}</div></section>;
}

function PriceChart({ points, ticker }: { points: PricePoint[]; ticker: string }) {
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const sampled = points.filter((_, index) => index % 5 === 0 || index === points.length - 1);
    const values = sampled.map((point) => point.adjusted_close), low = Math.min(...values), high = Math.max(...values), spread = Math.max(high - low, 1);
    return sampled.map((point, index) => `${index === 0 ? "M" : "L"}${((index / Math.max(sampled.length - 1, 1)) * 700).toFixed(1)},${(190 - ((point.adjusted_close - low) / spread) * 165).toFixed(1)}`).join(" ");
  }, [points]);
  return <svg className="detail-price-chart" viewBox="0 0 700 210" role="img" aria-label={`${ticker} five-year adjusted share-price journey`} data-testid={`detail-price-chart-${slug(ticker)}`}><path className="chart-gridline" d="M0 25 H700 M0 107 H700 M0 190 H700" /><path className="chart-line" d={path} /></svg>;
}

function QualityScorecard({ company }: { company: CompanyInsight }) {
  return <div className="detail-scorecard" data-testid={`detail-scorecard-${slug(company.ticker)}`}>{company.scorecard.map((axis) => <div className="detail-axis" key={axis.key} data-testid={`detail-axis-${axis.key}`}><div><span>{axis.label}</span><strong>{axis.score}/5</strong></div><div className="detail-axis-pips">{[1, 2, 3, 4, 5].map((pip) => <i key={pip} className={pip <= axis.score ? "filled" : ""} />)}</div><p>{axis.rationale}</p></div>)}</div>;
}

function DetailContent({ section, company, index, answer, saved, onAnswer, onSave, onScreener, onExploreAfterInstinct, onBackAfterInstinct }: { section: DetailSection; company: CompanyInsight; index: number; answer?: AnswerRecord; saved: boolean; onAnswer: (record: AnswerRecord, metricDistance?: number) => void; onSave: () => void; onScreener: () => void; onExploreAfterInstinct: () => void; onBackAfterInstinct: () => void }) {
  const movement = [company.historical.largest_day, company.historical.largest_month, company.historical.max_drawdown].filter(Boolean).sort((a, b) => Math.abs(b!.percent) - Math.abs(a!.percent))[0];
  if (section === "standout") return <section className="detail-section" data-testid="detail-section-standout"><span className="detail-section-kicker">WHAT STANDS OUT</span><h2 data-testid="detail-standout-title">The strongest part of the connection.</h2><p className="detail-lead" data-testid="detail-standout-copy">{company.connection}</p><div className="detail-highlight-grid"><article><Lightbulb size={17} /><strong>Moat read</strong><p>{company.scorecard.find((axis) => axis.key === "moat")?.rationale}</p></article><article><Target size={17} /><strong>What has to be true</strong><p>{company.what_must_be_true}</p></article></div><div className="detail-fact-row" data-testid="detail-fact-row"><span>P/E <strong>{number(company.finance.pe_ratio)}</strong></span><span>Market cap <strong>{marketCap(company.finance.market_cap)}</strong></span><span>ROE <strong>{percent(company.finance.roe)}</strong></span><span>Data <strong>{company.finance.status}</strong></span></div></section>;
  if (section === "risk") return <section className="detail-section" data-testid="detail-section-risk"><span className="detail-section-kicker">WHAT’S RISKY</span><h2 data-testid="detail-risk-title">A good story needs a way to be wrong.</h2><div className="risk-callout"><ShieldAlert size={20} /><p data-testid="detail-risk-copy">{company.risk}</p></div><div className="detail-highlight-grid"><article><strong>What could break the chain</strong><p>{company.what_breaks_chain}</p></article><article><strong>Profit can change if</strong><p>{company.profit_sensitivity}</p></article></div>{movement && <div className="verified-movement" data-testid="detail-risk-movement"><span>VERIFIED PRICE BEHAVIOUR · NOT A CAUSE</span><strong>{movement.percent >= 0 ? "+" : ""}{movement.percent.toFixed(1)}%</strong><p>{movement.start_date} → {movement.end_date}. Inspect filings and announcements around the dates before forming an explanation.</p></div>}</section>;
  if (section === "model") return <section className="detail-section" data-testid="detail-section-model"><span className="detail-section-kicker">HOW IT MAKES MONEY</span><h2 data-testid="detail-model-title">Follow the revenue before the stock.</h2><p className="detail-lead" data-testid="detail-business-model">{company.business_model}</p><div className="revenue-chain"><div><span>01</span><strong>Behaviour</strong><p>{company.behavior_change}</p></div><div><span>02</span><strong>Revenue</strong><p>{company.revenue_driver}</p></div><div><span>03</span><strong>Profit</strong><p>{company.profit_sensitivity}</p></div></div></section>;
  if (section === "scorecard") return <section className="detail-section" data-testid="detail-section-scorecard"><span className="detail-section-kicker">FULL QUALITY SCORECARD · AI JUDGMENT</span><h2 data-testid="detail-scorecard-title">Four lenses, not one verdict.</h2><QualityScorecard company={company} /></section>;
  if (section === "market") return <section className="detail-section" data-testid="detail-section-market"><span className="detail-section-kicker">VERIFIED MARKET JOURNEY · YAHOO FINANCE</span><h2 data-testid="detail-market-title">Five years of adjusted prices.</h2>{company.historical.available ? <><PriceChart points={company.historical.points} ticker={company.ticker} /><div className="detail-market-meta"><span>{company.historical.period_start} → {company.historical.period_end}</span><span>As of {company.historical.as_of}</span><span>{company.historical.status}</span></div>{company.historical.corporate_actions.length > 0 && <div className="detail-actions"><strong>Corporate actions returned</strong>{company.historical.corporate_actions.slice(-6).map((action) => <span key={`${action.date}-${action.type}`}>{action.date} · {action.type.replace("_", " ")} {action.label}</span>)}</div>}<p className="detail-source-note">Adjusted close · {company.historical.note}</p></> : <p className="detail-unavailable" data-testid="detail-market-unavailable">Historical price data is unavailable right now. No movement or return is being estimated.</p>}</section>;
  if (section === "verify") return <section className="detail-section" data-testid="detail-section-verify"><span className="detail-section-kicker">VERIFY THIS YOURSELF</span><h2 data-testid="detail-verify-title">Turn the clue into a research list.</h2><p className="detail-lead" data-testid="detail-verify-tip">{company.verify_tip}</p><div className="verify-list">{company.research_checks.map((check, checkIndex) => <p key={check} data-testid={`detail-research-check-${checkIndex + 1}`}><span>0{checkIndex + 1}</span>{check}</p>)}</div><div className="detail-research-actions"><button type="button" className={saved ? "field-note-button saved" : "field-note-button"} onClick={onSave} data-testid="detail-save-field-note-button">{saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{saved ? "Saved to My Discoveries" : "Save as field note"}</button><a href={`https://www.screener.in/company/${encodeURIComponent(company.ticker)}/consolidated/`} target="_blank" rel="noreferrer" className="screener-link" onClick={onScreener} data-testid="detail-screener-link">See full fundamentals on Screener <ExternalLink size={14} /></a></div></section>;
  return <section className="detail-instinct" data-testid="detail-section-instinct">{answer ? <div className="instinct-complete"><Sparkles size={20} /><span className="detail-section-kicker">INSTINCT CHECK COMPLETE</span><h2 data-testid="instinct-result-title">{answer.skipped ? "You skipped it—nothing was locked." : answer.matched ? "Your read matched this framework." : "Your read differed. That’s a useful question."}</h2><p data-testid="instinct-result-copy">The point is to notice which business assumption shaped your answer—not to measure investing skill, suitability, or predictive ability.</p><div className="instinct-result-actions"><Button type="button" onClick={onExploreAfterInstinct} data-testid="instinct-explore-details-button">Explore details <ArrowRight size={14} /></Button><Button type="button" variant="outline" onClick={onBackAfterInstinct} data-testid="instinct-back-results-button">Back to all companies</Button></div></div> : <InteractionPanel company={company} index={index} onComplete={onAnswer} />}</section>;
}

const DETAIL_MENU: { key: DetailSection; label: string; icon: typeof Search }[] = [
  { key: "standout", label: "What stands out", icon: Sparkles },
  { key: "risk", label: "What’s risky", icon: ShieldAlert },
  { key: "model", label: "How it makes money", icon: Building2 },
  { key: "scorecard", label: "Full scorecard", icon: ListChecks },
  { key: "market", label: "Stock journey", icon: BarChart3 },
  { key: "verify", label: "Verify it yourself", icon: Search },
  { key: "instinct", label: "Test your instinct", icon: Target },
];

function CompanyDetail({ idea, company, index, initialSection, answer, onAnswer, onBack, onSavedChange }: { idea: IdeaResponse; company: CompanyInsight; index: number; initialSection: DetailSection; answer?: AnswerRecord; onAnswer: (answer: AnswerRecord) => void; onBack: () => void; onSavedChange: (ticker: string, saved: boolean) => void }) {
  const [section, setSection] = useState<DetailSection>(initialSection);
  const { track } = useEngagement();
  const recordAnswer = useMutation({ mutationFn: (payload: Record<string, unknown>) => apiPost<{ recorded: boolean }>("/gut-checks", payload) });
  const saveNote = useMutation({ mutationFn: (saved: boolean) => apiPost<{ recorded: boolean }>(`/ideas/${idea.id}/field-notes`, { ticker: company.ticker, saved }) });
  const saved = idea.saved_tickers.includes(company.ticker);
  const chooseSection = (next: DetailSection) => { setSection(next); track({ event_name: "detail_section_opened", idea_id: idea.id, ticker: company.ticker, stage: next }); };
  const completeAnswer = (record: AnswerRecord, metricDistance?: number) => {
    onAnswer(record);
    recordAnswer.mutate({ idea_id: idea.id, ticker: company.ticker, question_format: record.format, answer: record.answer, skipped: record.skipped, matched: record.matched, metric_distance: metricDistance });
    track({ event_name: record.skipped ? "question_skipped" : "question_answered", idea_id: idea.id, ticker: company.ticker, stage: "optional_instinct", properties: { format: record.format, matched: record.matched } });
  };
  return <main className="company-detail-page" data-testid="company-detail-page"><header className="detail-header"><button type="button" onClick={onBack} data-testid="detail-back-button"><ArrowLeft size={16} /> Back to all companies</button><a href="/" className="wordmark detail-wordmark">Aaspaas<span>.</span></a><span className="detail-company-count">{index + 1} / {idea.companies.length}</span></header><section className="detail-company-hero"><div><span className="detail-section-kicker" data-testid="detail-company-ticker">{company.exchange} · {company.ticker} · {company.sector}</span><h1 data-testid="detail-company-name">{company.company_name}</h1><p data-testid="detail-company-connection">{company.connection}</p></div><Badge className={`strength-badge strength-${company.connection_strength}`}>{company.connection_strength} connection</Badge></section><nav className="detail-menu" aria-label="Company detail sections" data-testid="detail-menu">{DETAIL_MENU.map((item) => { const Icon = item.icon; return <button type="button" className={section === item.key ? "active" : ""} onClick={() => chooseSection(item.key)} key={item.key} data-testid={`detail-menu-${item.key}`}><Icon size={15} /><span>{item.label}</span>{item.key === "instinct" && <small>optional</small>}</button>; })}</nav><div className="detail-content-shell"><DetailContent section={section} company={company} index={index} answer={answer} saved={saved} onAnswer={completeAnswer} onSave={() => { const next = !saved; saveNote.mutate(next); onSavedChange(company.ticker, next); }} onScreener={() => track({ event_name: "screener_outbound_clicked", idea_id: idea.id, ticker: company.ticker })} onExploreAfterInstinct={() => chooseSection("standout")} onBackAfterInstinct={onBack} /></div><footer className="detail-footer" data-testid="detail-disclaimer">Educational context only—not a recommendation to buy or sell. Verify sourced numbers before acting.</footer></main>;
}

export function ComparisonExperience({ idea, answers, onAnswer, onCompanyUpdate, onSavedChange, onFinish }: { idea: IdeaResponse; answers: Record<string, AnswerRecord>; onAnswer: (ticker: string, answer: AnswerRecord) => void; onCompanyUpdate: (company: CompanyInsight) => void; onSavedChange: (ticker: string, saved: boolean) => void; onFinish: () => void }) {
  const [sort, setSort] = useState<SortKey>("quality");
  const [selected, setSelected] = useState<{ ticker: string; section: DetailSection } | null>(null);
  const qualitySectionRef = useRef<HTMLElement | null>(null);
  const continuationTracked = useRef(false);
  const performanceTracked = useRef(false);
  const performanceCardsTracked = useRef(new Set<string>());
  const { track } = useEngagement();
  const enrichment = useQueries({ queries: idea.companies.map((company) => ({ queryKey: ["enrichment", idea.id, company.ticker], queryFn: () => apiGet<EnrichmentResponse>(`/ideas/${idea.id}/companies/${company.ticker}/enrichment`), retry: 1 })) });
  const dataSignature = enrichment.map((query) => query.dataUpdatedAt).join(":");
  useEffect(() => {
    enrichment.forEach((query, index) => {
      if (!query.data) return;
      const company = idea.companies[index];
      if (company.enrichment_status === "pending") onCompanyUpdate({ ...company, finance: query.data.finance, historical: query.data.historical, enrichment_status: query.data.enrichment_status });
    });
  }, [dataSignature]);
  useEffect(() => {
    track({ event_name: "comparison_viewed", idea_id: idea.id, properties: { company_count: idea.companies.length } });
    if (!performanceTracked.current) {
      performanceTracked.current = true;
      track({ event_name: "performance_section_viewed", idea_id: idea.id, properties: { company_count: idea.companies.length, default_period: "5Y" } });
    }
  }, [idea.id]);
  useEffect(() => {
    const target = qualitySectionRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !continuationTracked.current) {
        continuationTracked.current = true;
        track({ event_name: "performance_to_quality_continued", idea_id: idea.id });
      }
    }, { threshold: .25 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [idea.id]);
  const companies = idea.companies.map((company, index) => enrichment[index].data ? { ...company, finance: enrichment[index].data!.finance, historical: enrichment[index].data!.historical, enrichment_status: enrichment[index].data!.enrichment_status } : company);
  useEffect(() => {
    companies.forEach((company, index) => {
      if (company.enrichment_status === "pending" || performanceCardsTracked.current.has(company.ticker)) return;
      performanceCardsTracked.current.add(company.ticker);
      track({ event_name: "performance_card_viewed", idea_id: idea.id, ticker: company.ticker, properties: { historical_status: company.historical.status, render_latency_ms: enrichment[index].data?.latency_ms ?? 0 } });
    });
  }, [dataSignature]);
  const sorted = rankBy(companies, sort);
  const selectedCompany = selected ? companies.find((company) => company.ticker === selected.ticker) : null;
  if (selected && selectedCompany) return <CompanyDetail key={`${selected.ticker}-${selected.section}`} idea={idea} company={selectedCompany} index={companies.findIndex((company) => company.ticker === selectedCompany.ticker)} initialSection={selected.section} answer={answers[selectedCompany.ticker]} onAnswer={(answer) => onAnswer(selectedCompany.ticker, answer)} onBack={() => setSelected(null)} onSavedChange={onSavedChange} />;
  const attempted = Object.values(answers).filter((answer) => !answer.skipped).length, matched = Object.values(answers).filter((answer) => answer.matched).length;
  const openPath = (ticker: string, section: DetailSection, surface: "performance" | "business") => {
    setSelected({ ticker, section });
    track({ event_name: "result_action_selected", idea_id: idea.id, ticker, properties: { action: section === "instinct" ? "intuition" : "details", surface } });
  };
  return <main className="comparison-page" data-testid="comparison-page"><SnapNav layoutKey={`${sort}:${sorted.map((company) => company.ticker).join(",")}`} /><div className="snap-panel" data-snap-panel="Your clue"><header className="comparison-header"><a href="/" className="wordmark" data-testid="comparison-wordmark">Aaspaas<span>.</span></a><div><a href="/discoveries" data-testid="comparison-journal-link">My Discoveries</a><span>Educational only · no trades</span></div></header><section className="comparison-intro"><div><span className="mono-label" data-testid="comparison-kicker">YOUR CLUE · {idea.observation_theme}</span><h1 data-testid="comparison-title">Three businesses.<br /><em>Two lenses.</em></h1><p data-testid="comparison-observation">“{idea.observation}”</p></div><div className="comparison-meta"><span data-testid="comparison-source-mode">{idea.discovery_mode === "ai" ? "Live AI company mapping" : "Curated fallback mapping"}</span><span data-testid="comparison-read-score">Optional reads matched: {matched}/{attempted}</span><span data-testid="comparison-remaining">{idea.daily_remaining} discoveries left today</span></div></section></div><PerformanceSection ideaId={idea.id} observation={idea.observation} companies={companies} loading={enrichment.map((query) => query.isLoading)} onExplore={(ticker) => openPath(ticker, "standout", "performance")} onIntuition={(ticker) => openPath(ticker, "instinct", "performance")} onPeriodChange={(period) => track({ event_name: "performance_period_selected", idea_id: idea.id, properties: { period } })} /><div className="snap-panel" data-snap-panel="Quality lenses"><section className="quality-transition" ref={qualitySectionRef} data-testid="quality-transition"><span className="mono-label">A DIFFERENT LENS</span><h2 data-testid="quality-transition-title">What the stock did is not<br /><em>what the business is.</em></h2><p data-testid="quality-transition-copy">Now set the price journey aside. Compare the moat, management, capital allocation, runway, and the real numbers underneath.</p></section><div className="comparison-toolbar" data-testid="comparison-toolbar"><p data-testid="comparison-help">Tap a lens to rank the business cards by it. The performance cards above always stay in AI relevance order.</p><CategoryCards companies={companies} active={sort} onSelect={(key) => { setSort(key); track({ event_name: "comparison_sorted", idea_id: idea.id, properties: { sort: key, control: "category_card" } }); }} /></div></div><section className="comparison-grid" data-testid="comparison-grid">{sorted.map((company, rank) => <div className="snap-panel" data-snap-panel={`${company.ticker} · business`} key={company.id}><ComparisonCard company={company} rank={rank + 1} sort={sort} loading={company.enrichment_status === "pending"} onExplore={() => openPath(company.ticker, "standout", "business")} onIntuition={() => openPath(company.ticker, "instinct", "business")} /></div>)}</section><div className="snap-panel" data-snap-panel="Wrap up"><div className="comparison-footer-actions"><Button onClick={onFinish} size="lg" data-testid="comparison-finish-button">Wrap up this discovery <ArrowRight size={17} /></Button><p data-testid="comparison-disclaimer">Scores are qualitative judgment. Yahoo Finance data can be delayed or incomplete. This is not a buy/sell recommendation.</p></div></div></main>;
}