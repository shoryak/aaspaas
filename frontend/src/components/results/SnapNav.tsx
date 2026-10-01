import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

interface Panel { label: string; el: HTMLElement }

/**
 * Mobile-only discrete navigation for the results page. Panels are elements marked `data-snap-panel="Label"`;
 * CSS turns on firm scroll-snap at phone widths only, and this renders side progress dots plus a "next" chevron.
 */
export function SnapNav({ layoutKey }: { layoutKey: string }) {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("snap-results");
    return () => root.classList.remove("snap-results");
  }, []);
  useEffect(() => {
    setPanels([...document.querySelectorAll<HTMLElement>("[data-snap-panel]")].map((el) => ({ label: el.dataset.snapPanel ?? "", el })));
  }, [layoutKey]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mark = window.innerHeight * .45;
        let index = 0;
        panels.forEach((panel, i) => { if (panel.el.getBoundingClientRect().top <= mark) index = i; });
        setActive(index);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [panels]);

  const go = (index: number) => panels[index]?.el.scrollIntoView({ behavior: "smooth", block: "start" });
  const next = panels[active + 1];
  if (panels.length < 2) return null;
  return <nav className="snap-nav" aria-label="Result sections" data-testid="snap-nav">
    <ol className="snap-dots" data-testid="snap-dots">{panels.map((panel, index) => <li key={`${panel.label}-${index}`}>
      <button type="button" className={index === active ? "active" : index < active ? "done" : ""} aria-label={`Go to ${panel.label}`} aria-current={index === active ? "step" : undefined} onClick={() => go(index)} data-testid={`snap-dot-${index}`}>
        <span className="snap-dot-label">{panel.label}</span><i />
      </button>
    </li>)}</ol>
    {next && <button type="button" key={active} className="snap-next" onClick={() => go(active + 1)} aria-label={`Next: ${next.label}`} data-testid="snap-next-button"><span data-testid="snap-next-label">{next.label}</span><ChevronDown size={17} /></button>}
  </nav>;
}
