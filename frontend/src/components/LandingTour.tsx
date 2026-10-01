import { GuidedTour } from "@/components/GuidedTour";
import type { TourStep, TourTask } from "@/components/GuidedTour";

const LANDING_STEPS: TourStep[] = [
  { target: "observation-textarea", kicker: "STEP 01 · YOUR CLUE", title: "Write what you've noticed", copy: "A habit, a queue, a product everyone suddenly owns. One honest sentence is enough." },
  { target: "example-chips", kicker: "STEP 02 · NEED A NUDGE?", title: "Tap an example, or speak", copy: "Each chip fills the box with a real-world observation. Prefer talking? The mic understands English, Hindi and Hinglish." },
  { target: "scoring-explainer", kicker: "STEP 03 · HOW THE READ WORKS", title: "Facts and judgment, kept apart", copy: "Real Yahoo Finance prices on one side, an AI quality scorecard on the other — always labelled so you know which is which." },
  { target: "landing-disclaimer", kicker: "STEP 04 · EDUCATION, NOT TRADING", title: "Aaspaas never trades for you", copy: "No buy/sell calls, no price targets, no money managed. It teaches a framework and points you to the filings to check yourself." },
];
const LANDING_TASKS: TourTask[] = [
  { label: "Tap an example, or tap the mic", hint: "Pick any chip above the button — it fills the box for you.", selector: '[data-testid^="example-chip-"], [data-testid="voice-input-button"]', glow: '[data-testid="example-chips"]' },
];

const RESULTS_STEPS: TourStep[] = [
  { target: "overlay-chart", kicker: "1 · ALL STOCKS, ONE CHART", title: "How these stocks travelled", copy: "Every company starts at 0% so different share prices compare fairly. Diamonds and dots underneath are real filings, results and dividends." },
  { target: "performance-grid", kicker: "2 · ONE CARD PER COMPANY", title: "Real prices, in rupees", copy: "Each card shows the actual share price, its high and low, and the deepest fall along the way — sourced from Yahoo Finance." },
  { target: "category-cards", kicker: "3 · QUALITY LENSES", title: "Judge the business, not the chart", copy: "Moat, capital allocation, management and growth runway are the AI's judgment — tap a lens to rank the companies by it." },
];
const RESULTS_TASKS: TourTask[] = [
  { label: "Switch the period to 1Y", hint: "Use the 1Y · 3Y · 5Y control above the chart.", selector: '[data-testid^="performance-period-"]', glow: '[data-testid="performance-period-control"], [data-testid="performance-period-1y"]' },
  { label: "Tap a filing marker ◆", hint: "The diamonds and dots along the bottom of the chart.", selector: '[data-testid^="event-marker-"]', glow: '[data-testid="event-marker-0"]' },
  { label: "Turn on Compare with Nifty 50", hint: "See whether these stocks beat the wider market.", selector: '[data-testid="nifty-toggle"]' },
  { label: "Tap a quality lens card", hint: "The cards rank the businesses by that lens.", selector: '[data-testid^="category-card-"]', glow: '[data-testid="category-card-moat"]' },
  { label: "Open “Explore details” on any company", hint: "The full business model, risks and what to verify.", selector: '[data-testid^="performance-explore-"], [data-testid^="business-explore-"]', glow: '[data-testid^="performance-explore-"]' },
];

type TourClose = (outcome: { completed: boolean; tasksDone: number }) => void;

export function LandingTour({ open, onClose }: { open: boolean; onClose: TourClose }) {
  return <GuidedTour open={open} steps={LANDING_STEPS} tasks={LANDING_TASKS} onClose={onClose} />;
}

export function ResultsTour({ open, onClose }: { open: boolean; onClose: TourClose }) {
  return <GuidedTour open={open} steps={RESULTS_STEPS} tasks={RESULTS_TASKS} onClose={onClose} />;
}
