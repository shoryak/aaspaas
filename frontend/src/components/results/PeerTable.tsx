import { useEffect, useRef, useState } from "react";
import type { UIEvent } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronsRight, Info, X } from "lucide-react";

import { useEngagement } from "@/hooks/useEngagement";
import { apiGet } from "@/lib/api";
import { METRICS, fundamentalsQuery } from "@/lib/fundamentals";
import type { MetricKey } from "@/lib/fundamentals";
import { slug } from "@/lib/performance";
import type { CompanyFundamentals, CompanyInsight, Peer, PeerGroupsResponse } from "@/lib/types";

const HINT_KEY = "aaspaas-peer-swipe-hint";
const viewedIdeas = new Set<string>(); // one peer_table_viewed per idea per page load (detail → back remounts the table)

interface Row { ticker: string; exchange: "NSE" | "BSE"; name: string; peer: Peer | null }

function MetricCells({ row, data, loading }: { row: Row; data?: CompanyFundamentals; loading: boolean }) {
  return <>{METRICS.map((metric) => {
    const value = data?.available ? data[metric.key] : null;
    return <td key={metric.key} className={value === null ? "peer-cell empty" : `peer-cell ${metric.tone(value)}`} data-testid={`peer-cell-${slug(row.ticker)}-${metric.key}`}>{loading ? <i className="peer-skeleton" /> : metric.format(value)}</td>;
  })}</>;
}

export function PeerTable({ ideaId, companies, onOpenCompany }: { ideaId: string; companies: CompanyInsight[]; onOpenCompany: (ticker: string) => void }) {
  const { track } = useEngagement();
  const peers = useQuery({ queryKey: ["peers", ideaId], queryFn: () => apiGet<PeerGroupsResponse>(`/ideas/${ideaId}/peers`), staleTime: Infinity, retry: 1 });
  const groups = companies.map((company) => {
    const found = peers.data?.status === "ready" ? peers.data.groups.find((group) => group.ticker === company.ticker)?.peers ?? [] : company.peers;
    return { company, peers: found ?? null };
  });
  const rows: Row[] = groups.flatMap(({ company, peers: list }) => [
    { ticker: company.ticker, exchange: company.exchange, name: company.company_name, peer: null },
    ...(list ?? []).map((peer) => ({ ticker: peer.ticker, exchange: peer.exchange, name: peer.company_name, peer })),
  ]);
  const facts = useQueries({ queries: rows.map((row) => fundamentalsQuery(row.exchange, row.ticker)) });
  const factsByTicker = new Map(rows.map((row, index) => [row.ticker, facts[index]]));
  const settled = facts.length > 0 && facts.every((query) => !query.isLoading);
  const yahooDown = settled && facts.every((query) => query.isError || !query.data?.available);
  const [metric, setMetric] = useState<MetricKey | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [hint, setHint] = useState(() => !localStorage.getItem(HINT_KEY));
  const sectionRef = useRef<HTMLElement | null>(null);
  const swiped = useRef(false);
  const explainer = METRICS.find((item) => item.key === metric);

  useEffect(() => {
    const target = sectionRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || viewedIdeas.has(ideaId)) return;
      viewedIdeas.add(ideaId);
      track({ event_name: "peer_table_viewed", idea_id: ideaId, properties: { companies: companies.length } });
    }, { threshold: .2 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [ideaId]);

  const dismissHint = () => { if (!hint) return; setHint(false); localStorage.setItem(HINT_KEY, "1"); };
  const onSwipe = (event: UIEvent<HTMLDivElement>) => {
    dismissHint();
    if (swiped.current || event.currentTarget.scrollLeft < 24) return;
    swiped.current = true;
    event.currentTarget.click(); // a swipe has no click; this lets the results tour's "swipe the table" task register it
  };
  const explain = (key: MetricKey) => {
    const next = metric === key ? null : key;
    setMetric(next);
    if (next) track({ event_name: "peer_metric_explained", idea_id: ideaId, properties: { metric: next } });
  };
  const toggleReason = (ticker: string, parent: string) => {
    const next = reason === ticker ? null : ticker;
    setReason(next);
    if (next) track({ event_name: "peer_reason_opened", idea_id: ideaId, ticker: parent, properties: { peer: ticker } });
  };

  return <section className="peer-section" ref={sectionRef} data-testid="peer-section">
    <div className="peer-heading">
      <span className="mono-label" data-testid="peer-kicker">A DIFFERENT LENS · SOURCED NUMBERS · NOT A RANKING</span>
      <h2 data-testid="peer-title">Each company,<br /><em>next to its rivals.</em></h2>
      <p className="peer-prompt" data-testid="peer-prompt">Is this company’s edge real, or is the whole sector this good? Compare ROE, ROCE and margins within each group.</p>
    </div>
    <div className="peer-table-card">
      <div className="peer-source" data-testid="peer-source"><span className="real-data-dot" />Yahoo Finance · may be delayed or incomplete · ROCE calculated from annual figures</div>
      {explainer && <div className="peer-explainer" role="status" data-testid="peer-explainer">
        <div><span className="mono-label">{explainer.label}{explainer.tag ? ` · ${explainer.tag}` : ""}</span><button type="button" onClick={() => setMetric(null)} aria-label="Close explainer" data-testid="peer-explainer-close"><X size={14} /></button></div>
        <p data-testid="peer-explainer-what">{explainer.what}</p>
        <p className="peer-explainer-why" data-testid="peer-explainer-why">{explainer.why}</p>
      </div>}
      {yahooDown && <p className="peer-unavailable" data-testid="peer-data-unavailable">Live data unavailable right now. Names are shown; no figure is estimated.</p>}
      <div className="peer-scroll-wrap">
      <div className="peer-scroll" onScroll={onSwipe} onPointerDown={dismissHint} data-testid="peer-table-scroll">
        <table className="peer-table" data-testid="peer-table">
          <thead><tr>
            <th className="peer-sticky" scope="col"><span className="peer-th-static">Company</span></th>
            {METRICS.map((item) => <th scope="col" key={item.key}><button type="button" className={metric === item.key ? "active" : ""} onClick={() => explain(item.key)} aria-expanded={metric === item.key} data-testid={`peer-metric-${item.key}`}>{item.label}<Info size={10} />{item.tag && <small>{item.tag}</small>}</button></th>)}
          </tr></thead>
          {groups.map(({ company, peers: list }) => <tbody key={company.ticker} className="peer-group" data-testid={`peer-group-${slug(company.ticker)}`}>
            <tr className="peer-row focus" data-testid={`peer-row-${slug(company.ticker)}`}>
              <th scope="row" className="peer-sticky"><button type="button" className="peer-name" onClick={() => onOpenCompany(company.ticker)} data-testid={`peer-open-${slug(company.ticker)}`}><strong>{company.company_name}</strong><span>{company.exchange} · {company.ticker} <ArrowRight size={10} /></span></button></th>
              <MetricCells row={{ ticker: company.ticker, exchange: company.exchange, name: company.company_name, peer: null }} data={factsByTicker.get(company.ticker)?.data} loading={Boolean(factsByTicker.get(company.ticker)?.isLoading)} />
            </tr>
            {list === null && peers.isLoading && <tr className="peer-row peer pending" data-testid={`peer-finding-${slug(company.ticker)}`}><th scope="row" className="peer-sticky"><span className="peer-finding">Finding listed rivals…</span></th>{METRICS.map((item) => <td key={item.key} className="peer-cell"><i className="peer-skeleton" /></td>)}</tr>}
            {list !== null && list.length === 0 && <tr className="peer-row peer none" data-testid={`peer-none-${slug(company.ticker)}`}><th scope="row" className="peer-sticky"><span className="peer-finding">No clear listed rival found</span></th><td colSpan={METRICS.length} /></tr>}
            {list === null && !peers.isLoading && <tr className="peer-row peer none" data-testid={`peer-unavailable-${slug(company.ticker)}`}><th scope="row" className="peer-sticky"><span className="peer-finding">Rivals unavailable right now</span></th><td colSpan={METRICS.length} /></tr>}
            {(list ?? []).map((peer) => {
              const row = { ticker: peer.ticker, exchange: peer.exchange, name: peer.company_name, peer };
              const open = reason === peer.ticker;
              return <tr className="peer-row peer" key={peer.ticker} data-testid={`peer-row-${slug(peer.ticker)}`}>
                <th scope="row" className="peer-sticky"><button type="button" className="peer-name" onClick={() => toggleReason(peer.ticker, company.ticker)} aria-expanded={open} data-testid={`peer-reason-toggle-${slug(peer.ticker)}`}><strong>{peer.company_name}</strong><span>{peer.exchange} · {peer.ticker} · rival</span></button>{open && <p className="peer-reason" data-testid={`peer-reason-${slug(peer.ticker)}`}><em>AI context · why it’s a rival</em>{peer.reason}</p>}</th>
                <MetricCells row={row} data={factsByTicker.get(peer.ticker)?.data} loading={Boolean(factsByTicker.get(peer.ticker)?.isLoading)} />
              </tr>;
            })}
          </tbody>)}
        </table>
      </div>
      {hint && <span className="peer-swipe-hint" aria-hidden="true" data-testid="peer-swipe-hint">Swipe for more <ChevronsRight size={13} /></span>}
      </div>
      <p className="peer-legend" data-testid="peer-legend"><span className="peer-legend-focus" />From your clue <span className="peer-legend-peer" />Direct rival · tap a name for the AI’s reason · tap a column for what it means</p>
    </div>
    <p className="peer-disclaimer" data-testid="peer-disclaimer">Educational comparison, not a ranking or a recommendation to buy or sell. Rival names and reasons are AI context; every figure is sourced from Yahoo Finance and “—” means it wasn’t available.</p>
  </section>;
}
