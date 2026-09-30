import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api";
import type { AnalyticsSummary } from "@/lib/types";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const login = useMutation({
    mutationFn: () => apiPost<{ authenticated: boolean }>("/admin/login", { password }),
    onSuccess: () => setAuthenticated(true),
    onError: () => toast.error("That studio password did not work."),
  });
  const summary = useQuery({ queryKey: ["admin-summary"], queryFn: () => apiGet<AnalyticsSummary>("/admin/summary"), enabled: authenticated });
  if (!authenticated) return <main className="admin-page" data-testid="admin-login-page"><a href="/" className="wordmark" data-testid="admin-login-wordmark">Aaspaas<span>.</span></a><section className="admin-login-card" data-testid="admin-login-card"><LockKeyhole size={22} /><span className="mono-label">PRIVATE STUDIO</span><h1 data-testid="admin-login-title">See what is spreading.</h1><p data-testid="admin-login-copy">A small internal view of observations, instinct, and sharing.</p><form onSubmit={(event) => { event.preventDefault(); login.mutate(); }} data-testid="admin-login-form"><label htmlFor="admin-password" className="mono-label">ADMIN PASSWORD</label><Input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} data-testid="admin-password-input" /><Button type="submit" className="admin-login-button" disabled={login.isPending} data-testid="admin-login-submit-button">{login.isPending ? "Opening…" : "Open studio"}</Button></form><a href="/" className="back-link" data-testid="admin-back-link"><ArrowLeft size={14} /> Back to Aaspaas</a></section></main>;
  const data = summary.data;
  return <main className="admin-page admin-dashboard" data-testid="admin-dashboard-page"><header className="admin-header"><div><a href="/" className="wordmark" data-testid="admin-dashboard-wordmark">Aaspaas<span>.</span></a><span className="mono-label" data-testid="admin-dashboard-label">PRIVATE STUDIO / SIGNALS</span></div><a href="/" className="back-link" data-testid="admin-dashboard-back-link"><ArrowLeft size={14} /> Public experience</a></header>{summary.isLoading ? <p className="admin-loading" data-testid="admin-loading">Reading the field notes…</p> : data ? <><section className="admin-hero"><div><span className="mono-label">FIELD NOTES</span><h1 data-testid="admin-dashboard-title">Is the idea<br /><em>spreading?</em></h1></div><p data-testid="admin-dashboard-description">A lightweight pulse check for the education loop — not a pageview vanity metric.</p></section><section className="stat-grid" data-testid="admin-stat-grid"><Stat label="Ideas submitted" value={data.ideas_submitted} testId="ideas-submitted-stat" /><Stat label="Anonymous sessions" value={data.sessions} testId="sessions-stat" /><Stat label="Pageviews" value={data.pageviews} testId="pageviews-stat" /><Stat label="Share clicks" value={data.shares} testId="share-clicks-stat" /><Stat label="Gut-check accuracy" value={data.gut_check_accuracy === null ? "—" : `${Math.round(data.gut_check_accuracy * 100)}%`} testId="gut-check-accuracy-stat" /><Stat label="Share / idea" value={data.share_click_rate === null ? "—" : `${Math.round(data.share_click_rate * 100)}%`} testId="share-rate-stat" /></section><div className="admin-columns"><section className="admin-panel" data-testid="trend-panel"><div className="panel-heading"><span className="mono-label">OVER TIME</span><TrendingUp size={17} /></div>{data.trend.length ? data.trend.map((point) => <div className="trend-row" key={point.date} data-testid={`trend-row-${point.date}`}><span>{point.date}</span><div className="trend-bars"><i style={{ width: `${Math.min(point.ideas * 22 + 8, 100)}%` }} /><b>{point.ideas} ideas · {point.shares} shares</b></div></div>) : <p className="admin-empty">No observations yet.</p>}</section><section className="admin-panel" data-testid="top-companies-panel"><div className="panel-heading"><span className="mono-label">MOST SURFACED</span><span className="mono-label">MENTIONS</span></div>{data.top_companies.length ? data.top_companies.map((company) => <div className="company-frequency" key={company.ticker} data-testid={`company-frequency-${company.ticker.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}><strong>{company.ticker}</strong><span>{company.mentions}</span></div>) : <p className="admin-empty">No companies surfaced yet.</p>}</section></div></> : <p className="admin-empty" data-testid="admin-error">The studio could not load right now.</p>}</main>;
}

function Stat({ label, value, testId }: { label: string; value: string | number; testId: string }) {
  return <div className="stat-card" data-testid={testId}><span className="mono-label">{label}</span><strong>{value}</strong></div>;
}