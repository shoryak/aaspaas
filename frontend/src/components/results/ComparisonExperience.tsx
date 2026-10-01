import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BarChart3, Bookmark, BookmarkCheck, Building2, ExternalLink, Lightbulb, ListChecks, Search, ShieldAlert, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";

import { InteractionPanel } from "@/components/story/InteractionPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEngagement } from "@/hooks/useEngagement";
import { apiGet, apiPost } from "@/lib/api";
import type { AnswerRecord, CompanyInsight, EnrichmentResponse, IdeaResponse, PricePoint, ScoreAxis } from "@/lib/types";

type SortKey = "quality" | "moat" | "pe" | "market_cap";
type DetailSection = "standout" | "risk" | "model" | "scorecard" | "market" | "verify" | "instinct";

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const averageScore = (company: CompanyInsight) => company.scorecard.reduce((sum, axis) => sum + axis.score, 0) / Math.max(company.scorecard.length, 1);
const axisScore = (company: CompanyInsight, key: ScoreAxis["key"]) => company.scorecard.find((axis) => axis.key === key)?.score ?? 0;
const marketCap = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const number = (value: number | null) => value === null ? "—" : value.toFixed(1);
const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;

function MiniPips({ score, label, testId }: { score: number; label: string; testId: string }) {
  return <div className="comparison-pip-row" data-testid={testId}><span data-testid={`${testId}-label`}>{label}</span><div aria-label={`${label}: ${score} out of 5`} data-testid={`${testId}-pips`}>{[1, 2, 3, 4, 5].map((pip) => <i key={pip} className={pip <= score ? "filled" : ""} />)}</div></div>;
}

function ComparisonCard({ company, rank, loading, onOpen }: { company: CompanyInsight; rank: number; loading: boolean; onOpen: () => void }) {
  return <article className="comparison-card" data-testid={`comparison-card-${slug(company.ticker)}`}>
    <button type="button" className="comparison-card-button" onClick={onOpen} data-testid={`open-company-${slug(company.ticker)}`}>
      <div className="comparison-rank-row"><span data-testid={`comparison-rank-${slug(company.ticker)}`}>#{rank}</span><Badge className={`strength-badge strength-${company.connection_strength}`} data-testid={`comparison-strength-${slug(company.ticker)}`}>{company.connection_strength}</Badge></div>
      <p className="comparison-ticker" data-testid={`comparison-ticker-${slug(company.ticker)}`}>{company.exchange} · {company.ticker}</p>
      <h2 data-testid={`comparison-name-${slug(company.ticker)}`}>{company.company_name}</h2>
      <p className="comparison-connection" data-testid={`comparison-connection-${slug(company.ticker)}`}>{company.connection}</p>
      <div className="comparison-score" data-testid={`comparison-score-${slug(company.ticker)}`}><strong>{averageScore(company).toFixed(1)}</strong><span>quality read / 5</span></div>
      <div className="comparison-pips" data-testid={`comparison-pips-${slug(company.ticker)}`}>
        <MiniPips score={axisScore(company, "moat")} label="Moat" testId={`mini-moat-${slug(company.ticker)}`} />
        <MiniPips score={axisScore(company, "capital_allocation")} label="Capital" testId={`mini-capital-${slug(company.ticker)}`} />
        <MiniPips score={axisScore(company, "management")} label="Management" testId={`mini-management-${slug(company.ticker)}`} />
        <MiniPips score={axisScore(company, "growth_runway")} label="Growth" testId={`mini-growth-${slug(company.ticker)}`} />
      </div>
      {loading ? <div className="comparison-data-skeleton" data-testid={`comparison-data-loading-${slug(company.ticker)}`}><i /><i /></div> : <div className="comparison-data-chips" data-testid={`comparison-data-${slug(company.ticker)}`}><span>P/E <strong>{number(company.finance.pe_ratio)}</strong></span><span>Market cap <strong>{marketCap(company.finance.market_cap)}</strong></span></div>}
      <span className="comparison-open-label" data-testid={`comparison-open-label-${slug(company.ticker)}`}>Explore this company <ArrowRight size={15} /></span>
    </button>
  </article>;
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

function DetailContent({ section, company, index, answer, saved, onAnswer, onSave, onScreener }: { section: DetailSection; company: CompanyInsight; index: number; answer?: AnswerRecord; saved: boolean; onAnswer: (record: AnswerRecord, metricDistance?: number) => void; onSave: () => void; onScreener: () => void }) {
  const movement = [company.historical.largest_day, company.historical.largest_month, company.historical.max_drawdown].filter(Boolean).sort((a, b) => Math.abs(b!.percent) - Math.abs(a!.percent))[0];
  if (section === "standout") return <section className="detail-section" data-testid="detail-section-standout"><span className="detail-section-kicker">WHAT STANDS OUT</span><h2 data-testid="detail-standout-title">The strongest part of the connection.</h2><p className="detail-lead" data-testid="detail-standout-copy">{company.connection}</p><div className="detail-highlight-grid"><article><Lightbulb size={17} /><strong>Moat read</strong><p>{company.scorecard.find((axis) => axis.key === "moat")?.rationale}</p></article><article><Target size={17} /><strong>What has to be true</strong><p>{company.what_must_be_true}</p></article></div><div className="detail-fact-row" data-testid="detail-fact-row"><span>P/E <strong>{number(company.finance.pe_ratio)}</strong></span><span>Market cap <strong>{marketCap(company.finance.market_cap)}</strong></span><span>ROE <strong>{percent(company.finance.roe)}</strong></span><span>Data <strong>{company.finance.status}</strong></span></div></section>;
  if (section === "risk") return <section className="detail-section" data-testid="detail-section-risk"><span className="detail-section-kicker">WHAT’S RISKY</span><h2 data-testid="detail-risk-title">A good story needs a way to be wrong.</h2><div className="risk-callout"><ShieldAlert size={20} /><p data-testid="detail-risk-copy">{company.risk}</p></div><div className="detail-highlight-grid"><article><strong>What could break the chain</strong><p>{company.what_breaks_chain}</p></article><article><strong>Profit can change if</strong><p>{company.profit_sensitivity}</p></article></div>{movement && <div className="verified-movement" data-testid="detail-risk-movement"><span>VERIFIED PRICE BEHAVIOUR · NOT A CAUSE</span><strong>{movement.percent >= 0 ? "+" : ""}{movement.percent.toFixed(1)}%</strong><p>{movement.start_date} → {movement.end_date}. Inspect filings and announcements around the dates before forming an explanation.</p></div>}</section>;
  if (section === "model") return <section className="detail-section" data-testid="detail-section-model"><span className="detail-section-kicker">HOW IT MAKES MONEY</span><h2 data-testid="detail-model-title">Follow the revenue before the stock.</h2><p className="detail-lead" data-testid="detail-business-model">{company.business_model}</p><div className="revenue-chain"><div><span>01</span><strong>Behaviour</strong><p>{company.behavior_change}</p></div><div><span>02</span><strong>Revenue</strong><p>{company.revenue_driver}</p></div><div><span>03</span><strong>Profit</strong><p>{company.profit_sensitivity}</p></div></div></section>;
  if (section === "scorecard") return <section className="detail-section" data-testid="detail-section-scorecard"><span className="detail-section-kicker">FULL QUALITY SCORECARD · AI JUDGMENT</span><h2 data-testid="detail-scorecard-title">Four lenses, not one verdict.</h2><QualityScorecard company={company} /></section>;
  if (section === "market") return <section className="detail-section" data-testid="detail-section-market"><span className="detail-section-kicker">VERIFIED MARKET JOURNEY · YAHOO FINANCE</span><h2 data-testid="detail-market-title">Five years of adjusted prices.</h2>{company.historical.available ? <><PriceChart points={company.historical.points} ticker={company.ticker} /><div className="detail-market-meta"><span>{company.historical.period_start} → {company.historical.period_end}</span><span>As of {company.historical.as_of}</span><span>{company.historical.status}</span></div>{company.historical.corporate_actions.length > 0 && <div className="detail-actions"><strong>Corporate actions returned</strong>{company.historical.corporate_actions.slice(-6).map((action) => <span key={`${action.date}-${action.type}`}>{action.date} · {action.type.replace("_", " ")} {action.label}</span>)}</div>}<p className="detail-source-note">Adjusted close · {company.historical.note}</p></> : <p className="detail-unavailable" data-testid="detail-market-unavailable">Historical price data is unavailable right now. No movement or return is being estimated.</p>}</section>;
  if (section === "verify") return <section className="detail-section" data-testid="detail-section-verify"><span className="detail-section-kicker">VERIFY THIS YOURSELF</span><h2 data-testid="detail-verify-title">Turn the clue into a research list.</h2><p className="detail-lead" data-testid="detail-verify-tip">{company.verify_tip}</p><div className="verify-list">{company.research_checks.map((check, checkIndex) => <p key={check} data-testid={`detail-research-check-${checkIndex + 1}`}><span>0{checkIndex + 1}</span>{check}</p>)}</div><div className="detail-research-actions"><button type="button" className={saved ? "field-note-button saved" : "field-note-button"} onClick={onSave} data-testid="detail-save-field-note-button">{saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{saved ? "Saved to My Discoveries" : "Save as field note"}</button><a href={`https://www.screener.in/company/${encodeURIComponent(company.ticker)}/consolidated/`} target="_blank" rel="noreferrer" className="screener-link" onClick={onScreener} data-testid="detail-screener-link">See full fundamentals on Screener <ExternalLink size={14} /></a></div></section>;
  return <section className="detail-instinct" data-testid="detail-section-instinct">{answer ? <div className="instinct-complete"><Sparkles size={20} /><span className="detail-section-kicker">INSTINCT CHECK COMPLETE</span><h2>{answer.skipped ? "You skipped it—nothing was locked." : answer.matched ? "Your read matched this framework." : "Your read differed. That’s a useful question."}</h2><p>This is engagement and practice, not a measure of investing skill or suitability.</p></div> : <InteractionPanel company={company} index={index} onComplete={onAnswer} />}</section>;
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

function CompanyDetail({ idea, company, index, answer, onAnswer, onBack, onCompanyUpdate, onSavedChange }: { idea: IdeaResponse; company: CompanyInsight; index: number; answer?: AnswerRecord; onAnswer: (answer: AnswerRecord) => void; onBack: () => void; onCompanyUpdate: (company: CompanyInsight) => void; onSavedChange: (ticker: string, saved: boolean) => void }) {
  const [section, setSection] = useState<DetailSection>("standout");
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
  return <main className="company-detail-page" data-testid="company-detail-page"><header className="detail-header"><button type="button" onClick={onBack} data-testid="detail-back-button"><ArrowLeft size={16} /> Back to comparison</button><a href="/" className="wordmark detail-wordmark">Aaspaas<span>.</span></a><span className="detail-company-count">{index + 1} / {idea.companies.length}</span></header><section className="detail-company-hero"><div><span className="detail-section-kicker" data-testid="detail-company-ticker">{company.exchange} · {company.ticker} · {company.sector}</span><h1 data-testid="detail-company-name">{company.company_name}</h1><p data-testid="detail-company-connection">{company.connection}</p></div><Badge className={`strength-badge strength-${company.connection_strength}`}>{company.connection_strength} connection</Badge></section><nav className="detail-menu" aria-label="Company detail sections" data-testid="detail-menu">{DETAIL_MENU.map((item) => { const Icon = item.icon; return <button type="button" className={section === item.key ? "active" : ""} onClick={() => chooseSection(item.key)} key={item.key} data-testid={`detail-menu-${item.key}`}><Icon size={15} /><span>{item.label}</span>{item.key === "instinct" && <small>optional</small>}</button>; })}</nav><div className="detail-content-shell"><DetailContent section={section} company={company} index={index} answer={answer} saved={saved} onAnswer={completeAnswer} onSave={() => { const next = !saved; saveNote.mutate(next); onSavedChange(company.ticker, next); }} onScreener={() => track({ event_name: "screener_outbound_clicked", idea_id: idea.id, ticker: company.ticker })} /></div><footer className="detail-footer" data-testid="detail-disclaimer">Educational context only—not a recommendation to buy or sell. Verify sourced numbers before acting.</footer></main>;
}

export function ComparisonExperience({ idea, answers, onAnswer, onCompanyUpdate, onSavedChange, onFinish }: { idea: IdeaResponse; answers: Record<string, AnswerRecord>; onAnswer: (ticker: string, answer: AnswerRecord) => void; onCompanyUpdate: (company: CompanyInsight) => void; onSavedChange: (ticker: string, saved: boolean) => void; onFinish: () => void }) {
  const [sort, setSort] = useState<SortKey>("quality");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
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
  useEffect(() => { track({ event_name: "comparison_viewed", idea_id: idea.id, properties: { company_count: idea.companies.length } }); }, [idea.id]);
  const companies = idea.companies.map((company, index) => enrichment[index].data ? { ...company, finance: enrichment[index].data!.finance, historical: enrichment[index].data!.historical, enrichment_status: enrichment[index].data!.enrichment_status } : company);
  const sorted = [...companies].sort((a, b) => {
    if (sort === "quality") return averageScore(b) - averageScore(a);
    if (sort === "moat") return axisScore(b, "moat") - axisScore(a, "moat");
    if (sort === "pe") return (a.finance.pe_ratio ?? Number.MAX_VALUE) - (b.finance.pe_ratio ?? Number.MAX_VALUE);
    return (b.finance.market_cap ?? -1) - (a.finance.market_cap ?? -1);
  });
  const selected = selectedTicker ? companies.find((company) => company.ticker === selectedTicker) : null;
  if (selected) return <CompanyDetail idea={idea} company={selected} index={companies.findIndex((company) => company.ticker === selected.ticker)} answer={answers[selected.ticker]} onAnswer={(answer) => onAnswer(selected.ticker, answer)} onBack={() => setSelectedTicker(null)} onCompanyUpdate={onCompanyUpdate} onSavedChange={onSavedChange} />;
  const attempted = Object.values(answers).filter((answer) => !answer.skipped).length, matched = Object.values(answers).filter((answer) => answer.matched).length;
  return <main className="comparison-page" data-testid="comparison-page"><header className="comparison-header"><a href="/" className="wordmark" data-testid="comparison-wordmark">Aaspaas<span>.</span></a><div><a href="/discoveries" data-testid="comparison-journal-link">My Discoveries</a><span>Educational only · no trades</span></div></header><section className="comparison-intro"><div><span className="mono-label" data-testid="comparison-kicker">YOUR CLUE · {idea.observation_theme}</span><h1 data-testid="comparison-title">Three businesses.<br /><em>One glance first.</em></h1><p data-testid="comparison-observation">“{idea.observation}”</p></div><div className="comparison-meta"><span data-testid="comparison-source-mode">{idea.discovery_mode === "ai" ? "Live AI company mapping" : "Curated fallback mapping"}</span><span data-testid="comparison-read-score">Optional reads matched: {matched}/{attempted}</span><span data-testid="comparison-remaining">{idea.daily_remaining} discoveries left today</span></div></section><div className="comparison-toolbar" data-testid="comparison-toolbar"><p data-testid="comparison-help">Tap any company to explore sections in any order. Nothing is gated.</p><label htmlFor="comparison-sort">Sort by <select id="comparison-sort" value={sort} onChange={(event) => { setSort(event.target.value as SortKey); track({ event_name: "comparison_sorted", idea_id: idea.id, properties: { sort: event.target.value } }); }} data-testid="comparison-sort-select"><option value="quality">Overall quality</option><option value="moat">Moat</option><option value="pe">P/E · low first</option><option value="market_cap">Market cap</option></select></label></div><section className="comparison-grid" data-testid="comparison-grid">{sorted.map((company, rank) => <ComparisonCard key={company.id} company={company} rank={rank + 1} loading={company.enrichment_status === "pending"} onOpen={() => { setSelectedTicker(company.ticker); track({ event_name: "company_detail_opened", idea_id: idea.id, ticker: company.ticker }); }} />)}</section><div className="comparison-footer-actions"><Button onClick={onFinish} size="lg" data-testid="comparison-finish-button">Wrap up this discovery <ArrowRight size={17} /></Button><p data-testid="comparison-disclaimer">Scores are qualitative judgment. Yahoo Finance data can be delayed or incomplete. This is not a buy/sell recommendation.</p></div></main>;
}