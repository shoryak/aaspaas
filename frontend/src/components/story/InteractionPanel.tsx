import { ArrowRight, HelpCircle } from "lucide-react";

import type { AnswerRecord, CompanyInsight, QuestionFormat } from "@/lib/types";

function peBucket(value: number) {
  if (value < 20) return "Below 20×";
  if (value <= 40) return "20× to 40×";
  return "Above 40×";
}

export function InteractionPanel({ company, index, onComplete }: { company: CompanyInsight; index: number; onComplete: (record: AnswerRecord, metricDistance?: number) => void }) {
  let format: QuestionFormat = index % 3 === 0 ? "moat" : index % 3 === 1 ? "business_model" : "metric_guess";
  if (format === "metric_guess" && company.finance.pe_ratio === null) format = "moat";
  const question = format === "moat" ? company.gut_check_question : format === "business_model" ? company.revenue_question : `Without calculating: where would you place ${company.ticker}'s current P/E?`;
  const options = format === "moat" ? ["Yes — it may have room", "No — customers can switch"] : format === "business_model" ? company.revenue_options : ["Below 20×", "20× to 40×", "Above 40×"];
  const expected = format === "moat" ? (company.gut_check_lean === "yes" ? options[0] : options[1]) : format === "business_model" ? company.revenue_answer : peBucket(company.finance.pe_ratio!);
  const answer = (option: string) => {
    const matched = option === expected;
    const distance = format === "metric_guess" ? Math.abs(options.indexOf(option) - options.indexOf(expected)) : undefined;
    onComplete({ matched, skipped: false, format, answer: option }, distance);
  };
  return <section className="story-beat interaction-beat" data-testid={`interaction-${company.ticker.toLowerCase()}`}>
    <span className="story-kicker" data-testid="question-format-label">ONE LIGHT READ · {format.replace("_", " ")}</span>
    <h1 data-testid="interaction-question">{question}</h1>
    <p className="interaction-preface" data-testid="interaction-preface"><HelpCircle size={15} /> Start with what you can reasonably infer. This is not an investing verdict.</p>
    <div className="choice-stack" data-testid="interaction-options">{options.map((option, optionIndex) => <button type="button" className="choice-card" onClick={() => answer(option)} key={option} data-testid={`interaction-option-${optionIndex + 1}`}><span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong><ArrowRight size={16} /></button>)}</div>
    <button type="button" className="skip-link" onClick={() => onComplete({ matched: null, skipped: true, format, answer: null })} data-testid="interaction-skip-button">Skip this and keep learning <ArrowRight size={14} /></button>
  </section>;
}