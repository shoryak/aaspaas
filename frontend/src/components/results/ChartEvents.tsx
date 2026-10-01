import { ExternalLink, X } from "lucide-react";
import { motion } from "motion/react";

import { slug } from "@/lib/performance";
import type { MarketEvent } from "@/lib/types";

export type EventFilter = "key" | "results";
export interface EventGroup { x: number; events: MarketEvent[] }

const RESULT_KINDS = new Set(["results", "dividend", "split"]);
export const eventAllowed = (event: MarketEvent, filter: EventFilter) => filter === "key" || RESULT_KINDS.has(event.kind);

/** Greedy pixel clustering so dense filing histories stay tappable. */
export function clusterEvents(events: MarketEvent[], toX: (event: MarketEvent) => number, gap = 16): EventGroup[] {
  const groups: (EventGroup & { start: number })[] = [];
  for (const event of events) {
    const x = toX(event);
    const last = groups[groups.length - 1];
    if (last && x - last.start < gap) {
      last.events.push(event);
      last.x = (last.start + x) / 2;
    } else groups.push({ start: x, x, events: [event] });
  }
  return groups.map(({ x, events: rows }) => ({ x, events: rows }));
}

const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function EventPopover({ group, colors, left, bottom, onClose }: { group: EventGroup; colors: Record<string, string>; left: number; bottom: number; onClose: () => void }) {
  const first = group.events[0].date, last = group.events[group.events.length - 1].date;
  const range = first === last ? formatDate(first) : `${formatDate(first)} – ${formatDate(last)}`;
  return <motion.div className="event-popover" style={{ left, bottom }} initial={{ opacity: 0, y: 10, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .28, ease: [0.22, 1, 0.36, 1] }} data-testid="event-popover" onPointerDown={(event) => event.stopPropagation()}>
    <div className="event-popover-head"><span className="event-popover-kicker" data-testid="event-popover-kicker">CONTEXT, NOT A CAUSE</span><button type="button" onClick={onClose} aria-label="Close filings" data-testid="event-popover-close"><X size={14} /></button></div>
    <p className="event-popover-range" data-testid="event-popover-range">{`${group.events.length} ${group.events.length === 1 ? "event" : "events"} · ${range}`}</p>
    <ul className="event-popover-list">
      {group.events.map((event, index) => <li key={`${event.ticker}-${event.date}-${index}`} data-testid={`event-item-${slug(event.ticker)}-${index}`}>
        <div className="event-item-meta"><i style={{ background: colors[event.ticker] ?? "#efeee8" }} /><span className="event-item-ticker">{event.ticker}</span><span className="event-item-date">{formatDate(event.date)}</span><span className={`event-kind event-kind-${event.kind}`}>{event.category}</span></div>
        <p className="event-item-summary">{event.summary}</p>
        {event.url ? <a href={event.url} target="_blank" rel="noreferrer" className="event-item-link" data-testid={`event-item-link-${index}`}>Open original filing <ExternalLink size={11} /></a> : <span className="event-item-source">{`Source: ${event.source}`}</span>}
      </li>)}
    </ul>
    <p className="event-popover-foot">A filing near a date does not, on its own, explain a price move. Read the document before forming a view.</p>
  </motion.div>;
}
