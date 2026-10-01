# Aaspaas Performance-First Results Plan

Aaspaas will open every discovery with a visual comparison of how the surfaced stocks have travelled, using verified adjusted-price history as the immediate hook.
The existing business-quality comparison remains directly below, so price performance creates curiosity while business context, risk, and independent research remain the lesson.

## Who it's for

- Curious Indian consumers who recognize products, services, and changing habits before they understand the listed businesses behind them.
- New and intermediate investors who find a visual stock journey easier to enter than a qualitative scorecard, but still need help separating price movement from business quality.
- Mobile and social visitors who need an immediate, scannable payoff before choosing whether to explore a company in depth.
- Returning readers who want to compare market journeys, business quality, and their own intuition without following a forced story sequence.

## Core features and experience

### Performance is the first results hook

- Results open with a “How these stocks travelled” section above the existing business comparison.
- All surfaced companies remain in the AI relevance order. The page does not rank companies by gains, imply that the best performer is the best business, or create a winners-and-losers leaderboard.
- Each company receives a compact performance card containing:
  - company name, ticker, and exchange;
  - a mini adjusted-price chart;
  - total adjusted-price movement over the selected period;
  - maximum peak-to-trough drawdown over the selected period;
  - period start and end dates;
  - Yahoo Finance source, as-of date, and live/cached/stale/unavailable status.
- A shared 1Y / 3Y / 5Y period control changes every chart and statistic together. It defaults to 5Y.
- Adjusted close remains the comparison series so dividends and stock splits do not create false visual jumps.
- Returned dividends and splits remain available in the deeper stock-journey detail, rather than crowding the first-glance cards.
- Positive and negative movement use semantic green and red only for the actual sourced value. Decorative accents remain marigold and indigo.
- The section states plainly that historical price movement is context, not proof of business quality, future performance, or a reason to buy or sell.
- If a company lacks usable historical data, its place remains visible with an honest unavailable state. The rest of the result page remains usable.

### Business quality stays directly below

- The current comparison view follows immediately after the performance section on the same page.
- It continues to show all companies side by side on desktop and as stacked leaderboard cards on mobile.
- Each card keeps the one-line observation connection, direct/enabling/adjacent label, four mini quality-score pips, P/E, and market cap.
- Existing sorting remains available for the business section: overall quality, moat, P/E, and market cap.
- A short transition explains the separation: the first section shows what the share price did; the second asks what kind of business sits underneath it.

### Every company offers two explicit paths

- Every company card presents two visible actions rather than relying on a generic card tap:
  - **Explore details** opens the existing menu-driven company workspace.
  - **Test your intuition** opens the optional question directly.
- The two actions appear consistently on both the performance cards and the business-quality cards.
- “Explore details” opens the existing selectable sections: what stands out, what is risky, how it makes money, full scorecard, stock journey, and verify it yourself.
- “Test your intuition” opens only that company’s optional game. It never blocks details, charts, comparison, recap, sharing, or the journal.
- After answering or skipping, the user receives a supportive explanation of why the question matters and can choose either “Explore details” or “Back to all companies.”
- The running read count remains a light session statistic and is never described as investing ability, suitability, or predictive skill.

### Verified data and educational safeguards

- Performance cards and charts use verified Yahoo Finance historical data only; AI does not generate or fill missing price values.
- AI interpretation and verified numerical data remain in separate visual containers with separate labels.
- Aaspaas does not claim why a stock moved unless a dated, reliable source is available. It points readers toward exchange announcements, results, or management commentary near the date.
- There is no hypothetical ₹10,000 return, missed-opportunity language, price target, trade action, or urgency framing.
- The existing Screener handoff remains outbound-only and clearly labeled as independent research.
- The education-only disclaimer remains visible on the performance section, company details, and recap.

### Loading and resilience

- Company discovery can appear before all market data is ready.
- The performance section reserves each chart’s final space with a purposeful skeleton so cards do not jump while history loads.
- Available companies become interactive immediately; one slow or unavailable ticker does not block the other companies or the business comparison.
- The existing current-finance and historical-data cache behavior remains in place.
- The clearly labeled curated company fallback remains available when live AI fails.

### Measurement

- Existing analytics continue for submissions, detail sections, intuition questions, recap, sharing, journal, email, limits, fallbacks, and outbound research.
- New aggregate events record:
  - performance section viewed;
  - 1Y / 3Y / 5Y period selected;
  - performance card viewed;
  - “Explore details” selected from a performance or business card;
  - “Test your intuition” selected from a performance or business card;
  - historical data status and render latency;
  - whether a reader continued from price performance into business quality.
- The internal studio adds performance-to-quality continuation and details-versus-intuition choice rates.

## User flow

1. A visitor submits an everyday observation.
2. The educational waiting view explains that Aaspaas is mapping listed companies and checking sourced market history.
3. Results open on the performance section, showing every surfaced company in AI relevance order with a 5Y adjusted-price mini chart, total movement, and maximum drawdown.
4. The visitor may switch the shared period to 1Y or 3Y; all company cards update together.
5. From any performance card, the visitor chooses either “Explore details” or “Test your intuition.”
6. Scrolling down reveals the existing business-quality comparison, introduced as a separate lens beneath the price journey.
7. Each business card repeats the two explicit actions, so the visitor can enter details or the optional game without relying on a hidden card tap.
8. “Explore details” opens the menu-driven workspace and allows sections to be read in any order, with a persistent route back to all companies.
9. “Test your intuition” opens one optional question for that company, then offers a route to details or back to results.
10. The visitor can wrap up at any time to reach the existing learning-style recap, sharing, email prompt, broker-interest placeholder, and browser journal.

## UI/UX feel

- The performance section is the strongest visual moment but does not resemble a live trading terminal.
- Desktop uses one aligned row of company performance cards with synchronized chart scales where practical, generous whitespace, and a clearly shared period control.
- The charts animate once with a restrained line draw. Percentages remain readable but do not use celebratory effects.
- A clear editorial divider separates “What the stock did” from “What the business may be worth understanding.”
- The two company actions have distinct hierarchy: “Explore details” is the primary editorial action, while “Test your intuition” uses the indigo secondary treatment.
- Mobile uses full-width stacked performance cards, a sticky 1Y / 3Y / 5Y selector, and two large action buttons with at least 44-pixel touch targets.
- Mobile headings remain expressive but do not crowd the viewport. Body copy uses a comfortable minimum size and line height; ticker, source, and status labels remain monospace but are never too small to read.
- Charts fit the device width without horizontal scrolling, clipped labels, or tiny tap targets.
- The existing warm paper comparison and dark company-detail workspace remain visually distinct.

## Implementation phases

### Phase 1 — Performance-first MVP, built now

- Add the results-page performance section above the existing business comparison.
- Add synchronized 1Y / 3Y / 5Y controls, defaulting to 5Y.
- Show adjusted-price mini charts, total period movement, maximum drawdown, dates, source, freshness, and honest unavailable states for every company.
- Preserve AI relevance order and explicitly avoid performance ranking.
- Add visible “Explore details” and “Test your intuition” actions to every performance and business card.
- Make the intuition game optional and provide clear exits to details or all companies after answering or skipping.
- Preserve the menu-driven detail workspace, recap, sharing, journal, email prompt, rate limit, Screener handoff, and education boundaries.
- Improve mobile chart sizing, typography, spacing, sticky period controls, touch targets, and action hierarchy.
- Add aggregate analytics for period choice, price-to-quality continuation, and details-versus-intuition selection.

### Phase 2 — Sourced market-event research

- Link highlighted dates to relevant NSE/BSE announcements, result releases, or company filings when a reliable dated source exists.
- Add plain-language event timelines without asserting causation from price data alone.
- Allow saved field notes to retain a chosen period and highlighted market moment.

### Phase 3 — Personalized learning journeys

- Use repeated exploration patterns to recommend educational paths about drawdowns, expectations, moats, and annual-report reading without giving investment advice.
- Add verified cross-device journal access and active Plus entitlements only after demand and operating cost are understood.
- Introduce richer licensed market and fundamentals data for a paid research-learning tier.

## Assumptions

- The performance section and business-quality comparison remain on one continuous result page; there are no top-level tabs in Phase 1.
- The period selector offers 1Y, 3Y, and 5Y and defaults to 5Y.
- Total period movement means change in adjusted close between the first and last available observations in the selected period.
- Maximum drawdown means the largest adjusted-close peak-to-trough decline inside the selected period.
- Companies remain in AI relevance order at all periods; changing the period never reorders them.
- The two explicit actions appear on both performance cards and business comparison cards.
- “Explore details” is visually primary; “Test your intuition” is secondary and optional.
- The existing alternating intuition formats remain: moat choice, business-model choice, and metric guess when verified current data exists.
- The existing menu-driven company detail view remains; the performance-first page changes entry and navigation, not the research content itself.
- The existing recap, journal, sharing, optional email capture, rate limit, Plus-interest preview, and broker-interest placeholder remain.
- Historical cards use Yahoo Finance adjusted-close data already retrieved for the surfaced companies; missing values are not estimated.
- The performance section does not add comparison against an index or benchmark in Phase 1.
- Price charts do not use intraday data, live quotes, trading controls, alerts, or portfolio language.
- Phase 1 includes mobile optimization for the new performance section and both company actions; it does not redesign unrelated admin screens.