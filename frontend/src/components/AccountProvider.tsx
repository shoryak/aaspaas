import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
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
const GOOGLE_UPDATES_KEY = "aaspaas-google-updates";

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

function startGoogle(updates: boolean) {
  sessionStorage.setItem(GOOGLE_UPDATES_KEY, updates ? "1" : "0");
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + window.location.pathname + window.location.search;
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

function GoogleMark() {
  return <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>;
}

function SignInDialog({ options, onClose }: { options: SignInOptions; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { track } = useEngagement();
  const [mode, setMode] = useState<"signin" | "create" | "link">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [updates, setUpdates] = useState(Boolean(options.updatesDefault));
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const done = async (result: AccountResponse, method: string) => {
    queryClient.setQueryData(["account"], result);
    await queryClient.invalidateQueries();
    track({ event_name: "signin_method_used", properties: { method } });
    toast.success("Signed in. Your practice portfolios now follow you to any device.");
    onClose();
    options.onDone?.();
  };
  const passwordAuth = useMutation({
    mutationFn: () => apiPost<AccountResponse>(mode === "create" ? "/auth/register" : "/auth/login", { email, password, updates }),
    onSuccess: (result) => done(result, mode === "create" ? "password_signup" : "password"),
    onError: (error) => toast.error(errorText(error, "That didn't work. Try again.")),
  });
  const request = useMutation({
    mutationFn: () => apiPost<SignInRequested>("/auth/request", { email, updates, location: options.location ?? "portfolio", return_to: options.returnTo ?? `${window.location.pathname}${window.location.search}` }),
    onSuccess: (result) => { setSentTo(result.email); track({ event_name: "signin_email_entered", properties: { location: options.location, updates } }); },
    onError: (error) => toast.error(errorText(error, "We couldn't send the sign-in email. Try again shortly.")),
  });
  const verify = useMutation({
    mutationFn: () => apiPost<AccountResponse>("/auth/verify-code", { email: sentTo, code }),
    onSuccess: (result) => done(result, "code"),
    onError: (error) => toast.error(errorText(error, "That code didn't match.")),
  });
  const consent = <label className="signin-consent" data-testid="signin-updates-label"><Checkbox checked={updates} onCheckedChange={(checked) => setUpdates(Boolean(checked))} data-testid="signin-updates-checkbox" /><span>Also email me new lessons and Aaspaas updates</span></label>;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="signin-sheet" data-testid="signin-sheet">
      {sentTo ? <form onSubmit={(event) => { event.preventDefault(); verify.mutate(); }}>
        <MailCheck size={26} className="signin-mail-icon" />
        <DialogTitle className="signin-title" data-testid="signin-check-title">Check your inbox</DialogTitle>
        <DialogDescription className="signin-copy">We sent a link and a code to <strong>{sentTo}</strong>. Tap the link, or type the 6-digit code here. It expires in 15 minutes.</DialogDescription>
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" placeholder="••••••" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="signin-code" data-testid="signin-code-input" />
        <Button type="submit" size="lg" disabled={code.length !== 6 || verify.isPending} className="signin-submit" data-testid="signin-verify-button">{verify.isPending ? "Checking…" : "Sign in"}</Button>
        <button type="button" className="signin-resend" onClick={() => { setSentTo(null); setCode(""); }} data-testid="signin-use-other-email">Use a different email</button>
      </form> : <>
        <span className="mono-label signin-kicker">PRACTICE PORTFOLIOS · PRETEND MONEY</span>
        <DialogTitle className="signin-title" data-testid="signin-title">{options.heading ?? "Save your practice portfolios and open them on any device"}</DialogTitle>
        <DialogDescription className="signin-copy">Pick whichever is easiest. Everything else in Aaspaas stays open without an account.</DialogDescription>
        <Button type="button" variant="outline" size="lg" className="signin-google" onClick={() => { track({ event_name: "signin_google_started" }); startGoogle(updates); }} data-testid="signin-google-button"><GoogleMark /> Continue with Google</Button>
        <div className="signin-divider"><span>or with email</span></div>
        <div className="signin-tabs" role="tablist">
          {([["signin", "Sign in"], ["create", "Create account"], ["link", "Email me a code"]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={mode === key} className={mode === key ? "active" : ""} onClick={() => setMode(key)} data-testid={`signin-mode-${key}`}>{label}</button>)}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (mode === "link") request.mutate(); else passwordAuth.mutate(); }}>
          <Input type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="signin-input" data-testid="signin-email-input" />
          {mode !== "link" && <Input type="password" required minLength={8} autoComplete={mode === "create" ? "new-password" : "current-password"} placeholder={mode === "create" ? "Choose a password (8+ characters)" : "Password"} value={password} onChange={(event) => setPassword(event.target.value)} className="signin-input" data-testid="signin-password-input" />}
          {consent}
          <p className="signin-fineprint">{mode === "link" ? "No password: we email a one-tap link and a 6-digit code. " : ""}We only use your email to sign you in, and to send updates if you tick the box.</p>
          <Button type="submit" size="lg" disabled={passwordAuth.isPending || request.isPending} className="signin-submit" data-testid="signin-submit-button">{mode === "link" ? (request.isPending ? "Sending…" : "Email me a sign-in link") : mode === "create" ? (passwordAuth.isPending ? "Creating…" : "Create account") : (passwordAuth.isPending ? "Signing in…" : "Sign in")} <ArrowRight size={16} /></Button>
        </form>
      </>}
    </DialogContent>
  </Dialog>;
}

/** Handles the return from Google: exchanges the one-time session_id, then clears the fragment. */
export function GoogleCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const processed = useRef(false);
  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const sessionId = new URLSearchParams(location.hash.replace(/^#/, "")).get("session_id") ?? "";
    const updates = sessionStorage.getItem(GOOGLE_UPDATES_KEY) === "1";
    sessionStorage.removeItem(GOOGLE_UPDATES_KEY);
    apiPost<AccountResponse>("/auth/google", { session_id: sessionId, updates })
      .then(async (result) => { queryClient.setQueryData(["account"], result); await queryClient.invalidateQueries(); toast.success("Signed in with Google."); })
      .catch((error) => toast.error(errorText(error, "Google sign-in didn't complete. Please try again.")))
      .finally(() => navigate(`${location.pathname}${location.search}`, { replace: true }));
  }, []);
  return <main className="paper-page" data-testid="google-callback" />;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { track } = useEngagement();
  // Skip /auth/me while returning from Google — GoogleCallback establishes the session first.
  const account = useQuery({ queryKey: ["account"], queryFn: () => apiGet<AccountResponse>("/auth/me"), staleTime: 60 * 1000, enabled: !location.hash.includes("session_id=") });
  const [options, setOptions] = useState<SignInOptions | null>(null);
  const requireSignIn = useCallback((next: SignInOptions = {}) => {
    if (account.data?.signed_in) { next.onDone?.(); return; }
    setOptions(next);
    track({ event_name: "signin_sheet_shown", properties: { location: next.location ?? "portfolio" } });
  }, [account.data?.signed_in, track]);
  const signOut = useCallback(() => { void apiPost<AccountResponse>("/auth/logout").then(async () => { queryClient.setQueryData(["account"], { signed_in: false, email: null, updates_opt_in: false }); await queryClient.invalidateQueries(); toast.success("Signed out on this device."); }); }, [queryClient]);
  return <Ctx.Provider value={{ account: account.data, requireSignIn, signOut }}>{children}{options && <SignInDialog options={options} onClose={() => setOptions(null)} />}</Ctx.Provider>;
}
