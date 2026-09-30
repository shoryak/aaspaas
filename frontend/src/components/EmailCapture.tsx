import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Mail, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEngagement } from "@/hooks/useEngagement";
import { apiPost } from "@/lib/api";

export function EmailCapture({ location, ideaId, onDismiss }: { location: "recap" | "limit_wall"; ideaId?: string; onDismiss: () => void }) {
  const [email, setEmail] = useState("");
  const { track } = useEngagement();
  useEffect(() => { track({ event_name: "email_prompt_shown", idea_id: ideaId, properties: { capture_location: location } }); }, [ideaId, location]);
  const submit = useMutation({
    mutationFn: () => apiPost<{ recorded: boolean }>("/email-interest", { email, capture_location: location, idea_id: ideaId, consent: true }),
    onSuccess: () => { toast.success("You’re on the Aaspaas updates list."); track({ event_name: "email_submitted", idea_id: ideaId, properties: { capture_location: location } }); onDismiss(); },
    onError: () => toast.error("Please check that email address and try again."),
  });
  return <section className="email-capture" data-testid={`email-capture-${location}`}><button type="button" className="email-dismiss" aria-label="Skip email updates" onClick={() => { track({ event_name: "email_prompt_dismissed", idea_id: ideaId, properties: { capture_location: location } }); onDismiss(); }} data-testid={`email-dismiss-${location}`}><X size={15} /></button><Mail size={19} /><span className="mono-label" data-testid={`email-kicker-${location}`}>GET AASPAAS UPDATES</span><h2 data-testid={`email-title-${location}`}>More field notes, never market noise.</h2><p data-testid={`email-copy-${location}`}>Occasional product and learning updates. No trade calls, broker marketing, or journal access by email.</p><form onSubmit={(event) => { event.preventDefault(); submit.mutate(); }} data-testid={`email-form-${location}`}><Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" aria-label="Email address" data-testid={`email-input-${location}`} /><Button type="submit" disabled={submit.isPending} data-testid={`email-submit-${location}`}>{submit.isPending ? "Saving…" : "Keep me posted"}<ArrowRight size={15} /></Button></form><small data-testid={`email-consent-${location}`}>By submitting, you consent to Aaspaas using this address for product updates. You can request deletion or suppression later.</small></section>;
}