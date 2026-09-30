import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Moon, Quote, Share2, Sparkles, Sun } from "lucide-react";
import { toast } from "sonner";

import { EmailCapture } from "@/components/EmailCapture";
import { StoryExperience } from "@/components/story/StoryExperience";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEngagement } from "@/hooks/useEngagement";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { AnswerRecord, CompanyInsight, IdeaResponse, PriceMovement } from "@/lib/types";

const EXAMPLES = [
  "Every wedding I've been to this year used the same online invite website",
  "The same quick-commerce bags are showing up in every apartment lobby",
  "I keep seeing solar panels appear on factory rooftops near me",
];
const WAITING_NOTES = [
  ["Follow the revenue", "A visible habit matters only when it reaches a listed company’s economics."],
  ["Price is an expectation", "A dramatic stock move does not prove a business became better or worse overnight."],
  ["Look for the enabler", "The less obvious supplier or platform can reveal more than the brand on the surface."],
  ["Try to disprove it", "A useful investment question names the evidence that would break the story."],
];

interface LimitDetail { message: string; reset_at: string; daily_limit: number }

function waitingCopy(index: number) { return WAITING_NOTES[index % WAITING_NOTES.length]; }

function WaitingView({ observation }: { observation: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setIndex((value) => value + 1), 2300); return () => window.clearInterval(timer); }, []);
  const note = waitingCopy(index);
  return <main className="waiting-page" data-testid="discovery-waiting-page"><div className="waiting-orbit" aria-hidden="true"><i /><i /><i /></div><span className="mono-label" data-testid="waiting-kicker">FOLLOWING YOUR CLUE</span><h1 data-testid="waiting-title">“{observation}”</h1><div className="waiting-note" key={note[0]} data-testid="waiting-note"><strong>{note[0]}</strong><p>{note[1]}</p></div><div className="waiting-checks" data-testid="waiting-checks"><span>01 · mapping real NSE/BSE exposure</span><span>02 · separating judgment from sourced data</span><span>03 · preparing the first company while evidence follows</span></div></main>;
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

function investorType(answers: Record<string, AnswerRecord>) {
  const rows = Object.values(answers);
  const attempted = rows.filter((answer) => !answer.skipped).length;
  const skipped = rows.filter((answer) => answer.skipped).length;
  const matched = rows.filter((answer) => answer.matched === true).length;
  if (skipped > attempted) return "Storyteller";
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
  const share = async () => {
    void apiPost<{ recorded: boolean }>("/shares", { idea_id: idea.id }).catch(() => undefined);
    const url = `${window.location.origin}/?idea=${idea.id}&view=recap&shared=1`;
    if (navigator.share) await navigator.share({ title: `My Aaspaas read: ${type}`, text: idea.observation, url }).catch(() => undefined);
    else await navigator.clipboard?.writeText(url).catch(() => undefined);
    toast.success("Share link ready—send the field note to a curious friend.");
  };
  const broker = useMutation({ mutationFn: () => apiPost<{ recorded: boolean }>("/product-interest", { kind: "broker", idea_id: idea.id }) });
  return <main className="paper-page recap-page" data-testid="recap-page"><header className="site-header"><a href="/" className="wordmark" data-testid="recap-wordmark">Aaspaas<span>.</span></a><div className="header-actions"><a className="studio-link" href="/discoveries" data-testid="recap-discoveries-link">My Discoveries</a><span className="mono-label" data-testid="recap-label">YOUR IDEA · FULL READ</span></div></header><div className="recap-intro"><span className="mono-label" data-testid="recap-kicker">A SMALL FIELD GUIDE</span><h1 data-testid="recap-headline">What your observation<br /><em>can teach you.</em></h1><p data-testid="recap-observation">“{idea.observation}”</p></div><section className="share-result-card" data-testid="investor-type-card"><div className="result-card-top"><span className="mono-label">SESSION SNAPSHOT · NOT A PERSONALITY TEST</span><span>{matched}/{attempted} reads matched</span></div><h2 data-testid="investor-type-title">The {type}</h2><p data-testid="investor-type-copy">{type === "Detective" ? "You followed the chain and kept asking what evidence would prove it." : type === "Contrarian" ? "Your first read often differed—which gives you a useful question to investigate." : "You kept the story moving and connected everyday detail to business context."}</p><blockquote data-testid="result-observation-phrase">“{idea.companies[0]?.observation_phrase ?? idea.observation}”</blockquote>{moment && <div className="result-moment" data-testid="result-stock-moment"><strong>{moment.movement.percent >= 0 ? "+" : ""}{moment.movement.percent.toFixed(1)}%</strong><span>{moment.company} · verified adjusted-price movement</span></div>}<div className="result-tickers" data-testid="result-tickers">{idea.companies.map((company) => <span key={company.ticker}>{company.ticker}</span>)}</div></section><section className="recap-grid" data-testid="recap-company-grid">{idea.companies.map((company) => <article className="recap-card" key={company.id} data-testid={`recap-card-${company.ticker.toLowerCase()}`}><div className="recap-card-top"><span className="mono-label">{company.ticker}</span><span className="recap-exchange">{company.connection_strength}</span></div><h2 data-testid={`recap-company-${company.ticker.toLowerCase()}`}>{company.company_name}</h2><p data-testid={`recap-connection-${company.ticker.toLowerCase()}`}>{company.connection}</p><div className="recap-score-list">{company.scorecard.map((axis) => <div key={axis.key} className="recap-score-row"><span>{axis.label}</span><div className="mini-pips">{[1, 2, 3, 4, 5].map((pip) => <i key={pip} className={pip <= axis.score ? "pip-on" : ""} />)}</div></div>)}</div></article>)}</section><div className="recap-actions"><Button onClick={() => void share()} size="lg" data-testid="share-idea-button"><Share2 size={17} /> Share this idea</Button><Button onClick={onTryAgain} variant="outline" size="lg" data-testid="try-another-idea-button">Try another idea <ArrowRight size={17} /></Button><a className="journal-button" href="/discoveries" data-testid="open-journal-button"><BookOpen size={16} /> My Discoveries</a></div><section className="broker-placeholder" data-testid="broker-placeholder"><span className="mono-label">RESEARCH HANDOFF · PARTNER COMING</span><div><h2>Ready to continue your own research?</h2><p>A future disclosed partner link may help readers open a brokerage account elsewhere. Aaspaas will never place a trade.</p></div><Button variant="outline" onClick={() => { broker.mutate(); toast.success("Interest noted. No broker link or affiliate offer is active yet."); }} data-testid="broker-interest-button">Notify me when available</Button></section>{showEmail && <EmailCapture location="recap" ideaId={idea.id} onDismiss={() => { localStorage.setItem("aaspaas-email-dismissed-until", String(Date.now() + 30 * 86400000)); setShowEmail(false); }} />}<p className="disclaimer recap-disclaimer" data-testid="recap-disclaimer">This is educational context, not a recommendation to buy or sell—Aaspaas doesn’t place trades or manage money. Verify real numbers yourself before acting.</p></main>;
}

export default function Home() {
  const params = new URLSearchParams(window.location.search);
  const ideaId = params.get("idea");
  const shared = params.get("shared") === "1";
  const initialView = params.get("view") === "recap" ? "recap" : "story";
  const [observation, setObservation] = useState("");
  const [idea, setIdea] = useState<IdeaResponse | null>(null);
  const [view, setView] = useState<"landing" | "story" | "recap">("landing");
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [limit, setLimit] = useState<LimitDetail | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem("aaspaas-theme") === "dark");
  const didLogPageview = useRef(false);
  const { track } = useEngagement();
  const restored = useQuery({ queryKey: ["idea", ideaId, shared], queryFn: () => apiGet<IdeaResponse>(`/ideas/${ideaId}?shared=${shared}`), enabled: Boolean(ideaId), retry: false });

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("aaspaas-theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { if (!restored.data || idea) return; setIdea(restored.data); setView(initialView); }, [restored.data]);
  useEffect(() => { if (didLogPageview.current || sessionStorage.getItem("aaspaas-pageview")) return; didLogPageview.current = true; sessionStorage.setItem("aaspaas-pageview", "1"); void apiPost<{ recorded: boolean }>("/pageviews").catch(() => undefined); }, []);

  const discover = useMutation({
    mutationFn: (value: string) => apiPost<IdeaResponse>("/ideas", { observation: value }),
    onSuccess: (result) => { setIdea(result); setAnswers({}); setActiveIndex(0); setView("story"); },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 429 && typeof error.body === "object" && error.body && "detail" in error.body) setLimit((error.body as { detail: LimitDetail }).detail);
      else toast.error("The guide could not map that idea right now. Try again in a moment.");
    },
  });
  const recap = useMutation({ mutationFn: (payload: Record<string, unknown>) => apiPost<{ recorded: boolean }>(`/ideas/${idea?.id}/recap`, payload) });

  const reset = () => { setObservation(""); setIdea(null); setView("landing"); setLimit(null); window.history.replaceState({}, "", "/"); };
  const finishStory = () => {
    if (!idea) return;
    const rows = Object.values(answers), matched = rows.filter((answer) => answer.matched === true).length, attempted = rows.filter((answer) => !answer.skipped).length, skipped = rows.filter((answer) => answer.skipped).length;
    const type = investorType(answers);
    setIdea({ ...idea, investor_type: type, recap_completed_at: new Date().toISOString() });
    recap.mutate({ investor_type: type, matched, attempted, skipped });
    setView("recap");
  };
  const updateCompany = (company: CompanyInsight) => setIdea((current) => current ? { ...current, companies: current.companies.map((item) => item.ticker === company.ticker ? company : item) } : current);
  const updateSaved = (ticker: string, saved: boolean) => setIdea((current) => current ? { ...current, saved_tickers: saved ? [...new Set([...current.saved_tickers, ticker])] : current.saved_tickers.filter((item) => item !== ticker) } : current);

  if (limit) return <LimitWall detail={limit} onBack={() => { track({ event_name: "journal_opened", properties: { from: "limit_wall" } }); window.location.href = "/discoveries"; }} />;
  if (discover.isPending) return <WaitingView observation={observation} />;
  if (restored.isLoading && ideaId) return <WaitingView observation="Restoring your field note" />;
  if (view === "story" && idea) {
    if (!idea.companies.length) return <NoMatch observation={idea.observation} onTryAgain={reset} />;
    return <StoryExperience idea={idea} activeIndex={activeIndex} answers={answers} onAnswer={(ticker, answer) => setAnswers((old) => ({ ...old, [ticker]: answer }))} onCompanyUpdate={updateCompany} onSavedChange={updateSaved} onIndexChange={setActiveIndex} onFinish={finishStory} />;
  }
  if (view === "recap" && idea) return <Recap idea={idea} answers={answers} onTryAgain={reset} />;
  return <main className="paper-page" data-testid="landing-page"><header className="site-header" data-testid="landing-header"><a href="/" className="wordmark" data-testid="aaspaas-wordmark">Aaspaas<span>.</span></a><div className="header-actions"><a className="studio-link" href="/discoveries" data-testid="my-discoveries-link">My Discoveries</a><a className="studio-link" href="/admin" data-testid="admin-dashboard-link">Studio</a><button className="theme-toggle" type="button" onClick={() => setDark(!dark)} aria-label="Toggle theme" data-testid="theme-toggle-button">{dark ? <Sun size={16} /> : <Moon size={16} />}<span>{dark ? "Light" : "Dark"}</span></button></div></header><div className="landing-layout"><section className="landing-copy" data-testid="landing-intro"><Badge className="eyebrow" data-testid="landing-eyebrow">EVERYDAY OBSERVATIONS → LISTED BUSINESSES</Badge><h1 data-testid="landing-headline">What have you<br /><em>noticed lately?</em></h1><p className="lede" data-testid="landing-lede">The things you keep seeing can be clues. Follow one through the business, the market’s expectations, and the evidence still worth checking.</p><div className="quote-block" data-testid="lynch-quote"><Quote size={20} /><div><p>“Invest in what you know.”</p><span>— Peter Lynch</span></div></div></section><section className="observation-panel" data-testid="observation-panel"><form onSubmit={(event) => { event.preventDefault(); if (observation.trim().length < 8) toast.error("Give us one useful sentence."); else discover.mutate(observation.trim()); }} data-testid="observation-form"><label htmlFor="observation" className="mono-label" data-testid="observation-label">YOUR OBSERVATION</label><Textarea id="observation" value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="I keep noticing…" className="observation-input" data-testid="observation-textarea" /><div className="example-wrap" data-testid="example-chips"><span className="micro-label" data-testid="example-label">Try an example</span>{EXAMPLES.map((example, index) => <button key={example} type="button" className="example-chip" onClick={() => setObservation(example)} data-testid={`example-chip-${index + 1}`}>{example}</button>)}</div><Button type="submit" size="lg" className="discover-button" data-testid="discover-submit-button">Follow the clue <ArrowRight size={18} /></Button><p className="allowance-note" data-testid="daily-allowance-note">Three AI-powered discoveries per UTC day. Reading and sharing stay open.</p></form><div className="how-it-works" data-testid="scoring-explainer"><p className="mono-label" data-testid="scoring-explainer-title">HOW THE READ WORKS</p><div className="explainer-row"><span>01</span><p><strong>Trace the chain</strong> from your words to revenue and profit.</p></div><div className="explainer-row"><span>02</span><p><strong>See a verified price moment</strong> without inventing its cause.</p></div><div className="explainer-row"><span>03</span><p><strong>Keep your own homework</strong> with a field note and research prompts.</p></div></div></section></div><footer className="disclaimer" data-testid="landing-disclaimer">This is educational context, not a recommendation to buy or sell—Aaspaas doesn’t place trades or manage money. Verify real numbers yourself before acting.</footer></main>;
}