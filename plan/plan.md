# Aaspaas: Peer Comparison Table, Financials Tab, No Ratings

Aaspaas turns an everyday observation into the listed Indian companies behind it and teaches how each one makes money, using real price and financial data.
This update replaces the AI ratings with a sourced peer comparison table on the main results screen, and adds a multi-year "Financials" tab to each company's details.

## Who it's for
- Readers who want to know whether a company is genuinely strong or whether its whole sector looks the same. Seeing each company next to its direct rivals answers this.
- Readers who want real numbers they can scan quickly (profit, cash flow, ROCE, valuation) instead of an AI's score.
- Mostly phone users, so the table and the new tab are designed for small screens first.
- The product itself: it stops rating or ranking companies, to stay clearly on the education side of investment-advice rules.

## Core features and experience

### 1. Peers found during discovery
- **Same AI call:** the discovery call that finds the 3–4 theme-matched companies also names 2 direct listed competitors for each one. These are same-sector rivals, not other companies from the idea.
- **Checks on peers:**
  - Every peer ticker is checked against Yahoo. Any that don't resolve are dropped, never replaced with a guess.
  - A peer never repeats a company that is already in the table.
  - If a company has no valid rival, its group says "No clear listed rival found".
- **AI note per peer:** each peer gets one short line explaining why it counts as a rival (for example, "also sells packaged snacks through kirana stores"), labelled as AI context.
- **Already-saved ideas:** older ideas don't have peers yet. Peers are found once when the idea is next reopened, then saved. This doesn't count against the visitor's 3-per-day discovery allowance.

### 2. Peer comparison table on the main results screen
- **Placement:** it replaces the old "Quality lenses" section, which had the category leader cards and the scored business cards. It sits directly after the price section ("How these stocks travelled").
- **Layout:** one combined table. Each discovered company is a highlighted row, with its 2 peers grouped just below it. Groups follow the same order as the price cards. That's about 9–12 rows in total.
- **Columns (all sourced from Yahoo Finance):**
  - market cap
  - P/E
  - ROE
  - ROCE
  - operating margin
  - net profit (latest fiscal year)
  - operating cash flow (latest fiscal year)
  - revenue growth
  - debt/equity
  - 1-year price change
- **ROCE:** Yahoo doesn't publish ROCE, so it is calculated from Yahoo's latest annual figures as operating profit ÷ (total assets − current liabilities). The column header marks it "calculated".
- **No ranking:** no winners, no sorting by "best" and no scores. A fixed teaching prompt sits above the table: "Is this company's edge real, or is the whole sector this good? Compare ROE, ROCE and margins within each group."
- **Phone layout:**
  - The company-name column stays fixed while the metrics scroll sideways, with a swipe hint on first view.
  - Tapping a column header opens a short plain-language explainer for that metric (what it measures and why it matters).
  - Tapping a peer's name shows its AI "why it's a rival" line.
  - Tapping a discovered company's name opens its details.
- **Loading and gaps:**
  - Rows fill in as data arrives, with skeleton cells meanwhile.
  - A missing figure shows as "—" and is never estimated.
  - If Yahoo is down, the names still show with "live data unavailable right now".
- **Labels:** the table is marked as sourced fact in the marigold "real data" style: "Yahoo Finance · may be delayed or incomplete · ROCE calculated from annual figures". It also carries the educational, not-a-recommendation disclaimer.
- **Phone panels:** on phones the table is its own snap panel, called "Peer table". It scrolls inside the panel before moving on, the same way other tall panels do today.

### 3. All AI 1–5 scores and rankings removed
- **What goes:**
  - the main-screen quality section and its category leader cards (Overall, Moat, Capital allocation, Management, Growth runway, P/E lowest, Market cap largest)
  - the pip and number scores in details
  - the recap's side-by-side score comparison
  - any score on share cards or shared pages
- **What stays:** the written notes on moat & pricing power, capital allocation, management and growth runway, with no numbers or pips. In details, "Full scorecard" becomes "Business lenses".
- **Gut check:** the yes/no question stays. The reveal now says whether the reader's answer matched the framework's written read ("your gut matched" / "your gut differed, worth digging into why"), without showing any score.
- **Recap:** shows the discovered companies' written lenses side by side, plus a compact facts row per company drawn from the same sourced data. Share and "try another idea" stay as they are.
- **Results tour:** the "quality lenses" card and the "tap a lens card" task are replaced by a table card and a task: swipe the table sideways or tap a metric header.

### 4. "Financials" tab in company details
- **Menu:** a new item in the detail menu, next to the existing sections.
- **Three line items:** revenue, net income and operating cash flow. Each row shows:
  - a small trend sparkline across 4 fiscal years (FY22–FY25) plus a trailing-12-months point
  - the latest value in ₹ crore
  - the change across the period
- **Detail on tap:** tapping a row opens a year-by-year table for that line item.
- **Loss years:** shown in the loss colour. Green and red are used only for actual positive and negative numbers.
- **Teaching line:** one sentence generated from the numbers alone (not by AI) compares net income with operating cash flow. For example: "Operating cash flow has been above net income in 4 of 4 years, so reported profit is turning into cash."
- **Source and gaps:** labelled "Yahoo Finance · annual reported figures · may be delayed or incomplete". A missing line shows "not available". If everything is missing, the tab says "Live financials unavailable right now".

## User flow
1. The reader submits an observation. The waiting screen runs as today, and discovery returns the companies along with their peers.
2. The results open with the price comparison and per-stock price cards, unchanged.
3. Next comes the peer table. The reader swipes the metrics sideways, taps "ROCE" to learn what it means, and compares each highlighted company against its two rivals.
4. They tap a company name or "Explore details" on a price card. In details they open "Financials" for the sparklines, "Business lenses" for the written notes, or any other section.
5. The recap shows written lenses and compact facts side by side, with share and try-another buttons.

## UI/UX feel
- **Visual register:** calm, editorial and paper-toned, matching the existing results page.
- **Table:**
  - dense but readable
  - discovered-company rows in a soft marigold tint with the serif company name
  - peer rows indented and slightly muted
  - monospace uppercase column labels
  - a thin divider between groups
- **AI context:** peer reasons and the written lenses use the indigo secondary style, so AI words always look different from sourced numbers.
- **Sparklines:** thin ink lines with a dot at the latest value, each row about the width of a phone screen and easy to tap.
- **Themes:** light and dark are both checked for contrast, especially the row tints and gain/loss colours.

## Implementation phases

### Phase 1: MVP (built now)
- Peers (2 per company) named during discovery and checked against Yahoo. Older ideas get peers once, on reopen.
- Main-screen combined peer table with 10 sourced columns, calculated ROCE, metric explainers, phone-friendly sideways scrolling and honest gaps.
- Removal of all AI 1–5 scores and rankings across results, details, recap and share. Written lenses are kept.
- "Financials" tab with revenue, net income and operating cash flow sparklines (4 fiscal years + TTM).
- Results tour updated. Table and Financials views are recorded in analytics and shown in Studio.

### Phase 2
- Full mobile review across the landing page, results panels, detail view, recap and journal.
- Mic-first layout on phones (big mic button, keyboard secondary).
- Journal search, filter by company, and remove-entry. Saved notes keep a chosen period and highlighted moment.

### Phase 3
- Tap a peer to open its own lightweight detail view (financials and stock journey).
- Quarterly view and longer history in Financials, if a richer data source is added.
- The existing future items: verified cross-device journal, sourced voice follow-up questions, voice budget alerts, Plus entitlements, premium data.

## Assumptions
- **Discovery time:** adding peers makes discovery a few seconds longer (about 8 extra Yahoo lookups). The table loads progressively, so the price section isn't delayed.
- **Figures:** net profit and operating cash flow are the latest reported fiscal year, in ₹ crore. Revenue growth is Yahoo's latest year-on-year figure. The 1-year price change uses adjusted close.
- **Order and sorting:** no column sorting. Groups keep the AI-relevance order used by the price cards, so nothing reads as a ranking.
- **No markers:** there are no "above/below peers" markers. The highlighted rows and the teaching prompt carry the comparison.
- **Details:** the details view has no separate peers tab, because the table lives on the main screen.
- **Studio:** the gut-check accuracy rate keeps working, comparing answers against the framework's written read rather than a score.
- **Price cards:** the "Explore details" and "Test your intuition" buttons on the price cards stay as the way into each company. The scored business cards they duplicated are removed.
- **Stored data:** existing saved ideas keep their stored data, but no score is shown anywhere for them either.
