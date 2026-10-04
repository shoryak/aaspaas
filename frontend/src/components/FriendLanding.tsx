import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HeaderNav } from "@/components/HeaderNav";
import { VideoOverlay } from "@/components/Video";
import { videosQuery } from "@/lib/learn";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";

import { ObservationForm } from "@/components/ObservationForm";
import type { InputMode } from "@/components/ObservationForm";
import { Button } from "@/components/ui/button";
import { useEngagement } from "@/hooks/useEngagement";
import type { IdeaResponse } from "@/lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Where shared links land: the visitor's own clue first, the friend's read underneath. */
export function FriendLanding({ idea, observation, onObservation, onSubmit, onOpenRead }: {
  idea: IdeaResponse; observation: string; onObservation: (value: string) => void; onSubmit: (value: string, mode: InputMode) => void; onOpenRead: () => void;
}) {
  const { track } = useEngagement();
  const logged = useRef(false);
  const videos = useQuery(videosQuery);
  const [video, setVideo] = useState(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    track({ event_name: "friend_landing_viewed", idea_id: idea.id, properties: { companies: idea.companies.length } });
  }, [idea.id, idea.companies.length, track]);

  return <main className="paper-page friend-page" data-testid="friend-landing-page">{video && videos.data?.friend && <VideoOverlay url={videos.data.friend} title="How Aaspaas works" onClose={() => setVideo(false)} />}
    <header className="site-header"><a href="/" className="wordmark" data-testid="friend-wordmark">Aaspaas<span>.</span></a><div className="header-actions">{videos.data?.friend && <button type="button" className="studio-link" onClick={() => { setVideo(true); track({ event_name: "launch_video_opened", properties: { placement: "friend" } }); }} data-testid="friend-video-button">▶ How Aaspaas works</button>}<HeaderNav /></div></header>
    <section className="friend-hero" data-testid="friend-hero">
      <motion.div className="friend-hero-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, ease: EASE }}>
        <span className="mono-label friend-kicker" data-testid="friend-kicker">A FRIEND SENT YOU A CLUE</span>
        <h1 data-testid="friend-headline">What would <em>you</em><br />have noticed?</h1>
        <p className="lede" data-testid="friend-lede">{`Your friend turned one everyday observation into ${idea.companies.length || "no"} listed ${idea.companies.length === 1 ? "company" : "companies"}. Yours could be the queue at your chemist, the app everyone at work installed, or the brand suddenly in every kitchen.`}</p>
      </motion.div>
      <motion.section className="observation-panel friend-panel" data-testid="friend-observation-panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .12, ease: EASE }}>
        <ObservationForm value={observation} onChange={onObservation} submitLabel="Find my companies" placeholder="Lately I keep noticing…" onSubmit={(value, mode) => { track({ event_name: "friend_landing_submitted", idea_id: idea.id, properties: { input_mode: mode } }); onSubmit(value, mode); }} />
      </motion.section>
    </section>

    <motion.section className="friend-read" data-testid="friend-read" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .7, ease: EASE }}>
      <div className="friend-read-head"><span className="mono-label" data-testid="friend-read-kicker">THEIR READ</span><blockquote data-testid="friend-read-observation">{`“${idea.observation}”`}</blockquote></div>
      {idea.companies.length > 0 && <img className="friend-read-image" src={`/api/share/${idea.id}/image.png?period=5Y`} alt={`Five-year adjusted price comparison for ${idea.companies.map((company) => company.ticker).join(", ")}`} loading="lazy" data-testid="friend-read-chart" />}
      <div className="friend-read-companies" data-testid="friend-read-companies">{idea.companies.map((company) => <div className="friend-company" key={company.ticker} data-testid={`friend-company-${company.ticker.toLowerCase()}`}><span className="mono-label">{`${company.exchange} · ${company.ticker}`}</span><strong>{company.company_name}</strong><p>{company.connection}</p></div>)}</div>
      <Button variant="outline" size="lg" className="friend-read-button" onClick={() => { track({ event_name: "friend_landing_full_read", idea_id: idea.id }); onOpenRead(); }} data-testid="friend-full-read-button">See their full read <ArrowRight size={17} /></Button>
    </motion.section>
    <footer className="disclaimer" data-testid="friend-disclaimer">This is educational context, not a recommendation to buy or sell—Aaspaas doesn’t place trades or manage money. Verify real numbers yourself before acting.</footer>
  </main>;
}
