# Aaspaas living spec

## Product
Aaspaas is an educational Indian stock-discovery experience based on “invest in what you know.” Readers submit an everyday observation, receive 3–4 LLM-identified NSE/BSE companies, and learn through an Instagram Stories-style deck. It is explicitly not a trading app, recommendation engine, brokerage, or money manager.

## Data model
- `ideas`: raw observation, anonymous session id, timestamp, surfaced ticker list, and embedded qualitative company cards with scorecards and optional Yahoo finance facts.
- `gut_checks`: one yes/no answer per displayed company, whether it matched the AI lean, idea/session ids, timestamp.
- `share_events`: share clicks by idea/session and timestamp.
- `sessions`: anonymous session cookie, pageviews, creation and last-seen timestamps.
- `engagement_events`: story stage dwell, chain/hook/chart/question/journal/email/limit/referral events with idea, ticker, and aggregate-safe properties.
- `submission_attempts`: UTC day, session id, and privacy-preserving daily IP fingerprint for the three-per-day limit.
- `finance_cache` / `historical_cache`: 45-minute current facts and six-hour adjusted-price histories.
- `email_interests`: consented update interest linked internally to the anonymous session; email does not unlock a journal.

## Key flows
1. Landing → submit observation (maximum three starts per UTC day by session and daily IP fingerprint) → rotating educational waiting view → Vertex AI company discovery.
2. Story deck → five-step observation chain → verified Yahoo adjusted-price hook/full chart → one alternating question → business model, current data, scorecard, assumptions, field note, and Screener handoff.
3. Recap → learning-style snapshot, score comparison, optional sharing, optional update consent, and clearly inactive broker-interest placeholder.
4. `/discoveries` restores this browser's ideas, recap results, and saved field-note tickers.
5. `/admin` → password login → aggregate funnel, latency, hook/chart/chain/question, retention, email, limit, fallback, Screener, and sharing signals.

## Auth and roles
The public flow is anonymous and uses an httpOnly `aaspaas_session` cookie. The internal dashboard uses a single `ADMIN_PASSWORD` environment value and an httpOnly admin cookie. There are no public user accounts.

## Integrations
LLM discovery uses Vertex AI Gemini `gemini-2.5-flash` in `us-central1` with server-only service-account credentials and the async streaming API. If Vertex is unavailable, the UI clearly labels a curated qualitative fallback. Financial facts use public Yahoo Finance quote endpoints and are labeled as delayed/incomplete; if Yahoo is unavailable, qualitative output remains visible.
Five-year historical enrichment uses Yahoo Finance daily adjusted close with returned corporate actions, explicit live/cached/stale/unavailable status, and no causal claim. Screener is outbound-only and is never scraped.