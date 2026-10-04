import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ExternalLink } from "lucide-react";

import { useEngagement } from "@/hooks/useEngagement";
import { apiGet } from "@/lib/api";
import type { TrendingClue, TrendingDay } from "@/lib/types";

export const todayQuery = { queryKey: ["trending-today"] as const, queryFn: () => apiGet<TrendingDay>("/trending/today"), staleTime: 5 * 60 * 1000 };

export function ClueCard({ clue, onUse }: { clue: TrendingClue; onUse?: (text: string) => void }) {
  const { track } = useEngagement();
  return <article className="clue-card" data-testid={`clue-card-${clue.id}`}>
    <div className="clue-stamp"><span className="mono-label">{clue.date}</span>{clue.source_url ? <a href={clue.source_url} target="_blank" rel="noreferrer" data-testid={`clue-source-${clue.id}`}>Spotted in: {clue.source} <ExternalLink size={10} /></a> : <span>Spotted in: {clue.source}</span>}</div>
    <p className="clue-observation" data-testid={`clue-observation-${clue.id}`}>“{clue.observation}”</p>
    <div className="clue-tickers">{clue.tickers.map((ticker) => <span key={ticker}>{ticker}</span>)}</div>
    <div className="clue-actions">
      {clue.idea_id && <a href={`/?idea=${clue.idea_id}&shared=1&src=trending`} onClick={() => track({ event_name: "trending_clue_opened", idea_id: clue.idea_id ?? undefined })} className="clue-open" data-testid={`clue-open-${clue.id}`}>Open the read <ArrowRight size={13} /></a>}
      <button type="button" className="clue-use" onClick={() => { track({ event_name: "trending_to_clue", properties: { clue: clue.id } }); if (onUse) onUse(clue.observation); else window.location.href = `/?clue=${encodeURIComponent(clue.observation)}`; }} data-testid={`clue-use-${clue.id}`}>Use as my own clue</button>
    </div>
  </article>;
}

export function TrendingStrip({ onUse, compact = false }: { onUse: (text: string) => void; compact?: boolean }) {
  const today = useQuery(todayQuery);
  const { track } = useEngagement();
  useEffect(() => { if (today.data?.clues.length) track({ event_name: "trending_strip_viewed", properties: { count: today.data.clues.length } }); }, [today.data?.date]);
  if (today.isLoading) return <section className={compact ? "trending-strip compact" : "trending-strip"} data-testid="trending-strip-loading"><div className="strip-head"><span className="mono-label">TODAY PEOPLE ARE NOTICING</span></div><div className="trending-row">{[0, 1, 2].map((i) => <div key={i} className="clue-card skeleton" />)}</div></section>;
  if (!today.data?.clues.length) return null;
  return <section className={compact ? "trending-strip compact" : "trending-strip"} data-testid="trending-strip">
    <div className="strip-head"><span className="mono-label">{today.data.status === "fresh" ? "TODAY PEOPLE ARE NOTICING" : `PEOPLE WERE NOTICING · ${today.data.date}`}</span><a href="/today" data-testid="trending-see-all">All clues & archive <ArrowRight size={12} /></a></div>
    <div className="trending-row">{today.data.clues.map((clue) => <ClueCard key={clue.id} clue={clue} onUse={onUse} />)}</div>
  </section>;
}
