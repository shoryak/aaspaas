# Aaspaas Engagement, Retention, and Growth Plan

Aaspaas turns an everyday observation into a short, visual story about the Indian listed businesses and real stock journeys behind it.
The experience remains educational—not trading advice—while using verified market moments, personal cause-and-effect narratives, and light interaction to make business learning memorable.

## Who it's for

- Curious Indian consumers who notice products, habits, and infrastructure around them but do not yet know how to connect those observations to listed companies.
- New and intermediate investors who want to practise business-quality thinking without receiving buy/sell recommendations or price targets.
- Social visitors who need an immediate, low-friction payoff before they will share, return, or provide an email address.
- The internal Aaspaas team, which needs to understand what people explore, where they lose interest, what they share, and what could support a paid education product.

## Core features and experience

### A story that builds curiosity

- Each company becomes a short sequence rather than one dense reveal:
  1. echo a phrase from the user’s own observation;
  2. reveal the company through a visual cause-and-effect trail;
  3. open with one verified, surprising stock-market moment;
  4. explain what that movement teaches about expectations, uncertainty, or risk;
  5. offer one light interaction;
  6. reveal the business model, current real data, scorecard, plot twist, and research prompt.
- Questions support the story instead of carrying it. A user can understand and enjoy a company card even when they skip the interaction.
- Question formats alternate by company so a session does not repeat the same interaction:
  - an intuitive moat or pricing-power choice;
  - a multiple-choice question about how the company makes money;
  - a higher/lower or range-based guess using a real fetched metric.
- Each company receives only one question. If the required real metric is unavailable, the card automatically uses a qualitative question instead.
- Questions use conversational language and begin with what the user can reasonably infer. They do not assume finance knowledge or ask the user to endorse an investment conclusion.
- The reveal explains why the answer matters, not merely whether it matched the model.
- A running “your read so far” indicator shows matched answers out of attempted answers without treating it as investing skill or advice.

### Verified stock moments as the hook

- Company cards mix two historical formats across a session:
  - **Wildest moment:** the most striking verified one-day move, approximately one-trading-month move, or peak-to-trough drawdown in the last five years.
  - **Five-year journey:** a compact view of how the adjusted share price travelled across the period, including major rises, falls, and recovery or non-recovery.
- The default view is one striking movement and a roughly 20-second explanation. A full five-year chart is available on demand rather than placed in the main story flow.
- Historical calculations use adjusted close so stock splits and dividends do not create fake “wow” movements. Returned split and dividend events are shown where relevant.
- Every movement displays the source, period, as-of date, and whether the data is live, cached, stale, or unavailable.
- Aaspaas never presents a price movement as proof of business quality. The teaching beat explicitly separates:
  - what the business did;
  - what the market expected;
  - what the verified price series shows; and
  - what still needs investigation.
- Without a dated, reliable source for an event, Aaspaas does not say a stock moved “because” of a particular development. It says the movement happened and points the user to filings or announcements around that date.
- No “₹10,000 became ₹X” widget, return-chasing language, price target, or implied missed opportunity is shown.

### A personal observation-to-stock bridge

- Each company includes a five-step visual chain built from the user’s words:
  1. **You noticed:** the relevant phrase from the submitted observation;
  2. **Behaviour changed:** what customers, businesses, or households appear to be doing;
  3. **The company gets paid when:** the specific revenue driver connected to that behaviour;
  4. **Profit can change if:** the volume, price, cost, or capital factor that makes the link economically meaningful;
  5. **The stock reacts to expectations about:** the growth, margin, moat, or execution assumption the market may be pricing.
- The chain distinguishes the user’s observation, verified company facts, and AI interpretation so the narrative feels personal without disguising judgment as sourced data.
- A visible connection-strength label—direct, enabling, or adjacent—shows how close the listed company is to the original observation.
- Every chain ends with two teaching prompts rather than another quiz:
  - “What has to be true?” summarises the key assumption supporting the link.
  - “What could break the chain?” introduces the most important disconfirming evidence.
- Users can save a chain to My Discoveries as a “field note” for later verification.

### A shareable payoff

- The recap assigns a playful learning style—such as Detective, Contrarian, or Storyteller—based on the mix of answers, skips, and explored details.
- The result is framed as a session snapshot, not a psychological assessment or a claim about future investing performance.
- A visually distinct, screenshot-friendly result card includes the investor type, a phrase from the original observation, the most surprising verified stock moment, the companies explored, and the session score.
- Sharing remains optional and is tracked as the core growth action.

### Faster perceived and actual results

- Discovery is split into a fast first pass and progressive enrichment: company names and tickers appear first, while qualitative explanations, scorecards, and real data fill in afterward.
- Enrichment for identified companies runs in parallel, and the next company is prepared while the user answers the current card.
- Current financial data is cached per ticker for 45 minutes. Five-year historical series and calculated movement summaries are cached for six hours because they change less frequently.
- Every unresolved block has a purposeful skeleton or shimmer state; the whole screen never waits behind one spinner.
- The initial waiting view rotates short Peter Lynch principles, investing facts, and explanations of what Aaspaas is checking.
- If Vertex AI or live financial data fails, the current honest fallback behaviour remains visible and the usable parts of the story continue.

### More useful company research

- Existing Yahoo Finance fields remain the in-product factual block: market cap, P/E, ROE, debt/equity, and revenue growth, with delayed/incomplete-data disclosure.
- A separate verified historical block uses five years of Yahoo Finance daily prices, adjusted close, volume, and returned corporate actions to calculate the 52-week range, largest daily move, largest approximately-one-month move, maximum drawdown, and annual journey.
- Verified historical data and AI interpretation never share the same visual container or source label.
- Each company gets a clearly labelled “See full fundamentals on Screener” outbound link as part of the verify-it-yourself step.
- Screener is linked only; its pages are not scraped, copied, or treated as an API.
- The qualitative section adds a compact “what to check next” list covering the relevant annual-report segment, management commentary, and the metric most likely to disprove the observation-to-company connection.
- When a historical moment is shown, the research list also points to the exchange announcement, results release, or management commentary nearest that date without claiming causation.
- A provider-neutral boundary remains around financial enrichment so a licensed richer source can replace or supplement Yahoo Finance for a future paid tier.

### My Discoveries and return visits

- “My Discoveries” automatically restores ideas and companies on the same browser using the anonymous session.
- The journal shows the observation, date, surfaced companies, investor-type result, and a route back to the recap.
- Entering an email links the current anonymous journal to that email internally for future migration, while browser/session identity remains the only way to display history in Phase 1.
- An unverified email alone cannot reveal a private journal; cross-device restoration waits for verified email access in a later phase.

### Low-friction email capture

- A single “Get Aaspaas updates” field appears only:
  - after the first completed recap; and
  - on the daily-limit wall.
- The prompt never blocks sharing, retrying within the remaining allowance, or reading existing discoveries.
- It includes an obvious skip action and a short consent line: the address will only be used for Aaspaas updates, with a brief privacy note.
- Dismissing the recap prompt suppresses it on that browser for 30 days.
- Email records include consent time, capture location, linked session, and status so deletion or suppression requests can be honoured later.
- Phase 1 captures consented email interest but does not send campaigns or create a password-based account.

### Rate limiting and the Plus preview

- Free usage is limited to three expensive idea submissions per UTC day.
- The limit applies to both the anonymous session and a privacy-preserving daily IP fingerprint; exceeding either limit prevents further AI generation for that day.
- Reading saved discoveries, navigating stories, answering already-generated questions, sharing, and opening research links are not rate-limited.
- The limit response is a designed screen with reset context, the optional email prompt, and an Aaspaas Plus preview.
- The Phase 1 Plus preview presents future benefits: unlimited ideas, a persistent cross-device journal, and priority enrichment. It records interest but does not take payment or falsely imply an active subscription.
- The recap includes a clearly labelled, configurable broker-referral placeholder. Until a partner URL exists, it records interest and explains that a research partner is coming; it does not imitate a live affiliate offer.

### Behaviour and growth analytics

- Existing idea, answer, share, session, and pageview analytics continue.
- New events cover:
  - time spent on each company and story stage;
  - question format, answer, skip, accuracy, and metric-guess distance;
  - stock-hook format, chart expansion, highlighted movement, and whether the user continued after the hook;
  - cause-and-effect chain completion, connection-strength view, and saved field notes;
  - progressive-loading latency and whether live AI, curated fallback, live finance, or cached finance was used;
  - LLM-assigned sector and observation theme;
  - journal opens and recap completions;
  - email prompt shown, dismissed, and submitted, including capture location;
  - rate-limit hits, Plus-interest clicks, broker-interest clicks, and Screener outbound clicks.
- The internal dashboard shows daily trends, completion funnel, median time to first company, stock-hook continuation, chart expansion, cause-chain completion, question engagement, dwell time, return visitors, journal usage, email conversion, limit hits, fallback rate, Screener clicks, and sharing rate.
- Analytics remain aggregate and operational. Individual customer observations or emails are not sold or exposed in public leaderboards.

## User flow

1. The visitor submits an everyday observation from the landing page.
2. A short waiting sequence explains what is being checked and rotates useful investing context.
3. The first identified company and ticker appear as soon as the fast discovery pass is ready; remaining content continues loading progressively.
4. The first story echoes the visitor’s words and animates the five-step observation-to-stock chain so the company connection is understandable before any quiz appears.
5. The card reveals one verified historical hook: either a wild rise/fall/drawdown or a five-year journey. A short explanation separates business reality from market expectations.
6. The visitor may open the full chart, inspect corporate-action markers, or continue after the 20-second teaching beat.
7. One light interaction reinforces the lesson, followed by the business model, current factual block, qualitative scorecard, “what has to be true,” “what could break the chain,” research checklist, and Screener link.
8. The next company uses the other stock-hook style and a different interaction format. A real-metric guess is used only when the underlying value is available.
9. The recap compares the companies, shows the session score, and presents the shareable investor-type card with the session’s most surprising verified market moment.
10. After the first completed recap, the visitor may enter an email for updates or dismiss the prompt; sharing and continued use remain available.
11. “My Discoveries” restores prior sessions on the same browser and lets the visitor reopen completed recaps or saved cause-and-effect field notes.
12. After three idea submissions in a UTC day, the next submission opens the limit screen with reset guidance, optional update capture, and the Aaspaas Plus preview.
13. The internal team reviews engagement, chart usage, chain completion, latency, retention, email, rate-limit, fallback, referral-interest, and sharing trends in the protected dashboard.

## UI/UX feel

- The calm editorial landing and recap remain recognisably Aaspaas, but the story deck becomes more paced and cinematic.
- Story transitions use deliberate beats: personal observation, connection chain, market surprise, explanation, optional interaction, and evidence. Content enters in layers rather than expanding into a long article.
- Verified movement hooks use restrained but dramatic chart motion: the line draws to the key date, pauses, and annotates the real percentage move. Motion supports comprehension and never resembles a live trading terminal.
- The cause-and-effect chain uses a horizontal path on desktop and a vertical path on mobile, progressively lighting each link from the user’s observation to the expectation reflected in the stock.
- Question controls feel tactile and varied: choice cards, range chips, and higher/lower controls, with supportive feedback rather than exam-like red or green grading. They remain secondary to the story.
- Skeletons reserve the final layout so incoming data does not cause jarring jumps.
- Waiting content feels educational and alive, with subtle motion and short rotating copy rather than a generic loading message.
- The investor-type card has a distinctive visual identity suitable for screenshots while retaining the marigold, indigo, serif, and monospace system.
- The optional full chart feels like opening a research layer: five-year adjusted price, key movement markers, corporate actions, source date, and plain-language definitions are available without overwhelming the main card.
- “My Discoveries” feels like a personal field notebook, not a brokerage watchlist.
- The Plus wall is informative rather than coercive: the free limit, reset timing, skip paths, and inactive-payment status are explicit.
- Education-only language remains prominent on landing, story reveal, recap, Screener handoff, broker placeholder, and Plus preview.

## Implementation phases

### Phase 1 — Full engagement MVP (built now)

- Deliver content-led story beats: personal observation echo, visual cause-and-effect chain, verified stock-movement hook, short teaching explanation, then one optional reinforcing interaction.
- Deliver mixed historical formats across companies: wildest verified moment and five-year journey, with a full adjusted-price chart available on demand.
- Deliver connection-strength labels, “what has to be true,” “what could break the chain,” and saveable field notes.
- Deliver alternating one-question formats, including metric guesses with qualitative fallback, as supporting interactions rather than the primary hook.
- Deliver the running session score and shareable investor-type result.
- Deliver progressive discovery and enrichment, next-card prefetching, purposeful waiting content, a 45-minute current-finance cache, and a six-hour historical-series cache.
- Deliver the session-based My Discoveries journal and internal email-to-journal linkage without email-based access.
- Deliver the two optional email-capture moments, consent metadata, privacy note, and 30-day dismissal suppression.
- Deliver the three-per-day session/IP limit, designed limit wall, Plus-interest capture, and configurable broker-interest placeholder.
- Deliver Screener outbound links and richer verify-it-yourself checklists without scraping.
- Deliver sector/theme tagging, stock-hook and chart events, cause-chain and field-note events, dwell and funnel events, latency/source events, email/rate-limit/referral events, and corresponding internal dashboard views.

### Phase 2 — Verified retention and paid Plus

- Add verified email access through a magic link so discoveries can be restored safely across devices.
- Introduce real Aaspaas Plus billing only after demand and cost-per-engaged-session are understood.
- Turn Plus benefits into active entitlements: higher or unlimited limits, priority enrichment, persistent journal, deeper research checklists, and optional educational digests.
- Add a licensed richer fundamentals provider for paid users while retaining source labels and the education-only boundary.
- Activate a real, clearly disclosed broker partner link if an appropriate partnership exists.

### Phase 3 — Learning product and sustainable monetization

- Build guided learning paths around sectors, moats, capital allocation, and annual-report reading.
- Add longitudinal learning insights that show how a reader’s reasoning changes without turning them into personalised buy/sell advice.
- Offer paid educational cohorts, premium research workflows, and institutional or campus licences.
- Explore clearly labelled sponsorships and aggregated product-insight reporting without selling personal emails, raw observations, or individual behavioural histories.

## Assumptions

- Phase 1 includes the full engagement MVP selected above; real billing, campaign email delivery, and a paid fundamentals provider are deferred.
- The daily allowance resets at 00:00 UTC and counts a submission once the expensive discovery request begins, even if an upstream provider later fails.
- Three submissions are allowed only when both the session and daily IP fingerprint remain below the limit; raw IP addresses are not retained.
- The anonymous journal is browser-bound in Phase 1. Email linkage prepares records for future migration but does not grant access because there is no email verification yet.
- Email capture is for product updates only. It is optional, requires affirmative submission, is recorded with source and timestamp, and is not treated as consent for broker marketing.
- Anonymous behavioural and raw-observation analytics are retained for 12 months; consented email records are retained until deletion, suppression, or a later published retention policy applies.
- Sector and theme tags are model-generated analytics labels and may be corrected or grouped in the internal dashboard.
- A company receives one question per story. Formats alternate across companies, and metric questions appear only when verified source data is available.
- Questions are optional reinforcement. The observation bridge, verified market moment, and teaching explanation carry the educational value of each story.
- Historical hooks alternate between wildest-moment and five-year-journey formats across companies in a session.
- Historical movement uses five years of Yahoo Finance daily adjusted-close data. The default hook may select the largest absolute one-day move, largest absolute 21-trading-session move, maximum drawdown, or a representative long-term journey.
- Historical price calculations preserve returned corporate actions, source time, and as-of date. Missing observations remain missing rather than being estimated.
- A movement is described as verified price behaviour, not as evidence of causation. Event explanations require a dated external source; otherwise Aaspaas provides only a question to investigate.
- No hypothetical investment-return amount, missed-gain framing, price target, or urgency language is included.
- The full five-year chart is optional; the default story shows one annotated movement and a roughly 20-second explanation before the quality scorecard.
- The observation-to-stock chain labels AI interpretation separately from verified company and market facts.
- Investor types are lightweight educational session summaries, not investor profiling, suitability assessment, or financial advice.
- Yahoo Finance remains the in-product numerical source for Phase 1. Screener is outbound-only and will not be scraped.
- The broker CTA has no live destination in Phase 1; it is clearly marked as forthcoming and records interest only.
- The curated fallback remains enabled and visibly labelled whenever Vertex AI fails.
- Monetization will come from optional subscriptions, education products, and disclosed referrals—not from selling identifiable customer data.