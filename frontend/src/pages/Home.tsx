import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Compass, Moon, Quote, Sparkles, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import { EmailCapture } from "@/components/EmailCapture";
import { FriendLanding } from "@/components/FriendLanding";
import { ObservationForm } from "@/components/ObservationForm";
import type { InputMode } from "@/components/ObservationForm";
import { LandingTour } from "@/components/LandingTour";
import { ComparisonExperience } from "@/components/results/ComparisonExperience";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEngagement } from "@/hooks/useEngagement";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { ShareMenu } from "@/components/ShareMenu";
import { crore, debtEquity, pct, times } from "@/lib/fundamentals";
import type { AnswerRecord, CompanyInsight, IdeaResponse, PriceMovement } from "@/lib/types";

const WAITING_NOTES = [
  ["Follow the revenue", "A visible habit matters only when it reaches a listed company’s economics."],
  ["Price is an expectation", "A dramatic stock move does not prove a business became better or worse overnight."],
  ["Look for the enabler", "The less obvious supplier or platform can reveal more than the brand on the surface."],
  ["Try to disprove it", "A useful investment question names the evidence that would break the story."],
];

interface LimitDetail { message: string; reset_at: string; daily_limit: number }
interface BusyDetail { code: "busy"; message: string; reset_at: string }

const NOTE_MS = 7000;
const WAITING_STEPS = ["Mapping real NSE/BSE exposure", "Separating judgment from sourced data", "Preparing the companies while evidence follows"];
const EASE = [0.22, 1, 0.36, 1] as const;

function WaitingView({ observation }: { observation: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const started = Date.now(); const timer = window.setInterval(() => setElapsed(Date.now() - started), 250); return () => window.clearInterval(timer); }, []);
  const index = Math.floor(elapsed / NOTE_MS) % WAITING_NOTES.length;
  const [title, copy] = WAITING_NOTES[index];
  const step = elapsed < 5000 ? 0 : elapsed < 12000 ? 1 : 2;
  return <main className="waiting-page" data-testid="discovery-waiting-page"><div className="waiting-orbit" aria-hidden="true"><i /><i /><i /></div>
    <motion.span className="mono-label" data-testid="waiting-kicker" initial={{ opacity: 0, letterSpacing: "0.4em" }} animate={{ opacity: 1, letterSpacing: "0.13em" }} transition={{ duration: 0.9, ease: EASE }}>FOLLOWING YOUR CLUE</motion.span>
    <motion.h1 data-testid="waiting-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: EASE }}>“{observation}”</motion.h1>
    <div className="waiting-note-stage">
      <AnimatePresence mode="wait">
        <motion.div className="waiting-note" key={index} data-testid="waiting-note" initial={{ opacity: 0, y: 22, scale: 0.97, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: -18, scale: 0.98, filter: "blur(8px)" }} transition={{ duration: 0.7, ease: EASE }}>
          <span className="waiting-note-count" data-testid="waiting-note-count">{`LESSON 0${index + 1} / 0${WAITING_NOTES.length}`}</span>
          <motion.strong initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.25, ease: EASE }} data-testid="waiting-note-title">{title}</motion.strong>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45, ease: EASE }} data-testid="waiting-note-copy">{copy}</motion.p>
          <div className="waiting-note-progress" aria-hidden="true"><i style={{ animationDuration: `${NOTE_MS}ms` }} /></div>
        </motion.div>
      </AnimatePresence>
    </div>
    <div className="waiting-dots" aria-hidden="true" data-testid="waiting-dots">{WAITING_NOTES.map((note, dot) => <i key={note[0]} className={dot === index ? "active" : ""} />)}</div>
    <div className="waiting-checks" data-testid="waiting-checks">{WAITING_STEPS.map((label, stepIndex) => <span key={label} className={stepIndex < step ? "done" : stepIndex === step ? "active" : ""} data-testid={`waiting-step-${stepIndex + 1}`}><i />{`0${stepIndex + 1} · ${label}`}</span>)}</div>
  </main>;
}

function NoMatch({ observation, onTryAgain }: { observation: string; onTryAgain: () => void }) {
  return <main className="empty-result" data-testid="no-company-result"><span className="mono-label" data-testid="no-company-kicker">AASPAAS READ</span><h1 data-testid="no-company-title">No honest listed-company match yet.</h1><p data-testid="no-company-copy">“{observation}” may be real, but connecting it to a specific NSE or BSE business would stretch the evidence. That is a useful result too.</p><Button onClick={onTryAgain} data-testid="no-company-try-again">Try another idea <ArrowRight size={17} /></Button></main>;
}

function LimitWall({ detail, onBack }: { detail: LimitDetail; onBack: () => void }) {
  const [showEmail, setShowEmail] = useState(true);
  const interest = useMutation({ mutationFn: () => apiPost<{ recorded: boolean }>("/product-interest", { kind: "plus" }) });
  const reset = new Date(detail.reset_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  return <main className="limit-page" data-testid="daily-limit-page"><a className="wordmark" href="/" data-testid="limit-wordmark">Aaspaas<span>.</span></a><section className="limit-hero"><span className="mono-label" data-testid="limit-kicker">TODAY’S FIELDWORK IS COMPLETE</span><h1 data-testid="limit-title">Three good clues<br /><em>are enough for today.</em></h1><p data-testid="limit-copy">The free allowance protects a costly research workflow from abuse. Your saved discoveries, charts, questions, and shares remain open.</p><div className="limit-reset" data-testid="limit-reset-time">Resets at {reset} UTC</div><div className="limit-actions"><Button onClick={onBack} variant="outline" data-testid="limit-back-button">Read saved discoveries</Button><Button onClick={() => { interest.mutate(); toast.success("Plus interest noted—there is no payment or active subscription yet."); }} data-testid="plus-interest-button">Preview Aaspaas Plus <Sparkles size={16} /></Button></div></section><section className="plus-preview" data-testid="plus-preview"><span className="mono-label">PLUS · COMING LATER</span><h2>More depth, when the learning loop proves useful.</h2><div><p><strong>Unlimited ideas</strong><span>Explore without the daily generation allowance.</span></p><p><strong>Cross-device journal</strong><span>Restore verified discoveries safely by email.</span></p><p><strong>Priority enrichment</strong><span>Deeper research layers with clearly sourced data.</span></p></div><small>No payment is accepted in Phase 1. This records interest only.</small></section>{showEmail && <EmailCapture location="limit_wall" onDismiss={() => setShowEmail(false)} />}</main>;
}

function BusyWall({ detail, onBack }: { detail: BusyDetail; onBack: () => void }) {
  const reset = new Date(detail.reset_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  return <main className="limit-page" data-testid="busy-page"><a className="wordmark" href="/" data-testid="busy-wordmark">Aaspaas<span>.</span></a><section className="limit-hero"><span className="mono-label" data-testid="busy-kicker">BUSY DAY IN THE FIELD</span><h1 data-testid="busy-title">Aaspaas is busy today.<br /><em>Come back tomorrow.</em></h1><p data-testid="busy-copy">So many people are tracing clues today that we’ve paused new AI discoveries to keep research quality and costs in check. Saved discoveries and shared reads stay open.</p><div className="limit-reset" data-testid="busy-reset-time">{`New discoveries reopen at ${reset} UTC`}</div><div className="limit-actions"><Button onClick={onBack} variant="outline" data-testid="busy-back-button">Read saved discoveries</Button><Button onClick={() => { window.location.href = "/"; }} data-testid="busy-home-button">Back to Aaspaas</Button></div></section></main>;
}

function investorType(answers: Record<string, AnswerRecord>) {
  const rows = Object.values(answers);
  const attempted = rows.filter((answer) => !answer.skipped).length;
  const skipped = rows.filter((answer) => answer.skipped).length;
  const matched = rows.filter((answer) => answer.matched === true).length;
  if (attempted === 0 || skipped > attempted) return "Storyteller";
  if (attempted && matched / attempted < .5) return "Contrarian";
  return "Detective";
}

function strongestMoment(idea: IdeaResponse): { company: string; movement: PriceMovement } | null {
  const rows = idea.companies.flatMap((company) => [company.historical.largest_day, company.historical.largest_month, company.historical.max_drawdown].filter(Boolean).map((movement) => ({ company: company.company_name, movement: movement! })));
  return rows.sort((a, b) => Math.abs(b.movement.percent) - Math.abs(a.movement.percent))[0] ?? null;
}

function Recap({ idea, answers, onTryAgain }: { idea: IdeaResponse; answers: Record<string, AnswerRecord>; onTryAgain: () => void }) {
  const [showEmail, setShowEmail] = useState(() => { const until = Number(localStorage.getItem("aaspaas-email-dismissed-until") ?? 0); return Date.now() > until; });
  const { track } = useEngagement();
  const type = idea.investor_type ?? investorType(answers);
  const attempted = Object.values(answers).filter((answer) => !answer.skipped).length;
  const matched = Object.values(answers).filter((answer) => answer.matched === true).length;
  const moment = strongestMoment(idea);
  const broker = useMutation({ mutationFn: () => apiPost<{ recorded: boolean }>("/product-interest", { kind: "broker", idea_id: idea.id }) });
  return <main className="paper-page recap-page" data-testid="recap-page"><header className="site-header"><a href="/" className="wordmark" data-testid="recap-wordmark">Aaspaas<span>.</span></a><div className="header-actions"><a className="studio-link" href="/discoveries" data-testid="recap-discoveries-link">My Discoveries</a><span className="mono-label" data-testid="recap-label">YOUR IDEA · FULL READ</span></div></header><div className="recap-intro"><span className="mono-label" data-testid="recap-kicker">A SMALL FIELD GUIDE</span><h1 data-testid="recap-headline">What your observation<br /><em>can teach you.</em></h1><p data-testid="recap-observation">“{idea.observation}”</p></div><section className="share-result-card" data-testid="investor-type-card"><div className="result-card-top"><span className="mono-label">SESSION SNAPSHOT · NOT A PERSONALITY TEST</span><span>{matched}/{attempted} reads matched</span></div><h2 data-testid="investor-type-title">The {type}</h2><p data-testid="investor-type-copy">{type === "Detective" ? "You followed the chain and kept asking what evidence would prove it." : type === "Contrarian" ? "Your first read often differed—which gives you a useful question to investigate." : "You kept the story moving and connected everyday detail to business context."}</p><blockquote data-testid="result-observation-phrase">“{idea.companies[0]?.observation_phrase ?? idea.observation}”</blockquote>{moment && <div className="result-moment" data-testid="result-stock-moment"><strong>{moment.movement.percent >= 0 ? "+" : ""}{moment.movement.percent.toFixed(1)}%</strong><span>{moment.company} · verified adjusted-price movement</span></div>}<div className="result-tickers" data-testid="result-tickers">{idea.companies.map((company) => <span key={company.ticker}>{company.ticker}</span>)}</div></section><section className="recap-grid" data-testid="recap-company-grid">{idea.companies.map((company) => <article className="recap-card" key={company.id} data-testid={`recap-card-${company.ticker.toLowerCase()}`}><div className="recap-card-top"><span className="mono-label">{company.ticker}</span><span className="recap-exchange">{company.connection_strength}</span></div><h2 data-testid={`recap-company-${company.ticker.toLowerCase()}`}>{company.company_name}</h2><p data-testid={`recap-connection-${company.ticker.toLowerCase()}`}>{company.connection}</p><div className="recap-facts" data-testid={`recap-facts-${company.ticker.toLowerCase()}`}><span>Mkt cap <strong>{crore(company.finance.market_cap)}</strong></span><span>P/E <strong>{times(company.finance.pe_ratio)}</strong></span><span>ROE <strong>{pct(company.finance.roe)}</strong></span><span>D/E <strong>{debtEquity(company.finance.debt_to_equity)}</strong></span><small>{company.finance.available ? "Yahoo Finance · may be delayed" : "Live data unavailable right now"}</small></div><div className="recap-lens-list" data-testid={`recap-lenses-${company.ticker.toLowerCase()}`}><span className="recap-lens-kicker">AI-WRITTEN LENSES · NOT SCORES</span>{company.scorecard.map((axis) => <div key={axis.key} className="recap-lens-row"><span>{axis.label}</span><p>{axis.rationale}</p></div>)}</div></article>)}</section><div className="recap-actions"><ShareMenu ideaId={idea.id} observation={idea.observation} period="5Y" surface="recap" label="Share this idea" testId="share-idea-button" /><Button onClick={onTryAgain} variant="outline" size="lg" data-testid="try-another-idea-button">Try another idea <ArrowRight size={17} /></Button><a className="journal-button" href="/discoveries" data-testid="open-journal-button"><BookOpen size={16} /> My Discoveries</a></div><section className="broker-placeholder" data-testid="broker-placeholder"><span className="mono-label">RESEARCH HANDOFF · PARTNER COMING</span><div><h2>Ready to continue your own research?</h2><p>A future disclosed partner link may help readers open a brokerage account elsewhere. Aaspaas will never place a trade.</p></div><Button variant="outline" onClick={() => { broker.mutate(); toast.success("Interest noted. No broker link or affiliate offer is active yet."); }} data-testid="broker-interest-button">Notify me when available</Button></section>{showEmail && <EmailCapture location="recap" ideaId={idea.id} onDismiss={() => { localStorage.setItem("aaspaas-email-dismissed-until", String(Date.now() + 30 * 86400000)); setShowEmail(false); }} />}<p className="disclaimer recap-disclaimer" data-testid="recap-disclaimer">This is educational context, not a recommendation to buy or sell—Aaspaas doesn’t place trades or manage money. Verify real numbers yourself before acting.</p></main>;
}

export default function Home() {
  const params = new URLSearchParams(window.location.search);
  const ideaId = params.get("idea");
  const shared = params.get("shared") === "1";
  const initialView = shared && params.get("landing") === "friend" ? "friend" : params.get("view") === "recap" ? "recap" : "story";
  const [observation, setObservation] = useState("");
  const [idea, setIdea] = useState<IdeaResponse | null>(null);
  const [view, setView] = useState<"landing" | "friend" | "story" | "recap">("landing");
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [limit, setLimit] = useState<LimitDetail | null>(null);
  const [busy, setBusy] = useState<BusyDetail | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem("aaspaas-theme") === "dark");
  const didLogPageview = useRef(false);
  const [tourOpen, setTourOpen] = useState(() => !ideaId && !localStorage.getItem("aaspaas-tour-done"));
  const { track } = useEngagement();
  const closeTour = ({ completed, tasksDone }: { completed: boolean; tasksDone: number }) => { setTourOpen(false); localStorage.setItem("aaspaas-tour-done", "1"); track({ event_name: completed ? "tour_completed" : "tour_skipped", properties: { tasks_done: tasksDone } }); };
  const restored = useQuery({ queryKey: ["idea", ideaId, shared], queryFn: () => apiGet<IdeaResponse>(`/ideas/${ideaId}?shared=${shared}`), enabled: Boolean(ideaId), retry: false });

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("aaspaas-theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { if (!restored.data || idea) return; setIdea(restored.data); setView(initialView); }, [restored.data]);
  useEffect(() => { if (didLogPageview.current || sessionStorage.getItem("aaspaas-pageview")) return; didLogPageview.current = true; sessionStorage.setItem("aaspaas-pageview", "1"); void apiPost<{ recorded: boolean }>("/pageviews").catch(() => undefined); }, []);

  const discover = useMutation({
    mutationFn: ({ observation: value, mode }: { observation: string; mode: InputMode }) => apiPost<IdeaResponse>("/ideas", { observation: value, input_mode: mode }),
    onSuccess: (result) => { setIdea(result); setAnswers({}); setActiveIndex(0); setView("story"); window.history.replaceState({}, "", "/"); },
    onError: (error) => {
      const body = error instanceof ApiError && typeof error.body === "object" && error.body && "detail" in error.body ? (error.body as { detail: unknown }).detail : null;
      if (error instanceof ApiError && error.status === 503 && body && typeof body === "object" && "code" in body) setBusy(body as BusyDetail);
      else if (error instanceof ApiError && error.status === 429 && typeof error.body === "object" && error.body && "detail" in error.body) setLimit((error.body as { detail: LimitDetail }).detail);
      else toast.error("The guide could not map that idea right now. Try again in a moment.");
    },
  });
  const recap = useMutation({ mutationFn: (payload: Record<string, unknown>) => apiPost<{ recorded: boolean }>(`/ideas/${idea?.id}/recap`, payload) });

  const reset = () => { setObservation(""); setIdea(null); setView("landing"); setLimit(null); setBusy(null); window.history.replaceState({}, "", "/"); };
  const isSharedView = shared && idea?.id === ideaId; // a friend's idea: read-only, recap not recorded
  const finishStory = () => {
    if (!idea) return;
    const rows = Object.values(answers), matched = rows.filter((answer) => answer.matched === true).length, attempted = rows.filter((answer) => !answer.skipped).length, skipped = rows.filter((answer) => answer.skipped).length;
    const type = investorType(answers);
    setIdea({ ...idea, investor_type: type, recap_completed_at: new Date().toISOString() });
    if (!isSharedView) recap.mutate({ investor_type: type, matched, attempted, skipped });
    setView("recap");
  };
  const updateCompany = (company: CompanyInsight) => setIdea((current) => current ? { ...current, companies: current.companies.map((item) => item.ticker === company.ticker ? company : item) } : current);
  const updateSaved = (ticker: string, saved: boolean) => setIdea((current) => current ? { ...current, saved_tickers: saved ? [...new Set([...current.saved_tickers, ticker])] : current.saved_tickers.filter((item) => item !== ticker) } : current);

  if (busy) return <BusyWall detail={busy} onBack={() => { window.location.href = "/discoveries"; }} />;
  if (limit) return <LimitWall detail={limit} onBack={() => { track({ event_name: "journal_opened", properties: { from: "limit_wall" } }); window.location.href = "/discoveries"; }} />;
  if (discover.isPending) return <WaitingView observation={observation} />;
  if (restored.isLoading && ideaId) return <WaitingView observation="Restoring your field note" />;
  if (view === "friend" && idea) return <FriendLanding idea={idea} observation={observation} onObservation={setObservation} onSubmit={(value, mode) => discover.mutate({ observation: value, mode })} onOpenRead={() => { setView("story"); window.scrollTo({ top: 0 }); }} />;
  if (view === "story" && idea) {
    if (!idea.companies.length) return <NoMatch observation={idea.observation} onTryAgain={reset} />;
    return <ComparisonExperience idea={idea} answers={answers} onAnswer={(ticker, answer) => setAnswers((old) => ({ ...old, [ticker]: answer }))} onCompanyUpdate={updateCompany} onSavedChange={updateSaved} onFinish={finishStory} />;
  }
  if (view === "recap" && idea) return <Recap idea={idea} answers={answers} onTryAgain={reset} />;
  return <main className="paper-page" data-testid="landing-page"><header className="site-header" data-testid="landing-header"><a href="/" className="wordmark" data-testid="aaspaas-wordmark">Aaspaas<span>.</span></a><div className="header-actions"><a className="studio-link" href="/discoveries" data-testid="my-discoveries-link">My Discoveries</a><button type="button" className="studio-link tour-replay" onClick={() => { setTourOpen(true); track({ event_name: "tour_replayed" }); }} data-testid="replay-tour-button"><Compass size={14} /> Replay tour</button><button className="theme-toggle" type="button" onClick={() => setDark(!dark)} aria-label="Toggle theme" data-testid="theme-toggle-button">{dark ? <Sun size={16} /> : <Moon size={16} />}<span>{dark ? "Light" : "Dark"}</span></button></div></header><div className="landing-layout"><section className="landing-copy" data-testid="landing-intro"><Badge className="eyebrow" data-testid="landing-eyebrow">EVERYDAY OBSERVATIONS → LISTED BUSINESSES</Badge><h1 data-testid="landing-headline">What have you<br /><em>noticed lately?</em></h1><p className="lede" data-testid="landing-lede">The things you keep seeing can be clues. Follow one through the business, the market’s expectations, and the evidence still worth checking.</p><div className="quote-block" data-testid="lynch-quote"><Quote size={20} /><div><p>“Invest in what you know.”</p><span>— Peter Lynch</span></div></div></section><section className="observation-panel" data-testid="observation-panel"><ObservationForm value={observation} onChange={setObservation} onSubmit={(value, mode) => discover.mutate({ observation: value, mode })} /><div className="how-it-works" data-testid="scoring-explainer"><p className="mono-label" data-testid="scoring-explainer-title">HOW THE READ WORKS</p><div className="explainer-row"><span>01</span><p><strong>Trace the chain</strong> from your words to revenue and profit.</p></div><div className="explainer-row"><span>02</span><p><strong>See a verified price moment</strong> without inventing its cause.</p></div><div className="explainer-row"><span>03</span><p><strong>Keep your own homework</strong> with a field note and research prompts.</p></div></div></section></div><footer className="disclaimer" data-testid="landing-disclaimer">This is educational context, not a recommendation to buy or sell—Aaspaas doesn’t place trades or manage money. Verify real numbers yourself before acting.</footer><LandingTour open={tourOpen && view === "landing"} onClose={closeTour} /></main>;
}