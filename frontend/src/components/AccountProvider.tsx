import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useEngagement } from "@/hooks/useEngagement";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { AccountResponse, SignInRequested } from "@/lib/types";

type Location = "portfolio" | "learn" | "header";
interface SignInOptions { location?: Location; returnTo?: string; updatesDefault?: boolean; heading?: string; onDone?: () => void }
interface AccountContext { account: AccountResponse | undefined; requireSignIn: (options?: SignInOptions) => void; signOut: () => void }

const Ctx = createContext<AccountContext | null>(null);
export const PENDING_KEY = "aaspaas-pending-action";

export function useAccount() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAccount outside AccountProvider");
  return value;
}

function errorText(error: unknown, fallback: string) {
  if (error instanceof ApiError && typeof error.body === "object" && error.body && "detail" in error.body) {
    const detail = (error.body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

function SignInDialog({ options, onClose }: { options: SignInOptions; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { track } = useEngagement();
  const [email, setEmail] = useState("");
  const [updates, setUpdates] = useState(Boolean(options.updatesDefault));
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const request = useMutation({
    mutationFn: () => apiPost<SignInRequested>("/auth/request", { email, updates, location: options.location ?? "portfolio", return_to: options.returnTo ?? `${window.location.pathname}${window.location.search}` }),
    onSuccess: (result) => { setSentTo(result.email); track({ event_name: "signin_email_entered", properties: { location: options.location, updates } }); },
    onError: (error) => toast.error(errorText(error, "We couldn't send the sign-in email. Try again shortly.")),
  });
  const verify = useMutation({
    mutationFn: () => apiPost<AccountResponse>("/auth/verify-code", { email: sentTo, code }),
    onSuccess: async (result) => { queryClient.setQueryData(["account"], result); await queryClient.invalidateQueries(); toast.success("Signed in. Your practice portfolios now follow you to any device."); onClose(); options.onDone?.(); },
    onError: (error) => toast.error(errorText(error, "That code didn't match.")),
  });
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="signin-sheet" data-testid="signin-sheet">
      {!sentTo ? <form onSubmit={(event) => { event.preventDefault(); request.mutate(); }}>
        <span className="mono-label signin-kicker">PRACTICE PORTFOLIOS · PRETEND MONEY</span>
        <DialogTitle className="signin-title" data-testid="signin-title">{options.heading ?? "Save your practice portfolios and open them on any device"}</DialogTitle>
        <DialogDescription className="signin-copy">We’ll email you a one-tap sign-in link and a 6-digit code. No password.</DialogDescription>
        <Input type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="signin-input" data-testid="signin-email-input" />
        <label className="signin-consent" data-testid="signin-updates-label"><Checkbox checked={updates} onCheckedChange={(checked) => setUpdates(Boolean(checked))} data-testid="signin-updates-checkbox" /><span>Also email me new lessons and Aaspaas updates</span></label>
        <p className="signin-fineprint">We only use this to sign you in, and to send updates if you tick the box.</p>
        <Button type="submit" size="lg" disabled={request.isPending} className="signin-submit" data-testid="signin-submit-button">{request.isPending ? "Sending…" : "Email me a sign-in link"} <ArrowRight size={16} /></Button>
      </form> : <form onSubmit={(event) => { event.preventDefault(); verify.mutate(); }}>
        <MailCheck size={26} className="signin-mail-icon" />
        <DialogTitle className="signin-title" data-testid="signin-check-title">Check your inbox</DialogTitle>
        <DialogDescription className="signin-copy">We sent a link and a code to <strong>{sentTo}</strong>. Tap the link, or type the 6-digit code here. It expires in 15 minutes.</DialogDescription>
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" placeholder="••••••" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="signin-code" data-testid="signin-code-input" />
        <Button type="submit" size="lg" disabled={code.length !== 6 || verify.isPending} className="signin-submit" data-testid="signin-verify-button">{verify.isPending ? "Checking…" : "Sign in"}</Button>
        <button type="button" className="signin-resend" onClick={() => { setSentTo(null); setCode(""); }} data-testid="signin-use-other-email">Use a different email</button>
      </form>}
    </DialogContent>
  </Dialog>;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { track } = useEngagement();
  const account = useQuery({ queryKey: ["account"], queryFn: () => apiGet<AccountResponse>("/auth/me"), staleTime: 60 * 1000 });
  const [options, setOptions] = useState<SignInOptions | null>(null);
  const requireSignIn = useCallback((next: SignInOptions = {}) => {
    if (account.data?.signed_in) { next.onDone?.(); return; }
    setOptions(next);
    track({ event_name: "signin_sheet_shown", properties: { location: next.location ?? "portfolio" } });
  }, [account.data?.signed_in, track]);
  const signOut = useCallback(() => { void apiPost<AccountResponse>("/auth/logout").then(async () => { queryClient.setQueryData(["account"], { signed_in: false, email: null, updates_opt_in: false }); await queryClient.invalidateQueries(); toast.success("Signed out on this device."); }); }, [queryClient]);
  return <Ctx.Provider value={{ account: account.data, requireSignIn, signOut }}>{children}{options && <SignInDialog options={options} onClose={() => setOptions(null)} />}</Ctx.Provider>;
}
