import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { HeaderNav } from "@/components/HeaderNav";
import { ShareMenuLink } from "@/components/ShareLink";
import { ClueCard, todayQuery } from "@/components/TrendingStrip";
import { apiGet } from "@/lib/api";
import { setMeta } from "@/lib/learn";
import { MapPin } from "lucide-react";
import type { CitiesResponse, TrendingDay } from "@/lib/types";

function AroundIndia() {
  const cities = useQuery({ queryKey: ["places-cities"], queryFn: () => apiGet<CitiesResponse>("/places/cities"), staleTime: 5 * 60 * 1000 });
  const data = cities.data;
  return <section className="around-india" data-testid="around-india">
    <span className="mono-label">NOTICED AROUND INDIA · LAST {data?.window_days ?? 60} DAYS</span>
    <h2>What people are noticing,<br /><em>city by city.</em></h2>
    {data && data.cities.length > 0 ? <div className="city-grid">{data.cities.map((city) => <article key={city.city} className="city-card" data-testid={`city-card-${city.city.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="city-card-head"><MapPin size={14} /><strong>{city.city}</strong>{city.state && <small>{city.state}</small>}<span>{city.people} people</span></div>
      <ul>{city.themes.map((theme) => <li key={theme}>{theme}</li>)}</ul>
      <div className="clue-tickers">{city.tickers.map((ticker) => <span key={ticker}>{ticker}</span>)}</div>
    </article>)}</div> : <p className="learn-loading" data-testid="around-india-empty">{cities.isLoading ? "Gathering cities…" : `A city appears here once ${data?.min_people ?? 3} different people there have noticed something.${data?.gathering ? ` ${data.gathering} ${data.gathering === 1 ? "city is" : "cities are"} gathering clues now.` : ""}`}</p>}
    <p className="around-india-note">Only city-level themes are shown — never anyone’s words or exact area. <a href="/" data-testid="around-india-add">Add what you’ve noticed, with your city</a></p>
  </section>;
}

export default function Today() {
  const { day } = useParams();
  const archive = useQuery({ queryKey: ["trending-day", day], queryFn: () => apiGet<TrendingDay>(`/trending/day/${day}`), enabled: Boolean(day), retry: false });
  const today = useQuery({ ...todayQuery, enabled: !day });
  const data = day ? archive.data : today.data;
  useEffect(() => setMeta(`What people are noticing${data ? ` · ${data.date}` : ""} — Aaspaas`, "Daily everyday clues from Google Trends India and business news, each traced to the listed Indian companies behind it."), [data?.date]);
  return <main className="paper-page today-page" data-testid="today-page">
    <header className="site-header"><a href="/" className="wordmark" data-testid="today-wordmark">Aaspaas<span>.</span></a><HeaderNav /></header>
    <section className="learn-intro"><span className="mono-label" data-testid="today-kicker">{data ? `${data.status === "previous" ? "LATEST CLUES · " : ""}${data.date}` : "DAILY CLUES"}</span><h1>What people<br /><em>are noticing.</em></h1><p>Up to five everyday clues a day, picked from Google Trends India and business news, each already traced to listed companies. Opening one doesn’t use your daily allowance.</p></section>
    {(day ? archive.isLoading : today.isLoading) ? <p className="learn-loading">Gathering today’s clues…</p>
      : !data?.clues.length ? <p className="learn-loading" data-testid="today-empty">Today’s clues are still being gathered — check back in a few minutes.</p>
      : <div className="today-grid" data-testid="today-clues">{data.clues.map((clue) => <ClueCard key={clue.id} clue={clue} />)}</div>}
    {data && data.clues.length > 0 && <ShareMenuLink path={`/api/share/today/${data.date}`} text={`What people are noticing · ${data.date}`} testId="today-share" />}
    <AroundIndia />
    {data && data.archive_dates.length > 1 && <section className="today-archive" data-testid="today-archive"><span className="mono-label">ARCHIVE</span><div>{data.archive_dates.map((date) => <a key={date} href={`/today/${date}`} className={date === data.date ? "active" : ""} data-testid={`today-archive-${date}`}>{date}</a>)}</div></section>}
    <p className="disclaimer">Clues are educational starting points, not tips. Aaspaas doesn’t place trades or recommend stocks.</p>
  </main>;
}
