import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, ExternalLink, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CauseChain } from "@/components/story/CauseChain";
import { InteractionPanel } from "@/components/story/InteractionPanel";
import { StockMoment } from "@/components/story/StockMoment";
import { useEngagement } from "@/hooks/useEngagement";
import { apiGet, apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { AnswerRecord, CompanyInsight, EnrichmentResponse, IdeaResponse, ScoreAxis } from "@/lib/types";

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const marketCap = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const number = (value: number | null) => value === null ? "—" : value.toFixed(1);
const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;

function ScorePips({ axis, testId }: { axis: ScoreAxis; testId: string }) {
  return <div className="score-axis" data-testid={testId}><div className="score-axis-heading"><span data-testid={`${testId}-label`}>{axis.label}</span><span className="mono-label score-number" data-testid={`${testId}-score`}>{axis.score}/5</span></div><div className="score-pips" aria-label={`${axis.label}: ${axis.score} out of 5`} data-testid={`${testId}-pips`}>{[1, 2, 3, 4, 5].map((pip) => <span key={pip} className={pip <= axis.score ? "pip pip-on" : "pip"} data-testid={`${testId}-pip-${pip}`} />)}</div><p className="score-rationale" data-testid={`${testId}-rationale`}>{axis.rationale}</p></div>;
}

function FinanceBlock({ company }: { company: CompanyInsight }) {
  const finance = company.finance;
  return <section className="finance-block" data-testid={`real-data-${slug(company.ticker)}`}><div className="section-kicker-row"><span className="mono-label" data-testid={`real-data-label-${slug(company.ticker)}`}>REAL DATA · YAHOO FINANCE</span><span className={`data-status-text status-${finance.status}`} data-testid={`real-data-status-${slug(company.ticker)}`}>{finance.status}</span></div>{finance.available ? <div className="finance-grid" data-testid={`real-data-metrics-${slug(company.ticker)}`}><div className="finance-metric"><span>Market cap</span><strong data-testid={`market-cap-${slug(company.ticker)}`}>{marketCap(finance.market_cap)}</strong></div><div className="finance-metric"><span>P/E</span><strong data-testid={`pe-ratio-${slug(company.ticker)}`}>{number(finance.pe_ratio)}</strong></div><div className="finance-metric"><span>ROE</span><strong data-testid={`roe-${slug(company.ticker)}`}>{percent(finance.roe)}</strong></div><div className="finance-metric"><span>Debt / equity</span><strong data-testid={`debt-equity-${slug(company.ticker)}`}>{number(finance.debt_to_equity)}</strong></div><div className="finance-metric"><span>Revenue growth</span><strong data-testid={`revenue-growth-${slug(company.ticker)}`}>{percent(finance.revenue_growth)}</strong></div></div> : <p className="data-unavailable" data-testid={`real-data-unavailable-${slug(company.ticker)}`}>Live data unavailable right now. The qualitative story remains usable; verify numbers in current filings.</p>}<p className="source-caption" data-testid={`finance-source-${slug(company.ticker)}`}>{finance.note}</p></section>;
}

function Reveal({ idea, company, answer, saved, onSave, onNext, onScreener }: { idea: IdeaResponse; company: CompanyInsight; answer?: AnswerRecord; saved: boolean; onSave: () => void; onNext: () => void; onScreener: () => void }) {
  const screenerUrl = `https://www.screener.in/company/${encodeURIComponent(company.ticker)}/consolidated/`;
  return <section className="story-beat reveal-stage layered-reveal" data-testid="reveal-stage">
    <div className="reveal-heading"><Badge className={answer?.matched ? "match-badge" : "different-badge"} data-testid="interaction-result-badge">{answer?.skipped ? "YOU KEPT THE STORY MOVING" : answer?.matched ? "YOUR READ MATCHED" : "A DIFFERENT READ"}</Badge><h1 data-testid="story-company-name">{company.company_name}</h1><p className="ticker-line" data-testid="story-ticker-line">{company.ticker} · {company.exchange} · {company.sector}</p></div>
    <p className="supportive-note" data-testid="interaction-explanation">{answer?.skipped ? "The question was optional. The useful part is understanding what drives the economics." : answer?.matched ? "Your inference lines up with this read. Now test it against evidence." : "The difference is useful: ask which assumption or piece of evidence would change your view."}</p>
    <p className="connection-copy" data-testid="company-connection">{company.connection}</p>
    <div className="business-model" data-testid="business-model"><span className="mono-label">HOW IT MAKES MONEY</span><p>{company.business_model}</p></div>
    <FinanceBlock company={company} />
    <section className="scorecard" data-testid={`quality-scorecard-${slug(company.ticker)}`}><div className="section-kicker-row"><span className="mono-label">{idea.discovery_mode === "ai" ? "AI QUALITATIVE SCORECARD" : "CURATED QUALITATIVE SCORECARD"}</span><span className="data-note">Judgment, not sourced fact</span></div>{company.scorecard.map((axis) => <ScorePips key={axis.key} axis={axis} testId={`score-${slug(company.ticker)}-${axis.key}`} />)}</section>
    <div className="plot-twist-grid" data-testid="plot-twist-grid"><p data-testid="company-assumption"><strong>What has to be true</strong>{company.what_must_be_true}</p><p data-testid="company-risk"><strong>What could break the chain</strong>{company.what_breaks_chain}</p></div>
    <section className="research-list" data-testid="research-checklist"><span className="mono-label">WHAT TO CHECK NEXT</span>{company.research_checks.map((check, index) => <p key={check} data-testid={`research-check-${index + 1}`}><span>0{index + 1}</span>{check}</p>)}{company.historical.available && <p data-testid="research-check-market-date"><span>04</span>Open the exchange announcement or results release nearest {company.historical.largest_day?.end_date ?? company.historical.as_of}; do not assume causation.</p>}</section>
    <div className="research-actions"><button type="button" className={saved ? "field-note-button saved" : "field-note-button"} onClick={onSave} data-testid="save-field-note-button">{saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{saved ? "Saved to My Discoveries" : "Save as field note"}</button><a className="screener-link" href={screenerUrl} target="_blank" rel="noreferrer" onClick={onScreener} data-testid="screener-outbound-link">See full fundamentals on Screener <ExternalLink size={14} /></a></div>
    <p className="story-disclaimer" data-testid="story-education-disclaimer">Educational context only—not a recommendation. Aaspaas does not place trades or manage money.</p>
    <Button className="story-cta" onClick={onNext} data-testid="story-next-button">Next chapter <ArrowRight size={16} /></Button>
  </section>;
}

export function StoryExperience({ idea, activeIndex, answers, onAnswer, onCompanyUpdate, onSavedChange, onIndexChange, onFinish }: { idea: IdeaResponse; activeIndex: number; answers: Record<string, AnswerRecord>; onAnswer: (ticker: string, answer: AnswerRecord) => void; onCompanyUpdate: (company: CompanyInsight) => void; onSavedChange: (ticker: string, saved: boolean) => void; onIndexChange: (index: number) => void; onFinish: () => void }) {
  const [stage, setStage] = useState(0);
  const stageStarted = useRef(Date.now());
  const current = idea.companies[activeIndex];
  const next = idea.companies[activeIndex + 1];
  const { track } = useEngagement();
  const enrichment = useQuery({
    queryKey: ["enrichment", idea.id, current.ticker],
    queryFn: () => apiGet<EnrichmentResponse>(`/ideas/${idea.id}/companies/${current.ticker}/enrichment`),
    retry: 1,
  });
  const recordAnswer = useMutation({ mutationFn: (payload: Record<string, unknown>) => apiPost<{ recorded: boolean; matched: boolean | null }>("/gut-checks", payload) });
  const saveNote = useMutation({ mutationFn: (saved: boolean) => apiPost<{ recorded: boolean }>(`/ideas/${idea.id}/field-notes`, { ticker: current.ticker, saved }) });

  useEffect(() => {
    setStage(0);
    stageStarted.current = Date.now();
  }, [activeIndex]);

  useEffect(() => {
    if (!enrichment.data) return;
    onCompanyUpdate({ ...current, finance: enrichment.data.finance, historical: enrichment.data.historical, enrichment_status: enrichment.data.enrichment_status });
    if (next) void queryClient.prefetchQuery({ queryKey: ["enrichment", idea.id, next.ticker], queryFn: () => apiGet<EnrichmentResponse>(`/ideas/${idea.id}/companies/${next.ticker}/enrichment`) });
  }, [enrichment.data]);

  useEffect(() => {
    if (stage === 1) track({ event_name: "stock_hook_viewed", idea_id: idea.id, ticker: current.ticker, stage: "market", properties: { hook_format: activeIndex % 2 === 0 ? "wildest" : "journey" } });
    return () => track({ event_name: "stage_dwell", idea_id: idea.id, ticker: current.ticker, stage: ["chain", "market", "question", "reveal"][stage], properties: { duration_ms: Date.now() - stageStarted.current } });
  }, [stage, current.ticker]);

  const company = useMemo(() => enrichment.data ? { ...current, finance: enrichment.data.finance, historical: enrichment.data.historical, enrichment_status: enrichment.data.enrichment_status } : current, [current, enrichment.data]);
  const attempted = Object.values(answers).filter((answer) => !answer.skipped).length;
  const matched = Object.values(answers).filter((answer) => answer.matched === true).length;
  const saved = idea.saved_tickers.includes(current.ticker);

  function moveTo(nextStage: number) {
    stageStarted.current = Date.now();
    setStage(Math.max(0, Math.min(3, nextStage)));
  }

  function advance() {
    if (stage < 2) moveTo(stage + 1);
    else if (stage === 2) completeAnswer({ matched: null, skipped: true, format: "moat", answer: null });
    else if (activeIndex < idea.companies.length - 1) onIndexChange(activeIndex + 1);
    else onFinish();
  }

  function back() {
    if (stage > 0) moveTo(stage - 1);
    else if (activeIndex > 0) onIndexChange(activeIndex - 1);
  }

  function completeAnswer(record: AnswerRecord, metricDistance?: number) {
    onAnswer(current.ticker, record);
    recordAnswer.mutate({ idea_id: idea.id, ticker: current.ticker, question_format: record.format, answer: record.answer, skipped: record.skipped, matched: record.matched, metric_distance: metricDistance });
    track({ event_name: record.skipped ? "question_skipped" : "question_answered", idea_id: idea.id, ticker: current.ticker, stage: "question", properties: { format: record.format, matched: record.matched, metric_distance: metricDistance } });
    moveTo(3);
  }

  return <main className="story-page" data-testid="story-page"><div className="story-phone engagement-phone" onClick={(event) => { const target = event.target as HTMLElement; if (target.closest("button,a,input")) return; const x = event.clientX - event.currentTarget.getBoundingClientRect().left; if (x < event.currentTarget.clientWidth * .3) back(); else if (x > event.currentTarget.clientWidth * .7) advance(); }} data-testid="story-deck">
    <div className="story-topbar"><div className="progress-segments" data-testid="story-progress">{idea.companies.map((item, index) => <span key={item.id} className={index <= activeIndex ? "progress-segment active" : "progress-segment"} data-testid={`story-progress-${index + 1}`} />)}</div><button type="button" className="story-close" onClick={onFinish} aria-label="Jump to recap" data-testid="story-close-button"><X size={19} /></button></div>
    <div className="story-scorebar" data-testid="running-read-score"><span data-testid="story-index">0{activeIndex + 1} / 0{idea.companies.length}</span><div className="beat-dots" data-testid="story-beat-progress">{[0, 1, 2, 3].map((beat) => <i key={beat} className={beat <= stage ? "active" : ""} />)}</div><span data-testid="running-read-value">Your read: {matched}/{attempted}</span></div>
    <div className="story-content paced-story" data-testid={`story-card-${slug(current.ticker)}`}>{idea.discovery_mode === "curated_fallback" && <div className="fallback-note" data-testid="curated-fallback-note">The live guide is reconnecting. This cautious curated path is a research prompt, not a conclusion.</div>}{stage === 0 && <CauseChain company={company} onContinue={() => { track({ event_name: "cause_chain_completed", idea_id: idea.id, ticker: current.ticker }); moveTo(1); }} />}{stage === 1 && <StockMoment data={company.historical} ticker={company.ticker} variant={activeIndex % 2 === 0 ? "wildest" : "journey"} loading={enrichment.isLoading} onExpand={() => track({ event_name: "chart_expanded", idea_id: idea.id, ticker: current.ticker })} onContinue={() => { track({ event_name: "stock_hook_continued", idea_id: idea.id, ticker: current.ticker }); moveTo(2); }} />}{stage === 2 && <InteractionPanel company={company} index={activeIndex} onComplete={completeAnswer} />}{stage === 3 && <Reveal idea={idea} company={company} answer={answers[current.ticker]} saved={saved} onSave={() => { const nextSaved = !saved; saveNote.mutate(nextSaved); onSavedChange(current.ticker, nextSaved); }} onScreener={() => track({ event_name: "screener_outbound_clicked", idea_id: idea.id, ticker: current.ticker })} onNext={advance} />}</div>
    <div className="tap-hint"><span><ArrowLeft size={13} /> back</span><span data-testid="tap-navigation-hint">tap edges to move <ArrowRight size={13} /></span></div>
  </div></main>;
}