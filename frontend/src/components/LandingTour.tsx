import { useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

const STEPS = [
  { target: "observation-textarea", kicker: "STEP 01 · YOUR CLUE", title: "Write what you've noticed", copy: "A habit, a queue, a product everyone suddenly owns. One honest sentence is enough." },
  { target: "example-chips", kicker: "STEP 02 · NEED A NUDGE?", title: "Tap an example to start", copy: "Each chip fills the box with a real-world observation, so you can see how a clue becomes a company." },
  { target: "scoring-explainer", kicker: "STEP 03 · HOW THE READ WORKS", title: "Two lenses, kept separate", copy: "Verified Yahoo Finance prices on one side, an AI quality scorecard on the other — always labelled so you know which is fact and which is judgment." },
  { target: "landing-disclaimer", kicker: "STEP 04 · EDUCATION, NOT TRADING", title: "Aaspaas never trades for you", copy: "No buy/sell calls, no price targets, no money managed. It teaches a framework and points you to the filings to check yourself." },
];
const PAD = 10;

export function LandingTour({ open, onClose }: { open: boolean; onClose: (completed: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => { if (open) setStep(0); }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const element = document.querySelector<HTMLElement>(`[data-testid="${STEPS[step].target}"]`);
    if (!element) return;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => { setRect(element.getBoundingClientRect()); setViewport({ w: window.innerWidth, h: window.innerHeight }); };
    update();
    const settle = window.setTimeout(update, 450);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.clearTimeout(settle); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, step]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose(false);
      if (event.key === "ArrowRight") setStep((value) => Math.min(value + 1, STEPS.length - 1));
      if (event.key === "ArrowLeft") setStep((value) => Math.max(value - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const mobile = viewport.w < 700;
  const cardWidth = Math.min(360, viewport.w - 32);
  const below = rect ? viewport.h - rect.bottom > 250 : true;
  const cardStyle = mobile || !rect
    ? { left: 16, right: 16, bottom: 16 }
    : { width: cardWidth, left: Math.min(Math.max(rect.left, 16), viewport.w - cardWidth - 16), top: below ? rect.bottom + PAD + 14 : Math.max(rect.top - PAD - 14 - 230, 16) };

  return <AnimatePresence>{open && <motion.div className="tour-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .3 }} data-testid="landing-tour">
    <div className="tour-backdrop" onClick={() => onClose(false)} />
    {rect && <div className="tour-spotlight" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} data-testid="tour-spotlight" />}
    <motion.div className="tour-card" style={cardStyle} layout transition={{ layout: { duration: .45, ease: [0.22, 1, 0.36, 1] } }} role="dialog" aria-modal="true" aria-labelledby="tour-title" data-testid="tour-card">
      <button type="button" className="tour-skip" onClick={() => onClose(false)} data-testid="tour-skip-button">Skip tour <X size={13} /></button>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: .28, ease: [0.22, 1, 0.36, 1] }}>
          <span className="tour-kicker" data-testid="tour-step-kicker">{current.kicker}</span>
          <h3 id="tour-title" data-testid="tour-step-title">{current.title}</h3>
          <p data-testid="tour-step-copy">{current.copy}</p>
        </motion.div>
      </AnimatePresence>
      <div className="tour-footer">
        <div className="tour-dots" aria-hidden="true">{STEPS.map((item, index) => <i key={item.target} className={index === step ? "active" : index < step ? "done" : ""} />)}</div>
        <div className="tour-actions">
          {step > 0 && <button type="button" className="tour-back" onClick={() => setStep(step - 1)} data-testid="tour-back-button"><ArrowLeft size={14} /> Back</button>}
          <button type="button" className="tour-next" onClick={() => last ? onClose(true) : setStep(step + 1)} data-testid="tour-next-button">{last ? "Start exploring" : "Next"} <ArrowRight size={14} /></button>
        </div>
      </div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}
