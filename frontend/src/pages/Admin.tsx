import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flame, LockKeyhole, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api";
import { StudioContent } from "@/components/StudioContent";
import type { StudioFunnelStep, StudioMetric, StudioSummary } from "@/lib/types";

const RANGES = [{ days: 7, label: "7D" }, { days: 30, label: "30D" }, { days: 90, label: "90D" }, { days: 0, label: "All" }];
const CHANNEL_LABEL: Record<string, string> = { whatsapp: "WhatsApp", x: "X", copy: "Copied link", native: "Share sheet", download: "Image download", link: "Tokenised link", unattributed: "Unattributed (pre-tracking)" };
const testKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const pct = (value: number | null) => value === null ? "—" : `${Math.round(value * 100)}%`;

function biggestLeak(funnel: StudioFunnelStep[]) {
  let leak: { from: StudioFunnelStep; to: StudioFunnelStep; kept: number } | null = null;
  for (let index = 1; index < funnel.length; index += 1) {
    const from = funnel[index - 1], to = funnel[index];
    if (from.count === 0 || from.key === "sharers") continue;
    const kept = to.count / from.count;
    if (!leak || kept < leak.kept) leak = { from, to, kept };
  }
  return leak;
}

function MetricCard({ metric, emphasis = false }: { metric: StudioMetric; emphasis?: boolean }) {
  return <div className={emphasis ? "studio-metric emphasis" : "studio-metric"} data-testid={`studio-metric-${metric.key}`}>
    <span className="studio-metric-label">{metric.label}</span>
    <strong className="studio-metric-value" data-testid={`studio-metric-${metric.key}-value`}>{metric.display}</strong>
    {metric.hint && <p className="studio-metric-hint">{metric.hint}</p>}
  </div>;
}

function Section({ kicker, title, children, testId }: { kicker: string; title: string; children: ReactNode; testId: string }) {
  return <section className="studio-section" data-testid={testId}><div className="studio-section-head"><span className="mono-label">{kicker}</span><h2>{title}</h2></div>{children}</section>;
}

function Dashboard({ data, days, onDays, refreshing, onRefresh }: { data: StudioSummary; days: number; onDays: (days: number) => void; refreshing: boolean; onRefresh: () => void }) {
  const k = data.headline.find((metric) => metric.key === "k_factor");
  const leak = biggestLeak(data.viral_funnel);
  const funnelMax = Math.max(data.viral_funnel[0]?.count ?? 1, 1);
  const trendMax = Math.max(1, ...data.acquisition_trend.map((point) => point.direct + point.referred));
  const referredTotal = data.acquisition_trend.reduce((sum, point) => sum + point.referred, 0);
  return <>
    <section className="studio-hero">
      <div><span className="mono-label" data-testid="admin-hero-kicker">VIRAL LOOP · MONETISATION · UNIT ECONOMICS</span><h1 data-testid="admin-dashboard-title">Is Aaspaas<br /><em>spreading on its own?</em></h1></div>
      <div className="studio-controls">
        <div className="studio-range" role="group" aria-label="Date range" data-testid="studio-range">{RANGES.map((range) => <button type="button" key={range.days} className={days === range.days ? "active" : ""} aria-pressed={days === range.days} onClick={() => onDays(range.days)} data-testid={`studio-range-${range.label.toLowerCase()}`}>{range.label}</button>)}</div>
        <button type="button" className="studio-refresh" onClick={onRefresh} data-testid="studio-refresh-button"><RefreshCw size={13} className={refreshing ? "spin" : ""} />{`Updated ${new Date(data.generated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}</button>
      </div>
    </section>

    <section className="studio-verdict" data-testid="studio-verdict">
      <div className="studio-verdict-k"><span className="mono-label">K-FACTOR</span><strong data-testid="studio-k-factor">{k?.display ?? "—"}</strong><p>{k?.value === null || k?.value === undefined ? "Not enough data yet." : k.value >= 1 ? "Self-sustaining: each user brings in more than one new explorer." : `Each 100 active users bring ${Math.round(k.value * 100)} new explorers. Needs to reach 100 for organic growth.`}</p></div>
      <div className="studio-verdict-leak" data-testid="studio-biggest-leak"><Flame size={18} /><span className="mono-label">BIGGEST LEAK IN THE LOOP</span>{leak ? <><h3>{`${leak.from.label} → ${leak.to.label}`}</h3><p>{`Only ${pct(leak.kept)} make it through (${leak.to.count.toLocaleString("en-IN")} of ${leak.from.count.toLocaleString("en-IN")}). Fixing this step moves K the most.`}</p></> : <p>Collect a few shares to diagnose the loop.</p>}</div>
    </section>

    <section className="studio-headline" data-testid="studio-headline">{data.headline.map((metric) => <MetricCard key={metric.key} metric={metric} emphasis={metric.key === "k_factor"} />)}</section>

    <Section kicker="VIRAL LOOP" title="Share → open → explore → share again" testId="studio-viral-loop">
      <div className="studio-loop-grid">
        <div className="studio-funnel" data-testid="studio-viral-funnel">{data.viral_funnel.map((step, index) => <div className="studio-funnel-row" key={step.key} data-testid={`studio-funnel-${step.key}`}><span className="studio-funnel-label">{`${String(index + 1).padStart(2, "0")} · ${step.label}`}</span><div className="studio-funnel-bar"><i style={{ width: `${Math.max(2, (step.count / funnelMax) * 100)}%`, animationDelay: `${index * 70}ms` }} /></div><strong>{step.count.toLocaleString("en-IN")}</strong></div>)}</div>
        <div className="studio-loop-side">
          <MetricCard metric={data.viral_cycle} />
          <div className="studio-metric" data-testid="studio-chain-depth"><span className="studio-metric-label">Longest referral chain</span><strong className="studio-metric-value">{`${data.chain_max_depth} ${data.chain_max_depth === 1 ? "hop" : "hops"}`}</strong><div className="studio-generations">{data.generations.map((row) => <span key={row.generation} data-testid={`studio-generation-${testKey(row.generation)}`}>{`${row.generation}: ${row.visitors}`}</span>)}</div></div>
        </div>
      </div>
    </Section>

    <div className="studio-two-col">
      <Section kicker="CHANNELS" title="Where sharing converts" testId="studio-channels">
        {data.channels.length ? <table className="studio-table" data-testid="studio-channel-table"><thead><tr><th>Channel</th><th>Shares</th><th>Opens</th><th>New visitors</th><th>Explored</th><th>Explore / share</th></tr></thead><tbody>{data.channels.map((row) => <tr key={row.channel} data-testid={`studio-channel-${testKey(row.channel)}`}><td>{CHANNEL_LABEL[row.channel] ?? row.channel}</td><td>{row.shares}</td><td>{row.opens}</td><td>{row.new_visitors}</td><td>{row.activated}</td><td>{pct(row.conversion)}</td></tr>)}</tbody></table> : <p className="admin-empty">No shares in this range.</p>}
        <div className="studio-previews" data-testid="studio-preview-platforms"><span className="mono-label">LINK PREVIEWS RENDERED BY</span>{data.preview_platforms.length ? data.preview_platforms.map((row) => <span key={row.platform} className="studio-chip">{`${row.platform} · ${row.fetches}`}</span>) : <span className="studio-chip muted">None yet</span>}</div>
      </Section>
      <Section kicker="ACQUISITION" title="New visitors: direct vs. via shares" testId="studio-acquisition">
        <div className="studio-trend" data-testid="studio-acquisition-trend">{data.acquisition_trend.map((point) => <div key={point.date} className="studio-trend-col" title={`${point.date}: ${point.direct} direct · ${point.referred} via shares · ${point.ideas} ideas · ${point.shares} shares`}><i className="referred" style={{ height: `${(point.referred / trendMax) * 100}%` }} /><i className="direct" style={{ height: `${(point.direct / trendMax) * 100}%` }} /></div>)}</div>
        <div className="studio-trend-legend"><span><i className="direct" />Direct</span><span><i className="referred" />Via shares</span><span>{`${referredTotal} referred in range`}</span></div>
      </Section>
    </div>

    <Section kicker="CONTENT THAT SPREADS" title="Top spreading ideas" testId="studio-top-spreading">
      {data.top_spreading.length ? <table className="studio-table" data-testid="studio-spreading-table"><thead><tr><th>Observation</th><th>Companies</th><th>Shares</th><th>Opens</th><th>New visitors</th><th>Explored</th></tr></thead><tbody>{data.top_spreading.map((row) => <tr key={row.idea_id} data-testid={`studio-spreading-${row.idea_id}`}><td className="studio-observation">{`“${row.observation}”`}</td><td className="studio-mono">{row.tickers.join(" · ")}</td><td>{row.shares}</td><td>{row.opens}</td><td>{row.new_visitors}</td><td>{row.activated}</td></tr>)}</tbody></table> : <p className="admin-empty">No shared ideas in this range.</p>}
    </Section>

    <Section kicker="MONETISATION SIGNALS" title="Who would pay, and for what" testId="studio-monetization">
      <div className="studio-grid">{data.monetization.map((metric) => <MetricCard key={metric.key} metric={metric} />)}</div>
      <div className="studio-subhead"><span className="mono-label">POWER USERS · ANONYMOUS</span></div>
      {data.power_users.length ? <table className="studio-table" data-testid="studio-power-users"><thead><tr><th>Visitor</th><th>Ideas</th><th>Shares</th><th>Limit hits</th><th>Visitors referred</th><th>Last seen</th></tr></thead><tbody>{data.power_users.map((row) => <tr key={row.label} data-testid={`studio-power-${testKey(row.label)}`}><td className="studio-mono">{row.label}</td><td>{row.ideas}</td><td>{row.shares}</td><td>{row.limit_hits}</td><td>{row.referred_visitors}</td><td className="studio-mono">{row.last_seen ?? "—"}</td></tr>)}</tbody></table> : <p className="admin-empty">No repeat explorers in this range.</p>}
    </Section>

    <Section kicker="UNIT ECONOMICS" title="What each idea, share, and visitor costs" testId="studio-unit-economics">
      <div className="studio-grid">{data.unit_economics.map((metric) => <MetricCard key={metric.key} metric={metric} />)}</div>
    </Section>

    <div className="studio-two-col">
      <Section kicker="PRODUCT HEALTH" title="Is the learning loop working?" testId="studio-product-health">
        <div className="studio-grid compact">{data.product_health.map((metric) => <MetricCard key={metric.key} metric={metric} />)}</div>
      </Section>
      <Section kicker="MARKET INSIGHT" title="Most-surfaced companies" testId="studio-top-companies">
        {data.top_companies.length ? data.top_companies.map((company) => <div className="company-frequency" key={company.ticker} data-testid={`company-frequency-${testKey(company.ticker)}`}><strong>{company.ticker}</strong><span>{company.mentions}</span></div>) : <p className="admin-empty">No companies surfaced in this range.</p>}
      </Section>
    </div>
    <ul className="studio-notes" data-testid="studio-notes">{data.notes.map((note) => <li key={note}>{note}</li>)}</ul>
  </>;
}

export default function Admin() {
  const [password, setPassword] = useState("");
  const [days, setDays] = useState(30);
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["admin-session"], queryFn: () => apiGet<{ authenticated: boolean }>("/admin/session") });
  const authenticated = session.data?.authenticated === true;
  const summary = useQuery({ queryKey: ["admin-summary", days], queryFn: () => apiGet<StudioSummary>(`/admin/summary?days=${days}`), enabled: authenticated, retry: false, placeholderData: (previous) => previous });
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try { queryClient.setQueryData(["admin-summary", days], await apiGet<StudioSummary>(`/admin/summary?days=${days}&fresh=true`)); }
    catch { toast.error("Could not refresh the studio."); }
    finally { setRefreshing(false); }
  };
  const login = useMutation({ mutationFn: () => apiPost<{ authenticated: boolean }>("/admin/login", { password }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-session"] }), onError: () => toast.error("That studio password did not work.") });
  if (session.isLoading) return <main className="admin-page" data-testid="admin-session-loading" />;
  if (!authenticated) return <main className="admin-page" data-testid="admin-login-page"><span className="wordmark" data-testid="admin-login-wordmark">Aaspaas<span>.</span></span><section className="admin-login-card" data-testid="admin-login-card"><LockKeyhole size={22} /><span className="mono-label" data-testid="admin-login-kicker">PRIVATE STUDIO</span><h1 data-testid="admin-login-title">See what is spreading.</h1><p data-testid="admin-login-copy">Viral loop, monetisation signals, and unit economics. Internal only.</p><form onSubmit={(event) => { event.preventDefault(); login.mutate(); }} data-testid="admin-login-form"><label htmlFor="admin-password" className="mono-label" data-testid="admin-password-label">ADMIN PASSWORD</label><Input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} data-testid="admin-password-input" /><Button type="submit" className="admin-login-button" disabled={login.isPending} data-testid="admin-login-submit-button">{login.isPending ? "Opening…" : "Open studio"}</Button></form></section></main>;
  return <main className="admin-page admin-dashboard studio-page" data-testid="admin-dashboard-page"><header className="admin-header"><div><span className="wordmark" data-testid="admin-dashboard-wordmark">Aaspaas<span>.</span></span><span className="mono-label" data-testid="admin-dashboard-label">PRIVATE STUDIO</span></div><a href="/" className="back-link" data-testid="admin-dashboard-back-link"><ArrowLeft size={14} /> Public experience</a></header>{summary.data ? <Dashboard data={summary.data} days={days} onDays={setDays} refreshing={refreshing || summary.isFetching} onRefresh={() => void refresh()} /> : summary.isLoading ? <p className="admin-loading" data-testid="admin-loading">Reading the field notes…</p> : <p className="admin-empty" data-testid="admin-error">The studio could not load right now.</p>}<StudioContent days={days} /></main>;
}
