import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Instagram } from "lucide-react";
import { toast } from "sonner";

import { useAccount } from "@/components/AccountProvider";
import { HeaderNav } from "@/components/HeaderNav";
import { ShareMenuLink } from "@/components/ShareLink";
import { todayQuery } from "@/components/TrendingStrip";
import { YouTubeEmbed } from "@/components/Video";
import { useEngagement } from "@/hooks/useEngagement";
import { apiGet, apiPost } from "@/lib/api";
import { METRICS, fundamentalsQuery } from "@/lib/fundamentals";
import { learnQuery, setMeta, trafficSource } from "@/lib/learn";
import { useQueries } from "@tanstack/react-query";
import type { IdeaResponse, LearnResponse, Lesson as LessonType } from "@/lib/types";

function Header() {
  return <header className="site-header"><a href="/" className="wordmark" data-testid="learn-wordmark">Aaspaas<span>.</span></a><HeaderNav /></header>;
}

function LiveMetric({ lesson }: { lesson: LessonType }) {
  const metric = METRICS.find((item) => item.key === lesson.metric);
  const today = useQuery({ ...todayQuery, enabled: Boolean(metric) });
  const ideaId = today.data?.clues[0]?.idea_id;
  const idea = useQuery({ queryKey: ["idea", ideaId, true], queryFn: () => apiGet<IdeaResponse>(`/ideas/${ideaId}?shared=true`), enabled: Boolean(ideaId && metric) });
  const rows = (idea.data?.companies ?? []).flatMap((company) => [{ ticker: company.ticker, exchange: company.exchange, name: company.company_name, peer: false }, ...(company.peers ?? []).map((peer) => ({ ticker: peer.ticker, exchange: peer.exchange, name: peer.company_name, peer: true }))]);
  const facts = useQueries({ queries: rows.map((row) => fundamentalsQuery(row.exchange, row.ticker)) });
  if (!metric || !rows.length) return null;
  return <section className="live-metric" data-testid="lesson-live-metric">
    <span className="mono-label">SEE IT ON REAL COMPANIES · {metric.label.toUpperCase()} · YAHOO FINANCE</span>
    <p>From today’s clue: “{today.data?.clues[0]?.observation}”. Compare within each group, not across sectors.</p>
    <div className="live-metric-rows">{rows.map((row, index) => { const data = facts[index]?.data; const value = data?.available ? data[metric.key] : null; return <div key={row.ticker} className={row.peer ? "peer" : ""} data-testid={`lesson-live-row-${row.ticker.toLowerCase()}`}><span>{row.name}{row.peer && <small> · rival</small>}</span><strong className={metric.tone(value)}>{facts[index]?.isLoading ? "…" : metric.format(value)}</strong></div>; })}</div>
    <small>Sourced data, may be delayed or incomplete · not a ranking</small>
  </section>;
}

export function LearnHub() {
  const learn = useQuery(learnQuery);
  useEffect(() => setMeta("Learn — Aaspaas: free lessons on business, stocks and tax", "Free video lessons for new earners: revenue, margins, cash flow, ROCE, moats, SIPs, FD/PPF, tax on shares and why most F&O traders lose."), []);
  const watched = new Set(learn.data?.watched ?? []);
  return <main className="paper-page learn-page" data-testid="learn-hub"><Header />
    <section className="learn-intro"><span className="mono-label">AASPAAS LEARN · FREE · NO SIGN-UP</span><h1 data-testid="learn-title">A small course book<br /><em>for first-time earners.</em></h1><p>Follow Sharma Chai’s first year, then judge real businesses and the money basics nobody teaches you. Every lesson is general education, not advice.</p></section>
    {learn.data?.modules.map((module) => { const lessons = learn.data!.lessons.filter((lesson) => lesson.module === module.key); const done = lessons.filter((lesson) => watched.has(lesson.slug)).length; return <section key={module.key} className={`learn-module module-${module.number}`} data-testid={`learn-module-${module.number}`}>
      <div className="learn-module-head"><span className="mono-label">MODULE {module.number} · {done}/{lessons.length} WATCHED</span><h2>{module.title}</h2><p>{module.subtitle}</p><i style={{ transform: `scaleX(${lessons.length ? done / lessons.length : 0})` }} /></div>
      <div className="lesson-grid">{lessons.map((lesson) => <a key={lesson.slug} href={`/learn/${lesson.slug}`} className="lesson-card" data-testid={`lesson-card-${lesson.slug}`}><span className="lesson-number">{String(lesson.number).padStart(2, "0")}</span><div><strong>{lesson.title}</strong><p>{lesson.promise}</p><small>{lesson.youtube_url ? lesson.duration : "Notes · video soon"}</small></div>{watched.has(lesson.slug) && <Check size={15} className="lesson-tick" data-testid={`lesson-watched-${lesson.slug}`} />}</a>)}</div>
    </section>; })}
    <p className="disclaimer">General education, not investment or tax advice. Aaspaas doesn’t place trades or manage money.</p>
  </main>;
}

export function LessonPage() {
  const { slug = "" } = useParams();
  const learn = useQuery(learnQuery);
  const queryClient = useQueryClient();
  const { track } = useEngagement();
  const { requireSignIn, account } = useAccount();
  const lessons = learn.data?.lessons ?? [];
  const index = lessons.findIndex((item) => item.slug === slug);
  const lesson = lessons[index];
  const next = lessons[index + 1];
  const watched = learn.data?.watched.includes(slug) ?? false;
  const mark = useMutation({ mutationFn: (value: boolean) => apiPost<LearnResponse>(`/lessons/${slug}/watched?watched=${value}`), onSuccess: (data) => queryClient.setQueryData(["lessons"], data) });
  useEffect(() => { if (!lesson) return; setMeta(`${lesson.title} — Aaspaas Learn`, `${lesson.promise} ${lesson.key_idea}`); track({ event_name: "lesson_viewed", properties: { slug, source: trafficSource() } }); }, [lesson?.slug]);
  if (learn.isLoading) return <main className="paper-page learn-page"><Header /><p className="learn-loading">Opening the lesson…</p></main>;
  if (!lesson) return <main className="paper-page learn-page"><Header /><p className="learn-loading" data-testid="lesson-not-found">That lesson isn’t here. <a href="/learn">See all lessons</a></p></main>;
  return <main className="paper-page learn-page lesson-page" data-testid="lesson-page"><Header />
    <a href="/learn" className="back-link" data-testid="lesson-back-link"><ArrowLeft size={13} /> All lessons</a>
    <span className="mono-label lesson-kicker">LESSON {String(lesson.number).padStart(2, "0")} · {lesson.duration}</span>
    <h1 data-testid="lesson-title">{lesson.title}</h1>
    <p className="lesson-promise">{lesson.promise}</p>
    <YouTubeEmbed url={lesson.youtube_url} title={lesson.title} onPlay={() => { track({ event_name: "lesson_video_played", properties: { slug } }); if (!watched) mark.mutate(true); }} testId="lesson-video" />
    <div className="lesson-meta-row">
      <button type="button" className={watched ? "lesson-watch done" : "lesson-watch"} onClick={() => mark.mutate(!watched)} data-testid="lesson-mark-watched"><Check size={13} />{watched ? "Watched" : "Mark as watched"}</button>
      {lesson.reel_url && <a href={lesson.reel_url} target="_blank" rel="noreferrer" className="lesson-reel" data-testid="lesson-reel-link"><Instagram size={13} /> Also on Instagram</a>}
    </div>
    {lesson.is_tax && <p className="tax-note" data-testid="lesson-tax-note">General information, not tax advice · rates as of FY 2026-27 · last checked {lesson.last_checked}</p>}
    <section className="lesson-notes"><span className="mono-label">KEY IDEA</span><p className="lesson-key" data-testid="lesson-key-idea">{lesson.key_idea}</p>{lesson.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<div className="lesson-example" data-testid="lesson-example"><span className="mono-label">₹ WORKED EXAMPLE</span><p>{lesson.example}</p></div><div className="lesson-checks"><span className="mono-label">CHECK IT YOURSELF</span><ol>{lesson.checks.map((check) => <li key={check}>{check}</li>)}</ol></div></section>
    {lesson.number <= 10 && <LiveMetric lesson={lesson} />}
    <section className="lesson-next" data-testid="lesson-next-steps">
      {next && <a href={`/learn/${next.slug}`} className="lesson-next-primary" data-testid="lesson-next-link">Next: {next.title} <ArrowRight size={14} /></a>}
      <a href="/" onClick={() => track({ event_name: "lesson_to_clue", properties: { slug } })} data-testid="lesson-try-clue">Try it on your own clue</a>
      <a href="/today" data-testid="lesson-portfolio-link">Add a company to your practice portfolio</a>
      <ShareMenuLink path={`/api/share/lesson/${slug}`} text={`${lesson.title} — a 6-minute Aaspaas lesson`} testId="lesson-share" />
    </section>
    {!account?.updates_opt_in && <section className="lesson-email" data-testid="lesson-email-box"><div><strong>Email me new lessons</strong><p>Uses the same one-tap email sign-in. Consent is recorded; no newsletter is sent yet.</p></div><button type="button" onClick={() => { if (account?.signed_in) void apiPost("/auth/updates").then(() => { void queryClient.invalidateQueries({ queryKey: ["account"] }); toast.success("You'll hear about new lessons."); }); else requireSignIn({ location: "learn", updatesDefault: true, heading: "Get new Aaspaas lessons by email" }); }} data-testid="lesson-email-button">Sign me up</button></section>}
    <p className="disclaimer">General education, not investment or tax advice. Verify numbers yourself before acting.</p>
  </main>;
}
