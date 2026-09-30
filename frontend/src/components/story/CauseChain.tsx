import { ArrowDown, ArrowRight, Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompanyInsight } from "@/lib/types";

export function CauseChain({ company, onContinue }: { company: CompanyInsight; onContinue: () => void }) {
  const steps = [
    ["You noticed", `“${company.observation_phrase}”`, "observation"],
    ["Behaviour changed", company.behavior_change, "interpretation"],
    ["The company gets paid when", company.revenue_driver, "company fact"],
    ["Profit can change if", company.profit_sensitivity, "interpretation"],
    ["The stock reacts to expectations about", company.market_expectation, "market lens"],
  ];
  return <section className="story-beat chain-beat" data-testid={`cause-chain-${company.ticker.toLowerCase()}`}>
    <div className="beat-heading">
      <div><span className="story-kicker" data-testid="chain-kicker">YOUR CLUE, FOLLOWED</span><h1 data-testid="chain-company-name">{company.company_name}</h1></div>
      <Badge className={`strength-badge strength-${company.connection_strength}`} data-testid="connection-strength-badge">{company.connection_strength} connection</Badge>
    </div>
    <div className="cause-chain" data-testid="cause-chain-steps">
      {steps.map(([label, copy, source], index) => <div className="chain-link" key={label} data-testid={`cause-chain-step-${index + 1}`}>
        <div className="chain-number" data-testid={`cause-chain-step-${index + 1}-number`}>0{index + 1}</div>
        <div><span className="mono-label" data-testid={`cause-chain-step-${index + 1}-label`}>{label}</span><p data-testid={`cause-chain-step-${index + 1}-copy`}>{copy}</p><small data-testid={`cause-chain-step-${index + 1}-source`}>{source}</small></div>
        {index < steps.length - 1 && <span className="chain-arrow" aria-hidden="true"><ArrowRight className="desktop-arrow" size={15} /><ArrowDown className="mobile-arrow" size={15} /></span>}
      </div>)}
    </div>
    <div className="chain-prompts" data-testid="chain-teaching-prompts"><p data-testid="what-must-be-true"><strong>What has to be true?</strong>{company.what_must_be_true}</p><p data-testid="what-breaks-chain"><strong>What could break the chain?</strong>{company.what_breaks_chain}</p></div>
    <Button className="story-cta" onClick={onContinue} data-testid="chain-continue-button">See what the market did <Link2 size={16} /></Button>
  </section>;
}