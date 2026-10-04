import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAccount } from "@/components/AccountProvider";
import { PlusWaitlist, portfoliosQuery } from "@/components/AddToPortfolio";
import { HeaderNav } from "@/components/HeaderNav";
import { ThinkingPartnerButton } from "@/components/ThinkingPartner";
import { LessonLink } from "@/components/Video";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEngagement } from "@/hooks/useEngagement";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { signedPct, tone } from "@/lib/fundamentals";
import { inr, setMeta } from "@/lib/learn";
import type { Portfolio, PortfolioList, PortfolioPoint, SellResponse } from "@/lib/types";

function Chart({ series }: { series: PortfolioPoint[] }) {
  const paths = useMemo(() => {
    if (series.length < 2) return null;
    const values = series.flatMap((point) => [point.value, point.nifty]);
    const low = Math.min(...values), high = Math.max(...values), spread = Math.max(high - low, high * .01);
    const line = (key: "value" | "nifty") => series.map((point, index) => `${index ? "L" : "M"}${((index / (series.length - 1)) * 600).toFixed(1)},${(150 - ((point[key] - low) / spread) * 130).toFixed(1)}`).join(" ");
    return { mine: line("value"), nifty: line("nifty") };
  }, [series]);
  if (!paths) return <p className="pf-chart-empty" data-testid="portfolio-chart-empty">The comparison line appears after a few trading days.</p>;
  return <svg className="pf-chart" viewBox="0 0 600 160" data-testid="portfolio-chart" role="img" aria-label="Practice portfolio vs Nifty 50"><path className="pf-line" d={paths.mine} /><path className="pf-nifty" d={paths.nifty} /></svg>;
}

export default function PortfolioPage() {
  const { account, requireSignIn } = useAccount();
  const queryClient = useQueryClient();
  const { track } = useEngagement();
  const signedIn = Boolean(account?.signed_in);
  const list = useQuery({ ...portfoliosQuery, enabled: signedIn });
  const [selected, setSelected] = useState<string | null>(() => new URLSearchParams(window.location.search).get("id"));
  const [newName, setNewName] = useState("");
  const [limit, setLimit] = useState(false);
  const activeId = selected ?? list.data?.portfolios[0]?.id ?? null;
  const portfolio = useQuery({ queryKey: ["portfolio", activeId], queryFn: () => apiGet<Portfolio>(`/portfolios/${activeId}`), enabled: Boolean(activeId && signedIn) });
  useEffect(() => setMeta("Practice portfolios — Aaspaas", "Practise with pretend money and track your reasoning against the Nifty 50."), []);
  useEffect(() => { if (portfolio.data) track({ event_name: "portfolio_viewed" }); }, [portfolio.data?.id]);
  const refresh = (data?: Portfolio) => { if (data) queryClient.setQueryData(["portfolio", data.id], data); void queryClient.invalidateQueries({ queryKey: ["portfolios"] }); };
  const create = useMutation({ mutationFn: () => apiPost<Portfolio>("/portfolios", { name: newName.trim() || "My practice portfolio" }), onSuccess: (data) => { refresh(data); setSelected(data.id); setNewName(""); }, onError: (error) => { if (error instanceof ApiError && error.status === 409) setLimit(true); } });
  const action = useMutation({
    mutationFn: async (kind: "reset" | "rename" | "delete") => {
      if (kind === "delete") { await apiDelete<PortfolioList>(`/portfolios/${activeId}`); setSelected(null); return undefined; }
      if (kind === "rename") { const name = window.prompt("Rename this practice portfolio", portfolio.data?.name); return name ? apiPatch<Portfolio>(`/portfolios/${activeId}`, { name }) : undefined; }
      return apiPost<Portfolio>(`/portfolios/${activeId}/reset`);
    },
    onSuccess: (data) => refresh(data),
  });
  const sell = useMutation({
    mutationFn: ({ holdingId, fraction }: { holdingId: string; fraction: number }) => apiPost<SellResponse>(`/portfolios/${activeId}/sell`, { holding_id: holdingId, fraction }),
    onSuccess: (data) => { refresh(data.portfolio); const term = data.long_term_gain !== 0 && data.short_term_gain === 0 ? "long-term" : "short-term"; const gain = data.short_term_gain + data.long_term_gain; toast.message(`${inr(data.proceeds)} of pretend cash returned.`, { description: gain > 0 ? `If this were real money, this ${inr(gain)} gain would be ${term} (${term === "short-term" ? "20%" : "12.5% above ₹1.25 lakh/yr"}). See lesson 15.` : "No taxable gain on this practice sale.", action: { label: "Lesson 15", onClick: () => { window.location.href = "/learn/tax-on-shares"; } } }); },
  });
  const header = <header className="site-header"><a href="/" className="wordmark" data-testid="portfolio-wordmark">Aaspaas<span>.</span></a><HeaderNav /></header>;
  if (!signedIn) return <main className="paper-page portfolio-page" data-testid="portfolio-page">{header}<section className="learn-intro"><span className="mono-label practice-stamp">PRACTICE · PRETEND MONEY</span><h1>Practise with<br /><em>₹1,00,000 of pretend cash.</em></h1><p>Split it across companies you chose yourself, write down why, and see how your reasoning holds up against the Nifty 50. Up to 3 practice portfolios, free.</p><Button size="lg" onClick={() => requireSignIn({ location: "portfolio" })} data-testid="portfolio-signin-button">Sign in with email to start</Button></section></main>;
  const data = portfolio.data;
  const topSector = data?.sector_mix[0];
  return <main className="paper-page portfolio-page" data-testid="portfolio-page">{header}
    <div className="pf-switcher" data-testid="portfolio-switcher">{list.data?.portfolios.map((item) => <button type="button" key={item.id} className={item.id === activeId ? "active" : ""} onClick={() => setSelected(item.id)} data-testid={`portfolio-tab-${item.id}`}>{item.name}<small>{item.holdings} holdings</small></button>)}
      <form onSubmit={(event) => { event.preventDefault(); create.mutate(); }} className="pf-new"><Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="New portfolio name" maxLength={40} data-testid="portfolio-new-name" /><Button type="submit" variant="outline" disabled={create.isPending} data-testid="portfolio-create-button"><Plus size={14} /> New</Button></form></div>
    {limit && <PlusWaitlist onJoined={() => setLimit(false)} />}
    {!activeId && !list.isLoading && <p className="learn-loading" data-testid="portfolio-empty">Name your first practice portfolio above, or add a company from any read.</p>}
    {data && <>
      <section className="pf-summary" data-testid="portfolio-summary"><span className="mono-label practice-stamp">PRACTICE · PRETEND MONEY · NO REAL TRADES</span><h1 data-testid="portfolio-name">{data.name}</h1>
        <div className="pf-figures"><div><span>Total value</span><strong data-testid="portfolio-value">{inr(data.value)}</strong></div><div><span>Cash left</span><strong data-testid="portfolio-cash">{inr(data.cash)}</strong></div><div><span>Gain / loss</span><strong className={tone(data.gain)} data-testid="portfolio-gain">{inr(data.gain)} · {signedPct(data.gain_pct)}</strong></div></div>
        <Chart series={data.series} /><p className="pf-legend"><i className="mine" /> Your practice portfolio <i className="nifty" /> Same rupees in the Nifty 50, same days · adjusted close, delayed</p>
        {topSector && <p className="pf-sector" data-testid="portfolio-sector-mix">{topSector.percent.toFixed(0)}% of your invested practice money is in {topSector.sector}{data.sector_mix.length > 1 ? `, across ${data.sector_mix.length} sectors in total` : ""}.</p>}
        {data.due_check_backs.length > 0 && <p className="pf-reminder" data-testid="portfolio-check-back"><Bell size={13} /> Time to check back on {data.due_check_backs.join(", ")} — does your reason still hold?</p>}
        <div className="pf-lessons"><LessonLink slug="sip" number={13} label="Lesson: SIPs" testId="portfolio-lesson-sip" /><LessonLink slug="tax-on-shares" number={15} label="Lesson: tax on shares" testId="portfolio-lesson-tax" /></div>
      </section>
      <section className="pf-holdings" data-testid="portfolio-holdings">{data.holdings.length === 0 && <p className="learn-loading">No holdings yet. Use “Add to practice portfolio” on any company in a read.</p>}
        {data.holdings.map((holding) => <article key={holding.id} className="pf-holding" data-testid={`holding-${holding.ticker.toLowerCase()}`}>
          <div className="pf-holding-top"><div><strong>{holding.company_name}</strong><span>{holding.exchange} · {holding.ticker} · held {holding.holding_days} days</span></div><div className="pf-holding-num"><strong>{holding.value === null ? "—" : inr(holding.value)}</strong><span className={tone(holding.gain)}>{holding.gain === null ? "price unavailable" : `${inr(holding.gain)} · ${signedPct(holding.gain_pct)}`}</span></div></div>
          <p className="pf-note" data-testid={`holding-note-${holding.ticker.toLowerCase()}`}>“{holding.note}”{holding.change_mind && <small>Would change my mind: {holding.change_mind}</small>}{holding.check_back && <small>Check back on {holding.check_back}</small>}</p>
          <div className="pf-holding-actions"><button type="button" onClick={() => sell.mutate({ holdingId: holding.id, fraction: .5 })} data-testid={`holding-sell-half-${holding.ticker.toLowerCase()}`}>Sell half</button><button type="button" onClick={() => sell.mutate({ holdingId: holding.id, fraction: 1 })} data-testid={`holding-sell-all-${holding.ticker.toLowerCase()}`}>Sell all</button><ThinkingPartnerButton company={{ ticker: holding.ticker, exchange: holding.exchange, company_name: holding.company_name }} surface="holding" label="Ask the thinking partner" initial={holding.note} testId={`holding-partner-${holding.ticker.toLowerCase()}`} /></div>
        </article>)}
      </section>
      <div className="pf-manage"><button type="button" onClick={() => action.mutate("rename")} data-testid="portfolio-rename">Rename</button><button type="button" onClick={() => { if (window.confirm("Reset to ₹1,00,000 pretend cash and clear holdings?")) action.mutate("reset"); }} data-testid="portfolio-reset">Reset</button><button type="button" onClick={() => { if (window.confirm("Delete this practice portfolio? This frees a slot.")) action.mutate("delete"); }} data-testid="portfolio-delete">Delete</button></div>
    </>}
    <p className="disclaimer">Practice with pretend money only. Aaspaas never suggests holdings or amounts, never links a broker and never places real orders.</p>
  </main>;
}
