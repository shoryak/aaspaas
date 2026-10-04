import { apiGet } from "@/lib/api";
import type { LearnResponse, SiteVideos } from "@/lib/types";

export const learnQuery = { queryKey: ["lessons"] as const, queryFn: () => apiGet<LearnResponse>("/lessons"), staleTime: 5 * 60 * 1000 };
export const videosQuery = { queryKey: ["site-videos"] as const, queryFn: () => apiGet<SiteVideos>("/site/videos"), staleTime: 10 * 60 * 1000 };

/** Where each metric / lens / topic is taught. */
export const LESSON_FOR: Record<string, { slug: string; number: number }> = {
  net_income: { slug: "revenue-vs-profit", number: 1 },
  operating_margin: { slug: "margins", number: 2 },
  operating_cash_flow: { slug: "cash-flow", number: 3 },
  balance_sheet: { slug: "balance-sheet", number: 4 },
  roce: { slug: "roce", number: 5 },
  roe: { slug: "roe", number: 6 },
  debt_to_equity: { slug: "debt", number: 7 },
  moat: { slug: "moat", number: 8 },
  management: { slug: "management", number: 9 },
  capital_allocation: { slug: "management", number: 9 },
  growth_runway: { slug: "quality-of-growth", number: 10 },
  revenue_growth: { slug: "quality-of-growth", number: 10 },
  sip: { slug: "sip", number: 13 },
  tax_on_shares: { slug: "tax-on-shares", number: 15 },
};

export function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return match ? match[1] : /^[\w-]{11}$/.test(url) ? url : null;
}

/** Traffic source for Studio: explicit ?src/utm_source tag first, then the referrer. */
export function trafficSource(): string {
  const params = new URLSearchParams(window.location.search);
  const tagged = params.get("src") ?? params.get("utm_source");
  if (tagged) return tagged.toLowerCase();
  const ref = document.referrer.toLowerCase();
  if (!ref || ref.includes(window.location.host)) return "direct";
  for (const [needle, name] of [["google", "google"], ["youtube", "youtube"], ["youtu.be", "youtube"], ["instagram", "instagram"], ["whatsapp", "whatsapp"], ["wa.me", "whatsapp"], ["t.co", "x"], ["twitter", "x"]] as const) if (ref.includes(needle)) return name;
  return "other";
}

export function setMeta(title: string, description: string) {
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
}

export const inr = (value: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
