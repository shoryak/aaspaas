import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInput } from "@/components/VoiceInput";

export type InputMode = "typed" | "voice";

export const EXAMPLES = [
  "Every wedding I've been to this year used the same online invite website",
  "The same quick-commerce bags are showing up in every apartment lobby",
  "I keep seeing solar panels appear on factory rooftops near me",
];

/** The one observation box, shared by the landing page and the friend landing page. */
export function ObservationForm({ value, onChange, onSubmit, submitLabel = "Follow the clue", placeholder = "I keep noticing…" }: {
  value: string; onChange: (value: string) => void; onSubmit: (value: string, mode: InputMode) => void; submitLabel?: string; placeholder?: string;
}) {
  const [mode, setMode] = useState<InputMode>("typed");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const base = useRef("");
  const withBase = (text: string) => [base.current, text].filter(Boolean).join(" ");
  const addTranscript = (text: string) => {
    onChange(withBase(text));
    setMode("voice");
    window.setTimeout(() => textarea.current?.focus(), 50);
  };
  return <form onSubmit={(event) => { event.preventDefault(); if (value.trim().length < 8) toast.error("Give us one useful sentence."); else onSubmit(value.trim(), mode); }} data-testid="observation-form">
    <label htmlFor="observation" className="mono-label" data-testid="observation-label">YOUR OBSERVATION</label>
    <Textarea id="observation" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="observation-input" ref={textarea} data-testid="observation-textarea" />
    <VoiceInput onStart={() => { base.current = value.trim(); }} onLive={(text) => onChange(withBase(text))} onTranscript={addTranscript} />
    <div className="example-wrap" data-testid="example-chips"><span className="micro-label" data-testid="example-label">Try an example</span>{EXAMPLES.map((example, index) => <button key={example} type="button" className="example-chip" onClick={() => onChange(example)} data-testid={`example-chip-${index + 1}`}>{example}</button>)}</div>
    <Button type="submit" size="lg" className="discover-button" data-testid="discover-submit-button">{submitLabel} <ArrowRight size={18} /></Button>
    <p className="allowance-note" data-testid="daily-allowance-note">Three AI-powered discoveries per UTC day. Reading and sharing stay open.</p>
  </form>;
}
