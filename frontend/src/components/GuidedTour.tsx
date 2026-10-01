import { useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, SkipForward, X } from "lucide-react";

export interface TourStep { target: string; kicker: string; title: string; copy: string }
/** A "try it" task completes when the visitor clicks anything matching `selector`; `glow` marks where to look. */
export interface TourTask { label: string; hint: string; selector: string; glow?: string }

const PAD = 10;
const EASE = [0.22, 1, 0.36, 1] as const;

function ExplainCards({ steps, onFinish, onClose }: { steps: TourStep[]; onFinish: () => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  useLayoutEffect(() => {
    const element = document.querySelector<HTMLElement>(`[data-testid="${steps[step].target}"]`);
    if (!element) return;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => { setRect(element.getBoundingClientRect()); setViewport({ w: window.innerWidth, h: window.innerHeight }); };
    update();
    const settle = window.setTimeout(update, 500);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.clearTimeout(settle); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [step, steps]);
  const next = () => step === steps.length - 1 ? onFinish() : setStep(step + 1);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") setStep((value) => Math.max(value - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const current = steps[step];
  const mobile = viewport.w < 700;
  const cardWidth = Math.min(400, viewport.w - 32);
  const below = rect ? viewport.h - rect.bottom > 290 : true;
  const cardStyle = mobile || !rect
    ? { left: 16, right: 16, bottom: 16 }
    : { width: cardWidth, left: Math.min(Math.max(rect.left, 16), viewport.w - cardWidth - 16), top: below ? rect.bottom + PAD + 14 : Math.max(rect.top - PAD - 14 - 270, 16) };
  return <>
    <div className="tour-backdrop" onClick={onClose} />
    {rect && <div className="tour-spotlight" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} data-testid="tour-spotlight" />}
    <motion.div className="tour-card" style={cardStyle} layout transition={{ layout: { duration: .45, ease: EASE } }} role="dialog" aria-modal="true" aria-labelledby="tour-title" data-testid="tour-card">
      <button type="button" className="tour-skip" onClick={onClose} data-testid="tour-skip-button">Skip tour <X size={13} /></button>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: .28, ease: EASE }}>
          <span className="tour-kicker" data-testid="tour-step-kicker">{current.kicker}</span>
          <h3 id="tour-title" data-testid="tour-step-title">{current.title}</h3>
          <p data-testid="tour-step-copy">{current.copy}</p>
        </motion.div>
      </AnimatePresence>
      <div className="tour-footer">
        <div className="tour-dots" aria-hidden="true">{steps.map((item, index) => <i key={item.target} className={index === step ? "active" : index < step ? "done" : ""} />)}</div>
        <div className="tour-actions">
          {step > 0 && <button type="button" className="tour-back" onClick={() => setStep(step - 1)} data-testid="tour-back-button"><ArrowLeft size={15} /> Back</button>}
          <button type="button" className="tour-next" onClick={next} data-testid="tour-next-button">{step === steps.length - 1 ? "Now try it" : "Next"} <ArrowRight size={15} /></button>
        </div>
      </div>
    </motion.div>
  </>;
}

function TaskPill({ tasks, onDone, onClose }: { tasks: TourTask[]; onDone: (completed: number) => void; onClose: (completed: number) => void }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const current = tasks.findIndex((_, index) => !done.has(index) && !skipped.has(index));
  const finished = current === -1;

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element || element.closest(".tour-pill")) return;
      tasks.forEach((task, index) => { if (element.closest(task.selector)) setDone((previous) => new Set(previous).add(index)); });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [tasks]);
  useEffect(() => {
    if (!finished) return;
    const timer = window.setTimeout(() => onDone(done.size), 1600);
    return () => window.clearTimeout(timer);
  }, [finished, done.size, onDone]);
  useEffect(() => {
    if (finished) return;
    const selector = tasks[current].glow ?? tasks[current].selector;
    let target: Element | null = null, tries = 0;
    const find = () => {
      target = document.querySelector(selector);
      if (target) { target.classList.add("tour-glow"); target.scrollIntoView({ block: "center", behavior: "smooth" }); }
      else if (tries++ < 20) timer = window.setTimeout(find, 500);
    };
    let timer = window.setTimeout(find, 250);
    return () => { window.clearTimeout(timer); (target as Element | null)?.classList.remove("tour-glow"); };
  }, [current, finished, tasks]);
  useEffect(() => {
    document.documentElement.classList.add("tour-tasks-active");
    return () => document.documentElement.classList.remove("tour-tasks-active");
  }, []);

  return <motion.div className="tour-pill" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: .4, ease: EASE }} role="status" aria-live="polite" data-testid="tour-task-pill">
    <div className="tour-pill-ticks" aria-hidden="true">{tasks.map((task, index) => <i key={task.label} className={done.has(index) ? "done" : skipped.has(index) ? "skipped" : index === current ? "active" : ""}>{done.has(index) && <Check size={9} strokeWidth={3} />}</i>)}</div>
    <AnimatePresence mode="wait">
      <motion.div key={finished ? "done" : current} className="tour-pill-body" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .25, ease: EASE }}>
        {finished
          ? <><span className="tour-pill-count" data-testid="tour-task-count">{`${done.size} of ${tasks.length} done`}</span><strong data-testid="tour-task-label">You’ve got it. Explore freely.</strong></>
          : <><span className="tour-pill-count" data-testid="tour-task-count">{`TRY IT · ${current + 1} of ${tasks.length}`}</span><strong data-testid="tour-task-label">{tasks[current].label}</strong><span className="tour-pill-hint" data-testid="tour-task-hint">{tasks[current].hint}</span></>}
      </motion.div>
    </AnimatePresence>
    {!finished && <div className="tour-pill-actions">
      <button type="button" onClick={() => setSkipped((previous) => new Set(previous).add(current))} aria-label="Skip this step" data-testid="tour-task-skip"><SkipForward size={15} /></button>
      <button type="button" onClick={() => onClose(done.size)} aria-label="End tour" data-testid="tour-task-close"><X size={15} /></button>
    </div>}
  </motion.div>;
}

/** Explain cards (spotlight) followed by hands-on tasks the visitor completes on the real page. */
export function GuidedTour({ open, steps, tasks, onClose }: { open: boolean; steps: TourStep[]; tasks: TourTask[]; onClose: (outcome: { completed: boolean; tasksDone: number }) => void }) {
  const [phase, setPhase] = useState<"explain" | "tasks">("explain");
  useEffect(() => { if (open) setPhase("explain"); }, [open]);
  return <AnimatePresence>{open && (phase === "explain"
    ? <motion.div key="explain" className="tour-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .3 }} data-testid="landing-tour">
        <ExplainCards steps={steps} onClose={() => onClose({ completed: false, tasksDone: 0 })} onFinish={() => tasks.length ? setPhase("tasks") : onClose({ completed: true, tasksDone: 0 })} />
      </motion.div>
    : <TaskPill key="tasks" tasks={tasks} onDone={(count) => onClose({ completed: true, tasksDone: count })} onClose={(count) => onClose({ completed: false, tasksDone: count })} />)}</AnimatePresence>;
}
