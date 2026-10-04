import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, PlayCircle } from "lucide-react";

import { useEngagement } from "@/hooks/useEngagement";
import { learnQuery } from "@/lib/learn";

/** Compact swipeable row of short lessons, shown near the top of the landing page. */
export function LearnStrip() {
  const learn = useQuery(learnQuery);
  const { track } = useEngagement();
  const lessons = learn.data?.lessons ?? [];
  if (!lessons.length) return null;
  const watched = new Set(learn.data?.watched ?? []);
  return <section className="learn-strip" data-testid="learn-strip">
    <div className="strip-head"><span className="mono-label">LEARN IN 6 MINUTES · FREE</span><a href="/learn" data-testid="learn-strip-all">All {lessons.length} lessons <ArrowRight size={12} /></a></div>
    <div className="learn-strip-row">{lessons.map((lesson) => <a key={lesson.slug} href={`/learn/${lesson.slug}`} className="learn-chip" onClick={() => track({ event_name: "learn_strip_opened", properties: { slug: lesson.slug } })} data-testid={`learn-chip-${lesson.slug}`}>
      <span className="learn-chip-num">{String(lesson.number).padStart(2, "0")}</span>
      <span className="learn-chip-text"><strong>{lesson.title}</strong><small>{watched.has(lesson.slug) ? <><Check size={10} /> watched</> : lesson.youtube_url ? <><PlayCircle size={10} /> {lesson.duration}</> : "notes · video soon"}</small></span>
    </a>)}</div>
  </section>;
}
