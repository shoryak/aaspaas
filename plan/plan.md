# Aaspaas: Discoveries Fix + Live Streaming Voice Input

Aaspaas turns an everyday observation into the listed Indian companies behind it, with real price charts and a quality scorecard.
This update makes saved discoveries reopen with their full charts, keeps "My Discoveries" reachable on phones, and makes voice input show words live while you speak.

## Who it's for
- Returning visitors who want to reopen an earlier idea and see the same charts they saw the first time.
- Phone users, who currently can't find "My Discoveries" at all.
- Anyone using the mic, especially for Hindi or Hinglish, who wants to see their words appear immediately instead of waiting.

## Core features and experience

### 1. My Discoveries reopens the full chart view
- Tapping a saved discovery opens the same results page as the first visit:
  - the combined all-stocks chart (1Y/3Y/5Y, Nifty toggle, filing markers, share)
  - the per-stock ₹ price cards
  - the quality lenses
  - the business cards
- Today it opens the recap page, which has no charts.
- Each journal entry shows a small preview of its 5-year comparison chart, so ideas are easy to recognise at a glance.
- A secondary "Recap" link on each entry still opens the field-guide recap for anyone who wants it.
- On phones, reopened discoveries use the same one-swipe-per-panel navigation as fresh results.

### 2. "My Discoveries" visible on phones
- Today a phone-only layout rule hides the "My Discoveries" link in the header.
- It will appear in a compact form on the landing page, the results page, the friend landing page and the recap, at every screen size.

### 3. Live streaming voice input (Deepgram)
- **Engine:** Deepgram Nova-3, streaming, in multilingual mode, which handles English, Hindi and Hinglish switching mid-sentence.
- **While speaking:** words appear in the observation box within a fraction of a second. A faint "still listening" style marks words that may still change; settled words turn solid.
- **On stop:** the text is final almost instantly, with no separate clean-up wait. As you chose, there's no second Whisper pass when live recognition works.
- **Fallback:** if Deepgram is unavailable (no key yet, an outage, or the browser can't connect), the mic falls back to today's Whisper flow automatically, with no visible error.
- **Unchanged:** text stays editable before submitting, recordings stop automatically at 30 seconds, the limit stays at 5 voice notes per visitor per day, and failed or silent attempts don't count.
- **Security:** the Deepgram key stays on the server. Each recording gets a short-lived, single-use pass, issued only after the daily allowance has been checked.
- **Studio:** voice metrics are split by engine (Deepgram vs Whisper), with minutes, cost and the share of ideas started by voice.

## User flow
1. **Returning visitor:** taps "My Discoveries" (now visible on phones too) → sees past ideas with chart previews → taps one → lands on the full results page with charts → can still open "Recap" from the list.
2. **Voice:**
   1. The visitor taps "Speak it instead" and allows the mic.
   2. Words stream into the box while they talk.
   3. They tap Done, or recording stops at 30 seconds.
   4. They edit the text if needed and tap "Follow the clue".

## UI/UX feel
- **Journal:** keeps its editorial, paper-toned design, with each entry gaining a small dark chart preview like the share card.
- **Live transcript:** builds smoothly word by word, never jumping or duplicating. Words still being recognised appear lighter, settled words are solid ink.
- **Recording bar:** the existing dark pill with level bars and timer, plus a subtle "Live" tag when Deepgram is streaming.
- **Phone header:** the "My Discoveries" link becomes a compact icon with a short label so it fits beside the theme and tour controls.

## Implementation phases

### Phase 1: MVP (built now)
- Saved discoveries open the full chart view, with a chart preview and a secondary "Recap" link on each entry.
- "My Discoveries" visible on phones across all pages.
- Deepgram Nova-3 live streaming voice input with the same limits, automatic Whisper fallback, and Studio metrics split by engine.

### Phase 2
- Mic-first layout on phones (big mic button, keyboard secondary).
- An optional "also in English" line under Hindi or Hinglish transcripts.
- Journal search, filter by company, and remove-entry.

### Phase 3
- Cross-device journal via verified email, so discoveries follow the user to a new phone.
- Voice follow-up questions on a company ("why did this drop in 2023?"), answered with sourced context only.
- Deepgram usage alerts and a per-day voice budget cap shown in Studio.

## Assumptions
- **Deepgram key:** Deepgram is not covered by the Emergent key. You need a Deepgram API key: console.deepgram.com → Project → Settings → API Keys → Create (Speech-to-Text permission). It's billed to your Deepgram account at roughly $0.006–0.009 per audio minute for Nova-3 multilingual streaming. Until the key is added, voice input keeps working on Whisper.
- **Whisper:** stays as the automatic fallback rather than being removed.
- **Browser speech recognition:** the phone's built-in recognition is not used. Deepgram gives live words consistently on every browser, which avoids engine differences between Chrome and Safari.
- **Script:** Hindi speech may come back in Devanagari or romanised Hinglish, depending on how it was spoken. Text is kept as recognised, with no translation.
- **Limits:** voice allowance stays at 5 per visitor per day, a 30-second cap, a per-network limit and a global daily cap. Deepgram minutes count toward the same allowance.
- **Journal scope:** the journal stays tied to this browser. No sign-in is added.
- **Opening a discovery:** this still uses the cached price and fundamentals data and does not count against the 3-per-day discovery allowance.
- **Chart previews:** previews in the journal use the same server-rendered share image (5-year view), which is already cached.
