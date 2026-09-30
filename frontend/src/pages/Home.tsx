import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Moon, Quote, Share2, Sun, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api";
import type { CompanyInsight, GutAnswer, IdeaResponse, ScoreAxis } from "@/lib/types";

const EXAMPLES = [
  "Every wedding I've been to this year used the same online invite website",
  "The same quick-commerce bags are showing up in every apartment lobby",
  "I keep seeing solar panels appear on factory rooftops near me",
];

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const marketCap = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const number = (value: number | null) => value === null ? "—" : value.toFixed(1);
const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;

function ScorePips({ axis, testId }: { axis: ScoreAxis; testId: string }) {
  return (
    <div className="score-axis" data-testid={testId}>
      <div className="score-axis-heading">
        <span data-testid={`${testId}-label`}>{axis.label}</span>
        <span className="mono-label score-number" data-testid={`${testId}-score`}>{axis.score}/5</span>
      </div>
      <div className="score-pips" aria-label={`${axis.label}: ${axis.score} out of 5`} data-testid={`${testId}-pips`}>
        {[1, 2, 3, 4, 5].map((pip) => <span key={pip} className={pip <= axis.score ? "pip pip-on" : "pip"} data-testid={`${testId}-pip-${pip}`} />)}
      </div>
      <p className="score-rationale" data-testid={`${testId}-rationale`}>{axis.rationale}</p>
    </div>
  );
}

function FinanceBlock({ company }: { company: CompanyInsight }) {
  const finance = company.finance;
  return (
    <section className="finance-block" data-testid={`real-data-${slug(company.ticker)}`}>
      <div className="section-kicker-row">
        <span className="mono-label" data-testid={`real-data-label-${slug(company.ticker)}`}>REAL DATA · YAHOO FINANCE</span>
        <span className="data-note" data-testid={`real-data-note-${slug(company.ticker)}`}>{finance.available ? finance.note : "Live data unavailable right now"}</span>
      </div>
      {finance.available && <div className="finance-grid" data-testid={`real-data-metrics-${slug(company.ticker)}`}>
        <div className="finance-metric" data-testid={`market-cap-${slug(company.ticker)}`}><span>Market cap</span><strong>{marketCap(finance.market_cap)}</strong></div>
        <div className="finance-metric" data-testid={`pe-ratio-${slug(company.ticker)}`}><span>P/E</span><strong>{number(finance.pe_ratio)}</strong></div>
        <div className="finance-metric" data-testid={`roe-${slug(company.ticker)}`}><span>ROE</span><strong>{percent(finance.roe)}</strong></div>
        <div className="finance-metric" data-testid={`debt-equity-${slug(company.ticker)}`}><span>Debt / equity</span><strong>{number(finance.debt_to_equity)}</strong></div>
        <div className="finance-metric" data-testid={`revenue-growth-${slug(company.ticker)}`}><span>Revenue growth</span><strong>{percent(finance.revenue_growth)}</strong></div>
      </div>}
      {!finance.available && <p className="data-unavailable" data-testid={`real-data-unavailable-${slug(company.ticker)}`}>The qualitative story is still useful. Check the company’s latest filings yourself.</p>}
    </section>
  );
}

export default function Home() {
  const [observation, setObservation] = useState("");
  const [idea, setIdea] = useState<IdeaResponse | null>(null);
  const [view, setView] = useState<"landing" | "story" | "recap">("landing");
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, GutAnswer>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [dark, setDark] = useState(() => localStorage.getItem("aaspaas-theme") === "dark");
  const didLogPageview = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("aaspaas-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    if (didLogPageview.current || sessionStorage.getItem("aaspaas-pageview")) return;
    didLogPageview.current = true;
    sessionStorage.setItem("aaspaas-pageview", "1");
    void apiPost<{ recorded: boolean }>("/pageviews").catch(() => undefined);
  }, []);

  const discover = useMutation({
    mutationFn: (value: string) => apiPost<IdeaResponse>("/ideas", { observation: value }),
    onSuccess: (result) => {
      setIdea(result);
      setAnswers({});
      setRevealed({});
      setActiveIndex(0);
      setView("story");
    },
    onError: () => toast.error("The guide could not map that idea right now. Try again in a moment."),
  });

  const recordGut = useMutation({ mutationFn: (payload: { idea_id: string; ticker: string; answer: GutAnswer }) => apiPost<{ recorded: boolean; matched: boolean }>("/gut-checks", payload) });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (view !== "story" || !idea?.companies.length) return;
      if (event.key === "ArrowRight") advance();
      if (event.key === "ArrowLeft") goBack();
      if (event.key === "Escape") setView("recap");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (observation.trim().length < 8) {
      toast.error("Give us a little more detail — at least one useful sentence.");
      return;
    }
    discover.mutate(observation.trim());
  };

  const current = idea?.companies[activeIndex];
  const answerCurrent = current ? answers[current.ticker] : undefined;
  const isRevealed = current ? Boolean(revealed[current.ticker]) : false;

  function advance() {
    if (!idea || !current) return;
    if (!isRevealed) {
      setRevealed((old) => ({ ...old, [current.ticker]: true }));
      return;
    }
    if (activeIndex === idea.companies.length - 1) setView("recap");
    else setActiveIndex((index) => index + 1);
  }

  function goBack() {
    if (!idea) return;
    if (isRevealed) {
      setRevealed((old) => ({ ...old, [current?.ticker ?? ""]: false }));
      return;
    }
    setActiveIndex((index) => Math.max(0, index - 1));
  }

  function answer(answer: GutAnswer) {
    if (!idea || !current) return;
    setAnswers((old) => ({ ...old, [current.ticker]: answer }));
    setRevealed((old) => ({ ...old, [current.ticker]: true }));
    recordGut.mutate({ idea_id: idea.id, ticker: current.ticker, answer });
  }

  if (view === "story" && idea) {
    if (!idea.companies.length) return <NoMatch observation={idea.observation} onTryAgain={() => { setObservation(idea.observation); setIdea(null); setView("landing"); }} />;
    return <StoryDeck idea={idea} current={current!} activeIndex={activeIndex} answer={answerCurrent} revealed={isRevealed} onAnswer={answer} onAdvance={advance} onBack={goBack} onClose={() => setView("recap")} />;
  }

  if (view === "recap" && idea) return <Recap idea={idea} onShare={() => toast.success("Share link copied — send the idea to a curious friend.")} onTryAgain={() => { setObservation(""); setIdea(null); setView("landing"); }} />;

  return (
    <main className="paper-page" data-testid="landing-page">
      <header className="site-header" data-testid="landing-header">
        <a href="/" className="wordmark" data-testid="aaspaas-wordmark">Aaspaas<span>.</span></a>
        <div className="header-actions">
          <a className="studio-link" href="/admin" data-testid="admin-dashboard-link">Studio</a>
          <button className="theme-toggle" type="button" onClick={() => setDark(!dark)} aria-label="Toggle theme" data-testid="theme-toggle-button">{dark ? <Sun size={16} /> : <Moon size={16} />}<span>{dark ? "Light" : "Dark"}</span></button>
        </div>
      </header>
      <div className="landing-layout">
        <section className="landing-copy" data-testid="landing-intro">
          <Badge className="eyebrow" data-testid="landing-eyebrow">EVERYDAY OBSERVATIONS → LISTED BUSINESSES</Badge>
          <h1 data-testid="landing-headline">What have you<br /><em>noticed lately?</em></h1>
          <p className="lede" data-testid="landing-lede">The things you keep seeing can be clues. Aaspaas helps you follow the clue to a real Indian business — then teaches you what to investigate next.</p>
          <div className="quote-block" data-testid="lynch-quote"><Quote size={20} /><div><p>“Invest in what you know.”</p><span>— Peter Lynch</span></div></div>
        </section>
        <section className="observation-panel" data-testid="observation-panel">
          <form onSubmit={submit} data-testid="observation-form">
            <label htmlFor="observation" className="mono-label" data-testid="observation-label">YOUR OBSERVATION</label>
            <Textarea id="observation" value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="I keep noticing…" className="observation-input" data-testid="observation-textarea" />
            <div className="example-wrap" data-testid="example-chips">
              <span className="micro-label" data-testid="example-label">Try an example</span>
              {EXAMPLES.map((example, index) => <button key={example} type="button" className="example-chip" onClick={() => setObservation(example)} data-testid={`example-chip-${index + 1}`}>{example}</button>)}
            </div>
            <Button type="submit" size="lg" className="discover-button" disabled={discover.isPending} data-testid="discover-submit-button">{discover.isPending ? "Following the clue…" : "Follow the clue"}<ArrowRight size={18} /></Button>
          </form>
          <div className="how-it-works" data-testid="scoring-explainer">
            <p className="mono-label" data-testid="scoring-explainer-title">HOW THE READ WORKS</p>
            <div className="explainer-row" data-testid="explainer-step-1"><span>01</span><p><strong>Find the exposure</strong> — not just the brand you see, but the business behind the habit.</p></div>
            <div className="explainer-row" data-testid="explainer-step-2"><span>02</span><p><strong>Make a quality read</strong> — moat, capital allocation, management, and runway.</p></div>
            <div className="explainer-row" data-testid="explainer-step-3"><span>03</span><p><strong>Keep your own homework</strong> — real numbers are a starting point, not a conclusion.</p></div>
          </div>
        </section>
      </div>
      <footer className="disclaimer" data-testid="landing-disclaimer">This is educational context, not a recommendation to buy or sell — Aaspaas doesn’t place trades or manage money. Verify real numbers yourself before acting.</footer>
    </main>
  );
}

function NoMatch({ observation, onTryAgain }: { observation: string; onTryAgain: () => void }) {
  return <main className="empty-result" data-testid="no-company-result"><span className="mono-label">AASPAAS READ</span><h1 data-testid="no-company-title">No honest listed-company match yet.</h1><p data-testid="no-company-copy">“{observation}” may be real, but we couldn’t connect it to a specific NSE or BSE business without stretching the evidence. That is a useful result too.</p><Button onClick={onTryAgain} data-testid="no-company-try-again">Try another idea <ArrowRight size={17} /></Button></main>;
}

function StoryDeck({ idea, current, activeIndex, answer, revealed, onAnswer, onAdvance, onBack, onClose }: { idea: IdeaResponse; current: CompanyInsight; activeIndex: number; answer?: GutAnswer; revealed: boolean; onAnswer: (answer: GutAnswer) => void; onAdvance: () => void; onBack: () => void; onClose: () => void }) {
  return <main className="story-page" data-testid="story-page">
    <div className="story-phone" onClick={(event) => { const target = event.target as HTMLElement; if (target.closest("button,a")) return; const x = event.clientX - event.currentTarget.getBoundingClientRect().left; if (x < event.currentTarget.clientWidth * 0.33) onBack(); else if (x > event.currentTarget.clientWidth * 0.66) onAdvance(); }} data-testid="story-deck">
      <div className="story-topbar" data-testid="story-topbar"><div className="progress-segments" data-testid="story-progress">{idea.companies.map((company, index) => <span key={company.id} className={index <= activeIndex ? "progress-segment active" : "progress-segment"} data-testid={`story-progress-${index + 1}`} />)}</div><button type="button" className="story-close" onClick={onClose} aria-label="Close story" data-testid="story-close-button"><X size={19} /></button></div>
      <div className="story-content" data-testid={`story-card-${slug(current.ticker)}`}>
        {idea.discovery_mode === "curated_fallback" && <div className="fallback-note" data-testid="curated-fallback-note">The AI guide is reconnecting, so this is a cautious curated starting point. Treat every connection as a research prompt, not a conclusion.</div>}
        <div className="story-company-meta"><span className="story-index" data-testid="story-index">0{activeIndex + 1} / 0{idea.companies.length}</span><span className="story-exchange" data-testid="story-exchange">{current.exchange} · {current.ticker}</span></div>
        {!revealed ? <div className="gut-check-stage" data-testid="gut-check-stage"><p className="story-kicker" data-testid="gut-check-kicker">BEFORE THE REVEAL</p><h1 data-testid="gut-check-company-name">{current.company_name}</h1><p className="gut-question" data-testid="gut-check-question">{current.gut_check_question}</p><div className="gut-actions" data-testid="gut-check-actions"><button type="button" onClick={() => onAnswer("yes")} className="gut-button" data-testid="gut-check-yes-button">Yes <span>Y</span></button><button type="button" onClick={() => onAnswer("no")} className="gut-button" data-testid="gut-check-no-button">No <span>N</span></button></div><button type="button" onClick={onAdvance} className="skip-link" data-testid="gut-check-skip-button">Skip & reveal <ArrowRight size={14} /></button></div> : <div className="reveal-stage" data-testid="reveal-stage"><div className="reveal-heading"><Badge className={answer === current.gut_check_lean ? "match-badge" : "different-badge"} data-testid="gut-check-result-badge">{answer ? (answer === current.gut_check_lean ? "YOUR GUT MATCHED" : "YOUR GUT DIFFERED") : "THE READ IS IN"}</Badge><h1 data-testid="story-company-name">{current.company_name}</h1><p className="ticker-line" data-testid="story-ticker-line">{current.ticker} · {current.exchange}</p></div>{answer && <p className="supportive-note" data-testid="gut-check-supportive-note">{answer === current.gut_check_lean ? "That instinct lines up with the quality read." : "Worth digging into why the business may be stronger — or weaker — than the first impression."}</p>}<p className="connection-copy" data-testid="company-connection">{current.connection}</p><div className="business-model" data-testid="business-model"><span className="mono-label">HOW IT MAKES MONEY</span><p>{current.business_model}</p></div><FinanceBlock company={current} /><section className="scorecard" data-testid={`quality-scorecard-${slug(current.ticker)}`}><div className="section-kicker-row"><span className="mono-label">{idea.discovery_mode === "ai" ? "AI QUALITATIVE SCORECARD" : "CURATED QUALITATIVE SCORECARD"}</span><span className="data-note">A framework, not a recommendation</span></div>{current.scorecard.map((axis) => <ScorePips key={axis.key} axis={axis} testId={`score-${slug(current.ticker)}-${axis.key}`} />)}</section><div className="story-bottom-notes"><p data-testid="company-risk"><strong>Where this could be wrong</strong>{current.risk}</p><p data-testid="verify-yourself"><strong>Verify this yourself</strong>{current.verify_tip}</p></div><button type="button" className="next-story-button" onClick={onAdvance} data-testid="story-next-button">{activeIndex === idea.companies.length - 1 ? "See the full read" : "Next company"}<ArrowRight size={17} /></button></div>}
      </div>
      <div className="tap-hint" data-testid="story-tap-hint"><span><ArrowLeft size={13} /> back</span><span>tap to move <ArrowRight size={13} /></span></div>
    </div>
  </main>;
}

function Recap({ idea, onShare, onTryAgain }: { idea: IdeaResponse; onShare: () => void; onTryAgain: () => void }) {
  const share = async () => {
    void apiPost<{ recorded: boolean }>("/shares", { idea_id: idea.id }).catch(() => undefined);
    if (navigator.share) await navigator.share({ title: "Aaspaas idea", text: idea.observation, url: window.location.href }).catch(() => undefined);
    else await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
    onShare();
  };
  return <main className="paper-page recap-page" data-testid="recap-page"><header className="site-header"><a href="/" className="wordmark" data-testid="recap-wordmark">Aaspaas<span>.</span></a><span className="mono-label" data-testid="recap-label">YOUR IDEA · FULL READ</span></header><div className="recap-intro"><span className="mono-label" data-testid="recap-kicker">A SMALL FIELD GUIDE</span><h1 data-testid="recap-headline">What your observation<br /><em>can teach you.</em></h1><p data-testid="recap-observation">“{idea.observation}”</p></div><section className="recap-grid" data-testid="recap-company-grid">{idea.companies.map((company) => <article className="recap-card" key={company.id} data-testid={`recap-card-${slug(company.ticker)}`}><div className="recap-card-top"><span className="mono-label">{company.ticker}</span><span className="recap-exchange">{company.exchange}</span></div><h2 data-testid={`recap-company-${slug(company.ticker)}`}>{company.company_name}</h2><p data-testid={`recap-connection-${slug(company.ticker)}`}>{company.connection}</p><div className="recap-score-list">{company.scorecard.map((axis) => <div key={axis.key} className="recap-score-row" data-testid={`recap-score-${slug(company.ticker)}-${axis.key}`}><span>{axis.label}</span><div className="mini-pips">{[1, 2, 3, 4, 5].map((pip) => <i key={pip} className={pip <= axis.score ? "pip-on" : ""} />)}</div></div>)}</div></article>)}</section><div className="recap-actions"><Button onClick={() => void share()} size="lg" data-testid="share-idea-button"><Share2 size={17} /> Share this idea</Button><Button onClick={onTryAgain} variant="outline" size="lg" data-testid="try-another-idea-button">Try another idea <ArrowRight size={17} /></Button></div><p className="disclaimer recap-disclaimer" data-testid="recap-disclaimer">This is educational context, not a recommendation to buy or sell — Aaspaas doesn’t place trades or manage money. Verify real numbers yourself before acting.</p></main>;
}