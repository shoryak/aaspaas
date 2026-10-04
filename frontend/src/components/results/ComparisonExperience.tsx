import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BarChart3, Bookmark, BookmarkCheck, Building2, ExternalLink, Landmark, Lightbulb, ListChecks, Search, ShieldAlert, Sparkles, Target } from "lucide-react";

import { InteractionPanel } from "@/components/story/InteractionPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEngagement } from "@/hooks/useEngagement";
import { apiGet, apiPost } from "@/lib/api";
import { downsample, periodStats, pointsForPeriod, rupees, signedPercent, slug } from "@/lib/performance";
import type { PeriodKey } from "@/lib/performance";
import { PerformanceOverlayChart } from "@/components/results/PerformanceOverlayChart";
import { FinancialsSection } from "@/components/results/FinancialsSection";
import { PeerTable } from "@/components/results/PeerTable";
import { crore, pct } from "@/lib/fundamentals";
import { SnapNav } from "@/components/results/SnapNav";
import { ResultsTour } from "@/components/LandingTour";
import { Compass } from "lucide-react";
import { AddToPortfolioButton } from "@/components/AddToPortfolio";
import { HeaderNav } from "@/components/HeaderNav";
import { ThinkingPartnerButton } from "@/components/ThinkingPartner";
import { LessonLink } from "@/components/Video";
import { LESSON_FOR } from "@/lib/learn";
import type { AnswerRecord, CompanyInsight, EnrichmentResponse, IdeaResponse, MarketContextResponse, PricePoint } from "@/lib/types";

type DetailSection = "standout" | "risk" | "model" | "scorecard" | "financials" | "market" | "verify" | "instinct";

const number = (value: number | null) => value === null ? "—" : value.toFixed(1);

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
  return <article className="performance-card" data-testid={`performance-card-${slug(company.ticker)}`}><div className="performance-card-top"><div><span className="performance-ticker" data-testid={`performance-ticker-${slug(company.ticker)}`}>{company.exchange} · {company.ticker}</span><h3 data-testid={`performance-name-${slug(company.ticker)}`}>{company.company_name}</h3></div><Badge className={`status-badge status-${company.historical.status}`} data-testid={`performance-status-${slug(company.ticker)}`}>{company.historical.status}</Badge></div>{loading ? <div className="performance-skeleton" data-testid={`performance-loading-${slug(company.ticker)}`}><i /><i /><i /></div> : stats && company.historical.available ? <><PerformanceMiniChart key={period} points={points} ticker={company.ticker} /><div className="performance-price-row" data-testid={`performance-prices-${slug(company.ticker)}`}><span>Share price</span><strong>{rupees(stats.startPrice)}</strong><ArrowRight size={13} /><strong>{rupees(stats.endPrice)}</strong></div><div className="performance-stat-row"><div><span>Total adjusted movement</span><strong className={stats.movement >= 0 ? "movement-positive" : "movement-negative"} data-testid={`performance-movement-${slug(company.ticker)}`}>{signedPercent(stats.movement)}</strong></div><div><span>Maximum drawdown</span><strong className="movement-negative" data-testid={`performance-drawdown-${slug(company.ticker)}`}>{`${stats.drawdown.toFixed(1)}%`}</strong></div></div><div className="performance-dates" data-testid={`performance-dates-${slug(company.ticker)}`}><span>{stats.start}</span><ArrowRight size={12} /><span>{stats.end}</span></div></> : <div className="performance-unavailable" data-testid={`performance-unavailable-${slug(company.ticker)}`}><BarChart3 size={22} /><strong>Price history unavailable</strong><p>No movement is estimated. Business context remains available below.</p></div>}<p className="performance-source" data-testid={`performance-source-${slug(company.ticker)}`}>Yahoo Finance · adjusted close in ₹ · as of {company.historical.as_of ?? "unavailable"}</p><div className="company-card-actions performance-actions" data-testid={`performance-actions-${slug(company.ticker)}`}><Button type="button" onClick={onExplore} data-testid={`performance-explore-${slug(company.ticker)}`}>Explore details <ArrowRight size={14} /></Button><Button type="button" variant="outline" onClick={onIntuition} data-testid={`performance-intuition-${slug(company.ticker)}`}>Test your intuition <Target size={14} /></Button><AddToPortfolioButton company={{ ticker: company.ticker, exchange: company.exchange, company_name: company.company_name, sector: company.sector }} testId={`performance-add-${slug(company.ticker)}`} /></div></article>;
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

export function BusinessLenses({ company }: { company: CompanyInsight }) {
  return <div className="detail-scorecard lens-list" data-testid={`detail-lenses-${slug(company.ticker)}`}>{company.scorecard.map((axis) => <div className="detail-axis lens-note" key={axis.key} data-testid={`detail-lens-${axis.key}`}><span>{axis.label}</span><p>{axis.rationale}</p>{LESSON_FOR[axis.key] && <LessonLink slug={LESSON_FOR[axis.key].slug} number={LESSON_FOR[axis.key].number} testId={`lens-lesson-${axis.key}`} />}</div>)}</div>;
}

function DetailContent({ ideaId, section, company, index, answer, saved, onAnswer, onSave, onScreener, onExploreAfterInstinct, onBackAfterInstinct }: { ideaId: string; section: DetailSection; company: CompanyInsight; index: number; answer?: AnswerRecord; saved: boolean; onAnswer: (record: AnswerRecord, metricDistance?: number) => void; onSave: () => void; onScreener: () => void; onExploreAfterInstinct: () => void; onBackAfterInstinct: () => void }) {
  const movement = [company.historical.largest_day, company.historical.largest_month, company.historical.max_drawdown].filter(Boolean).sort((a, b) => Math.abs(b!.percent) - Math.abs(a!.percent))[0];
  if (section === "standout") return <section className="detail-section" data-testid="detail-section-standout"><span className="detail-section-kicker">WHAT STANDS OUT</span><h2 data-testid="detail-standout-title">The strongest part of the connection.</h2><p className="detail-lead" data-testid="detail-standout-copy">{company.connection}</p><div className="detail-highlight-grid"><article><Lightbulb size={17} /><strong>Moat read</strong><p>{company.scorecard.find((axis) => axis.key === "moat")?.rationale}</p></article><article><Target size={17} /><strong>What has to be true</strong><p>{company.what_must_be_true}</p></article></div><div className="detail-fact-row" data-testid="detail-fact-row"><span>P/E <strong>{number(company.finance.pe_ratio)}</strong></span><span>Market cap <strong>{crore(company.finance.market_cap)}</strong></span><span>ROE <strong>{pct(company.finance.roe)}</strong></span><span>Data <strong>{company.finance.status}</strong></span></div></section>;
  if (section === "risk") return <section className="detail-section" data-testid="detail-section-risk"><span className="detail-section-kicker">WHAT’S RISKY</span><h2 data-testid="detail-risk-title">A good story needs a way to be wrong.</h2><div className="risk-callout"><ShieldAlert size={20} /><p data-testid="detail-risk-copy">{company.risk}</p></div><div className="detail-highlight-grid"><article><strong>What could break the chain</strong><p>{company.what_breaks_chain}</p></article><article><strong>Profit can change if</strong><p>{company.profit_sensitivity}</p></article></div>{movement && <div className="verified-movement" data-testid="detail-risk-movement"><span>VERIFIED PRICE BEHAVIOUR · NOT A CAUSE</span><strong>{movement.percent >= 0 ? "+" : ""}{movement.percent.toFixed(1)}%</strong><p>{movement.start_date} → {movement.end_date}. Inspect filings and announcements around the dates before forming an explanation.</p></div>}</section>;
  if (section === "model") return <section className="detail-section" data-testid="detail-section-model"><span className="detail-section-kicker">HOW IT MAKES MONEY</span><h2 data-testid="detail-model-title">Follow the revenue before the stock.</h2><p className="detail-lead" data-testid="detail-business-model">{company.business_model}</p><div className="revenue-chain"><div><span>01</span><strong>Behaviour</strong><p>{company.behavior_change}</p></div><div><span>02</span><strong>Revenue</strong><p>{company.revenue_driver}</p></div><div><span>03</span><strong>Profit</strong><p>{company.profit_sensitivity}</p></div></div></section>;
  if (section === "scorecard") return <section className="detail-section" data-testid="detail-section-scorecard"><span className="detail-section-kicker ai-kicker">BUSINESS LENSES · AI-WRITTEN CONTEXT, NOT A SCORE</span><h2 data-testid="detail-scorecard-title">Four lenses, not one verdict.</h2><BusinessLenses company={company} /><p className="detail-source-note">Written notes to question, not ratings. Check them against the sourced numbers in Financials and the peer table.</p></section>;
  if (section === "financials") return <FinancialsSection company={company} ideaId={ideaId} />;
  if (section === "market") return <section className="detail-section" data-testid="detail-section-market"><span className="detail-section-kicker">VERIFIED MARKET JOURNEY · YAHOO FINANCE</span><h2 data-testid="detail-market-title">Five years of adjusted prices.</h2>{company.historical.available ? <><PriceChart points={company.historical.points} ticker={company.ticker} /><div className="detail-market-meta"><span>{company.historical.period_start} → {company.historical.period_end}</span><span>As of {company.historical.as_of}</span><span>{company.historical.status}</span></div>{company.historical.corporate_actions.length > 0 && <div className="detail-actions"><strong>Corporate actions returned</strong>{company.historical.corporate_actions.slice(-6).map((action) => <span key={`${action.date}-${action.type}`}>{action.date} · {action.type.replace("_", " ")} {action.label}</span>)}</div>}<p className="detail-source-note">Adjusted close · {company.historical.note}</p></> : <p className="detail-unavailable" data-testid="detail-market-unavailable">Historical price data is unavailable right now. No movement or return is being estimated.</p>}</section>;
  if (section === "verify") return <section className="detail-section" data-testid="detail-section-verify"><span className="detail-section-kicker">VERIFY THIS YOURSELF</span><h2 data-testid="detail-verify-title">Turn the clue into a research list.</h2><p className="detail-lead" data-testid="detail-verify-tip">{company.verify_tip}</p><div className="verify-list">{company.research_checks.map((check, checkIndex) => <p key={check} data-testid={`detail-research-check-${checkIndex + 1}`}><span>0{checkIndex + 1}</span>{check}</p>)}</div><div className="detail-research-actions"><button type="button" className={saved ? "field-note-button saved" : "field-note-button"} onClick={onSave} data-testid="detail-save-field-note-button">{saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{saved ? "Saved to My Discoveries" : "Save as field note"}</button><a href={`https://www.screener.in/company/${encodeURIComponent(company.ticker)}/consolidated/`} target="_blank" rel="noreferrer" className="screener-link" onClick={onScreener} data-testid="detail-screener-link">See full fundamentals on Screener <ExternalLink size={14} /></a></div></section>;
  return <section className="detail-instinct" data-testid="detail-section-instinct">{answer ? <div className="instinct-complete"><Sparkles size={20} /><span className="detail-section-kicker">INSTINCT CHECK COMPLETE</span><h2 data-testid="instinct-result-title">{answer.skipped ? "You skipped it—nothing was locked." : answer.matched ? "Your read matched this framework." : "Your read differed. That’s a useful question."}</h2><p data-testid="instinct-result-copy">The point is to notice which business assumption shaped your answer—not to measure investing skill, suitability, or predictive ability.</p><div className="instinct-result-actions"><Button type="button" onClick={onExploreAfterInstinct} data-testid="instinct-explore-details-button">Explore details <ArrowRight size={14} /></Button><Button type="button" variant="outline" onClick={onBackAfterInstinct} data-testid="instinct-back-results-button">Back to all companies</Button></div></div> : <InteractionPanel company={company} index={index} onComplete={onAnswer} />}</section>;
}

const DETAIL_MENU: { key: DetailSection; label: string; icon: typeof Search }[] = [
  { key: "standout", label: "What stands out", icon: Sparkles },
  { key: "risk", label: "What’s risky", icon: ShieldAlert },
  { key: "model", label: "How it makes money", icon: Building2 },
  { key: "financials", label: "Financials", icon: Landmark },
  { key: "scorecard", label: "Business lenses", icon: ListChecks },
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
  return <main className="company-detail-page" data-testid="company-detail-page"><header className="detail-header"><button type="button" onClick={onBack} data-testid="detail-back-button"><ArrowLeft size={16} /> Back to all companies</button><a href="/" className="wordmark detail-wordmark">Aaspaas<span>.</span></a><span className="detail-company-count">{index + 1} / {idea.companies.length}</span></header><section className="detail-company-hero"><div><span className="detail-section-kicker" data-testid="detail-company-ticker">{company.exchange} · {company.ticker} · {company.sector}</span><h1 data-testid="detail-company-name">{company.company_name}</h1><p data-testid="detail-company-connection">{company.connection}</p></div><div className="detail-hero-actions"><Badge className={`strength-badge strength-${company.connection_strength}`}>{company.connection_strength} connection</Badge><AddToPortfolioButton company={{ ticker: company.ticker, exchange: company.exchange, company_name: company.company_name, sector: company.sector }} testId="detail-add-portfolio" /><ThinkingPartnerButton company={{ ticker: company.ticker, exchange: company.exchange, company_name: company.company_name, idea_id: idea.id }} surface="detail" testId="detail-partner-button" /></div></section><nav className="detail-menu" aria-label="Company detail sections" data-testid="detail-menu">{DETAIL_MENU.map((item) => { const Icon = item.icon; return <button type="button" className={section === item.key ? "active" : ""} onClick={() => chooseSection(item.key)} key={item.key} data-testid={`detail-menu-${item.key}`}><Icon size={15} /><span>{item.label}</span>{item.key === "instinct" && <small>optional</small>}</button>; })}</nav><div className="detail-content-shell"><DetailContent ideaId={idea.id} section={section} company={company} index={index} answer={answer} saved={saved} onAnswer={completeAnswer} onSave={() => { const next = !saved; saveNote.mutate(next); onSavedChange(company.ticker, next); }} onScreener={() => track({ event_name: "screener_outbound_clicked", idea_id: idea.id, ticker: company.ticker })} onExploreAfterInstinct={() => chooseSection("standout")} onBackAfterInstinct={onBack} /></div><footer className="detail-footer" data-testid="detail-disclaimer">Educational context only—not a recommendation to buy or sell. Verify sourced numbers before acting.</footer></main>;
}

export function ComparisonExperience({ idea, answers, onAnswer, onCompanyUpdate, onSavedChange, onFinish }: { idea: IdeaResponse; answers: Record<string, AnswerRecord>; onAnswer: (ticker: string, answer: AnswerRecord) => void; onCompanyUpdate: (company: CompanyInsight) => void; onSavedChange: (ticker: string, saved: boolean) => void; onFinish: () => void }) {
  const [selected, setSelected] = useState<{ ticker: string; section: DetailSection } | null>(null);
  const performanceTracked = useRef(false);
  const performanceCardsTracked = useRef(new Set<string>());
  const { track } = useEngagement();
  const [resultsTour, setResultsTour] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("aaspaas-results-tour-done")) return;
    const timer = window.setTimeout(() => setResultsTour(true), 1400);
    return () => window.clearTimeout(timer);
  }, []);
  const closeResultsTour = ({ completed, tasksDone }: { completed: boolean; tasksDone: number }) => {
    setResultsTour(false);
    localStorage.setItem("aaspaas-results-tour-done", "1");
    track({ event_name: completed ? "results_tour_completed" : "results_tour_skipped", idea_id: idea.id, properties: { tasks_done: tasksDone } });
  };
  const tour = <ResultsTour open={resultsTour} onClose={closeResultsTour} />;
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
  const companies = idea.companies.map((company, index) => enrichment[index].data ? { ...company, finance: enrichment[index].data!.finance, historical: enrichment[index].data!.historical, enrichment_status: enrichment[index].data!.enrichment_status } : company);
  useEffect(() => {
    companies.forEach((company, index) => {
      if (company.enrichment_status === "pending" || performanceCardsTracked.current.has(company.ticker)) return;
      performanceCardsTracked.current.add(company.ticker);
      track({ event_name: "performance_card_viewed", idea_id: idea.id, ticker: company.ticker, properties: { historical_status: company.historical.status, render_latency_ms: enrichment[index].data?.latency_ms ?? 0 } });
    });
  }, [dataSignature]);
  const selectedCompany = selected ? companies.find((company) => company.ticker === selected.ticker) : null;
  if (selected && selectedCompany) return <>{tour}<CompanyDetail key={`${selected.ticker}-${selected.section}`} idea={idea} company={selectedCompany} index={companies.findIndex((company) => company.ticker === selectedCompany.ticker)} initialSection={selected.section} answer={answers[selectedCompany.ticker]} onAnswer={(answer) => onAnswer(selectedCompany.ticker, answer)} onBack={() => setSelected(null)} onSavedChange={onSavedChange} /></>;
  const attempted = Object.values(answers).filter((answer) => !answer.skipped).length, matched = Object.values(answers).filter((answer) => answer.matched).length;
  const openPath = (ticker: string, section: DetailSection, surface: "performance" | "peer_table") => {
    setSelected({ ticker, section });
    track({ event_name: "result_action_selected", idea_id: idea.id, ticker, properties: { action: section === "instinct" ? "intuition" : "details", surface } });
  };
  return <>{tour}<main className="comparison-page" data-testid="comparison-page"><SnapNav layoutKey={companies.map((company) => company.ticker).join(",")} /><div className="snap-panel" data-snap-panel="Your clue"><header className="comparison-header"><a href="/" className="wordmark" data-testid="comparison-wordmark">Aaspaas<span>.</span></a><div><HeaderNav /><button type="button" className="results-tour-button" onClick={() => { setResultsTour(true); track({ event_name: "results_tour_replayed", idea_id: idea.id }); }} aria-label="How this page works" data-testid="results-tour-button"><Compass size={15} /><span>How this works</span></button><span>Educational only · no trades</span></div></header><section className="comparison-intro"><div><span className="mono-label" data-testid="comparison-kicker">YOUR CLUE · {idea.observation_theme}</span><h1 data-testid="comparison-title">Three businesses.<br /><em>Their rivals. Real numbers.</em></h1><p data-testid="comparison-observation">“{idea.observation}”</p></div><div className="comparison-meta"><span data-testid="comparison-source-mode">{idea.discovery_mode === "ai" ? "Live AI company mapping" : "Curated fallback mapping"}</span><span data-testid="comparison-read-score">Optional reads matched: {matched}/{attempted}</span><span data-testid="comparison-remaining">{idea.daily_remaining} discoveries left today</span></div></section></div><PerformanceSection ideaId={idea.id} observation={idea.observation} companies={companies} loading={enrichment.map((query) => query.isLoading)} onExplore={(ticker) => openPath(ticker, "standout", "performance")} onIntuition={(ticker) => openPath(ticker, "instinct", "performance")} onPeriodChange={(period) => track({ event_name: "performance_period_selected", idea_id: idea.id, properties: { period } })} /><div className="snap-panel snap-panel-tall" data-snap-panel="Peer table"><PeerTable ideaId={idea.id} companies={companies} onOpenCompany={(ticker) => openPath(ticker, "standout", "peer_table")} /></div><div className="snap-panel" data-snap-panel="Wrap up"><div className="comparison-footer-actions"><Button onClick={onFinish} size="lg" data-testid="comparison-finish-button">Wrap up this discovery <ArrowRight size={17} /></Button><p data-testid="comparison-disclaimer">Business lenses and rival reasons are AI-written context, never scores. Yahoo Finance data can be delayed or incomplete. This is not a buy/sell recommendation.</p></div></div></main></>;
}