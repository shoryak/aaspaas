# Aaspaas living spec

## Product
Aaspaas is an educational Indian stock-discovery experience based on “invest in what you know.” Readers submit an everyday observation, receive 3–4 LLM-identified NSE/BSE companies, first compare verified adjusted-price journeys, then inspect business quality and menu-driven research details. It is explicitly not a trading app, recommendation engine, brokerage, or money manager.

## Data model
- `ideas`: raw observation, anonymous session id, timestamp, surfaced ticker list, and embedded qualitative company cards with scorecards and optional Yahoo finance facts.
- `gut_checks`: one yes/no answer per displayed company, whether it matched the AI lean, idea/session ids, timestamp.
- `share_events`: share clicks by idea/session and timestamp.
- `sessions`: anonymous session cookie, pageviews, creation and last-seen timestamps.
- `engagement_events`: performance views/periods, price-to-quality continuation, detail-versus-intuition choices, research/question/journal/email/limit/referral events with idea, ticker, and aggregate-safe properties.
- `submission_attempts`: UTC day, session id, and privacy-preserving daily IP fingerprint for the three-per-day limit.
- `finance_cache` / `historical_cache`: 45-minute current facts and six-hour adjusted-price histories (also caches the Nifty 50 `^NSEI` benchmark).
- `events_cache`: 12-hour cache of filtered NSE corporate announcements per symbol.
- `share_events.surface`: `recap` or `chart`; `engagement_events` also records `share_link_opened` (crawler flag), `chart_shared`, `benchmark_toggled`, `chart_event_opened`, `tour_completed/skipped/replayed`.
- `email_interests`: consented update interest linked internally to the anonymous session; email does not unlock a journal.

## Key flows
0. First visit: a 4-step spotlight tour on the landing page (observation box → example chips → how the read works → disclaimer), shown once (localStorage `aaspaas-tour-done`), skippable, “Replay tour” in the header.
1. Landing → submit observation (maximum three starts per UTC day by session and daily IP fingerprint) → educational waiting view (lesson cards rotate every 7s with motion cross-fade, progress bar, step indicators) → Vertex AI company discovery.
2. Results open with “How these stocks travelled”: a combined overlay chart (all companies rebased to 0% for the shared period, hover/tap tooltip with % and ₹ per stock, legend toggles to hide/show a line), then AI-relevance-ordered performance cards, shared 1Y/3Y/5Y control, per-company ₹ adjusted-price mini charts with high/low labels and start→end share price, total movement, period drawdown, dates, Yahoo status, and honest unavailable states. Price movement is explicitly separated from business quality and never ranked.
2b. The comparison chart has a “Compare with Nifty 50” toggle (off by default; dashed neutral line rebased to 0%), an event-marker lane (◆ results, ● filings/payouts; clustered; tap → popover with date, company, category, NSE summary, original filing link, labelled “context, not a cause”), a marker filter (Key filings = results, board outcomes, press releases, credit ratings, acquisitions/mergers + Yahoo dividends/splits; Results & payouts = results + dividends/splits), and “Share chart”.
2c. Sharing: `GET /api/share/{id}/image.png?period&benchmark&hidden` renders a 1200×630 branded PNG (Pillow, bundled Liberation fonts in backend/assets/fonts). The client prefetches it and opens the native share sheet with the file, or downloads it and copies the link. Shared links point to `GET /api/share/{id}` — an Open Graph page (og:image = the PNG) that redirects people to `/?idea={id}&view=recap&shared=1`. The recap “Share this idea” uses the same image + link.
3. The business-quality comparison follows directly below with connection copy, mini quality pips, P/E, and market cap. A row of category cards (Overall, Moat, Capital allocation, Management, Growth runway, P/E lowest, Market cap largest) shows each category's leader and ranks the cards when tapped (replaces the old dropdown). Both performance and business cards expose separate “Explore details” and optional “Test your intuition” actions.
4. Company details remain menu-driven: standout strengths, risks, business model, full scorecard, verified stock journey, research/Screener handoff, or optional instinct game in any order; nothing is gated. An answered/skipped game exits to details or all companies.
5. Recap → learning-style snapshot, score comparison, optional sharing, optional update consent, and clearly inactive broker-interest placeholder.
6. `/discoveries` restores this browser's ideas, recap results, and saved field-note tickers.
7. `/admin` → password login → aggregate funnel, latency, performance-to-quality continuation, detail-versus-intuition choice, retention, email, limit, fallback, Screener, and sharing signals.

## Auth and roles
The public flow is anonymous and uses an httpOnly `aaspaas_session` cookie. The internal dashboard uses a single `ADMIN_PASSWORD` environment value and an httpOnly admin cookie. There are no public user accounts.

## Integrations
LLM discovery uses Vertex AI Gemini `gemini-2.5-flash` in `us-central1` with server-only service-account credentials and the async streaming API. If Vertex is unavailable, the UI clearly labels a curated qualitative fallback. Financial facts use public Yahoo Finance quote endpoints and are labeled as delayed/incomplete; if Yahoo is unavailable, qualitative output remains visible.
Five-year historical enrichment uses Yahoo Finance daily adjusted close with returned corporate actions, explicit live/cached/stale/unavailable status, and no causal claim. Screener is outbound-only and is never scraped. Market events use NSE's unofficial public announcements JSON (`/api/corporate-announcements`, browser UA + Referer); BSE's API blocks server traffic, so it is not used. If NSE blocks, `events_status` becomes `unavailable` and only Yahoo payouts show.