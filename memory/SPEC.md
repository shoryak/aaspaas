# Aaspaas living spec

## Product
Aaspaas is an educational Indian stock-discovery experience based on “invest in what you know.” Readers submit an everyday observation, receive 3–4 LLM-identified NSE/BSE companies, and learn through an Instagram Stories-style deck. It is explicitly not a trading app, recommendation engine, brokerage, or money manager.

## Data model
- `ideas`: raw observation, anonymous session id, timestamp, surfaced ticker list, and embedded qualitative company cards with scorecards and optional Yahoo finance facts.
- `gut_checks`: one yes/no answer per displayed company, whether it matched the AI lean, idea/session ids, timestamp.
- `share_events`: share clicks by idea/session and timestamp.
- `sessions`: anonymous session cookie, pageviews, creation and last-seen timestamps.

## Key flows
1. Landing → submit observation → FastAPI calls Emergent LLM → Yahoo Finance facts are fetched per company without blocking qualitative content.
2. Story deck → answer or skip a gut check → reveal supportive comparison, connection, business model, four-axis scorecard, risk, and verify-yourself prompt.
3. Recap → compare scorecards → share or try another idea.
4. `/admin` → password login → internal analytics summary.

## Auth and roles
The public flow is anonymous and uses an httpOnly `aaspaas_session` cookie. The internal dashboard uses a single `ADMIN_PASSWORD` environment value and an httpOnly admin cookie. There are no public user accounts.

## Integrations
LLM uses the Emergent universal key with OpenAI `gpt-5.4` through `stream_message()`. Financial facts use public Yahoo Finance quote endpoints and are labeled as delayed/incomplete. If Yahoo data is unavailable, qualitative AI output remains visible.