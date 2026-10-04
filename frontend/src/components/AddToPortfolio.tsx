import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PENDING_KEY, useAccount } from "@/components/AccountProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useEngagement } from "@/hooks/useEngagement";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { inr } from "@/lib/learn";
import { slug } from "@/lib/performance";
import type { CompanyRef, Portfolio, PortfolioList } from "@/lib/types";

export const portfoliosQuery = { queryKey: ["portfolios"] as const, queryFn: () => apiGet<PortfolioList>("/portfolios"), retry: false };

function detailOf(error: unknown): { code?: string; message?: string } | string | null {
  return error instanceof ApiError && typeof error.body === "object" && error.body && "detail" in error.body ? (error.body as { detail: { code?: string; message?: string } | string }).detail : null;
}

export function PlusWaitlist({ onJoined }: { onJoined?: () => void }) {
  const { track } = useEngagement();
  const join = useMutation({ mutationFn: () => apiPost<{ recorded: boolean }>("/product-interest", { kind: "plus" }), onSuccess: () => { track({ event_name: "plus_from_portfolio_limit" }); toast.success("You're on the Plus waitlist. Nothing is charged."); onJoined?.(); } });
  return <div className="plus-limit" data-testid="plus-limit"><Sparkles size={18} /><strong>More portfolios come with Aaspaas Plus (coming soon).</strong><p>Free accounts hold 3 practice portfolios. Deleting one frees a slot.</p><Button type="button" onClick={() => join.mutate()} disabled={join.isSuccess} data-testid="plus-waitlist-button">{join.isSuccess ? "On the waitlist" : "Join the Plus waitlist"}</Button></div>;
}

export function AddToPortfolioDialog({ company, onClose }: { company: CompanyRef; onClose: () => void }) {
  const queryClient = useQueryClient();
  const list = useQuery(portfoliosQuery);
  const [target, setTarget] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [amount, setAmount] = useState("10000");
  const [note, setNote] = useState("");
  const [changeMind, setChangeMind] = useState("");
  const [checkBack, setCheckBack] = useState("");
  const [limitHit, setLimitHit] = useState(false);
  const portfolios = list.data?.portfolios ?? [];
  useEffect(() => { if (!target && portfolios.length) setTarget(portfolios[0].id); }, [portfolios.length]);
  const creating = target === "" || target === "new";
  const add = useMutation({
    mutationFn: async () => {
      const id = creating ? (await apiPost<Portfolio>("/portfolios", { name: newName.trim() || "My practice portfolio" })).id : target;
      return apiPost<Portfolio>(`/portfolios/${id}/buy`, { ticker: company.ticker, exchange: company.exchange, company_name: company.company_name, sector: company.sector ?? "Unclassified", amount: Number(amount), note, change_mind: changeMind, check_back: checkBack || null });
    },
    onSuccess: (portfolio) => { void queryClient.invalidateQueries({ queryKey: ["portfolios"] }); queryClient.setQueryData(["portfolio", portfolio.id], portfolio); toast.success(`Added ${company.company_name} to “${portfolio.name}” with pretend money.`, { action: { label: "Open", onClick: () => { window.location.href = `/portfolio?id=${portfolio.id}`; } } }); onClose(); },
    onError: (error) => { const detail = detailOf(error); if (detail && typeof detail === "object" && detail.code === "plus_limit") setLimitHit(true); else toast.error(typeof detail === "string" ? detail : "Couldn't add it right now."); },
  });
  const cash = portfolios.find((item) => item.id === target)?.cash ?? 100000;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="add-sheet" data-testid="add-portfolio-dialog">
      <span className="mono-label practice-stamp">PRACTICE · PRETEND MONEY · NO REAL TRADES</span>
      <DialogTitle className="signin-title" data-testid="add-portfolio-title">Add {company.company_name}</DialogTitle>
      <DialogDescription className="signin-copy">Bought at the latest available adjusted close (delayed). Your reason stays with the holding.</DialogDescription>
      {limitHit ? <PlusWaitlist onJoined={onClose} /> : <form className="add-form" onSubmit={(event) => { event.preventDefault(); add.mutate(); }}>
        <label>Portfolio<select value={target || "new"} onChange={(event) => setTarget(event.target.value)} data-testid="add-portfolio-select">{portfolios.map((item) => <option key={item.id} value={item.id} label={`${item.name} · ${inr(item.cash)} cash`} />)}<option value="new" label="+ New practice portfolio" /></select></label>
        {creating && <label>Name it<Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Kirana staples" maxLength={40} data-testid="add-portfolio-new-name" /></label>}
        <label>Pretend amount (₹)<Input type="number" min={1} max={cash} step="any" required value={amount} onChange={(event) => setAmount(event.target.value)} data-testid="add-portfolio-amount" /><small>{inr(cash)} pretend cash available</small></label>
        <label>Why I’m adding this<Input required minLength={3} maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. every kirana near me stocks it" data-testid="add-portfolio-note" /></label>
        <label>What would change my mind <small>optional</small><Input maxLength={200} value={changeMind} onChange={(event) => setChangeMind(event.target.value)} data-testid="add-portfolio-change-mind" /></label>
        <label>Check back on <small>optional</small><Input type="date" value={checkBack} onChange={(event) => setCheckBack(event.target.value)} data-testid="add-portfolio-check-back" /></label>
        <Button type="submit" size="lg" disabled={add.isPending || note.trim().length < 3} data-testid="add-portfolio-submit">{add.isPending ? "Adding…" : "Add with pretend money"}</Button>
        <p className="signin-fineprint">Aaspaas never suggests holdings or amounts, and never places real orders.</p>
      </form>}
    </DialogContent>
  </Dialog>;
}

export function AddToPortfolioButton({ company, testId, compact = false }: { company: CompanyRef; testId: string; compact?: boolean }) {
  const { requireSignIn } = useAccount();
  const [open, setOpen] = useState(false);
  const start = () => {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(company));
    requireSignIn({ location: "portfolio", onDone: () => { sessionStorage.removeItem(PENDING_KEY); setOpen(true); } });
  };
  return <>
    <button type="button" className={compact ? "add-portfolio-chip" : "add-portfolio-button"} onClick={start} data-testid={testId}><BriefcaseBusiness size={13} />{compact ? "Practice" : "Add to practice portfolio"}</button>
    {open && <AddToPortfolioDialog company={company} onClose={() => setOpen(false)} />}
  </>;
}

/** After an email-link sign-in redirect, reopen the add dialog for the company the reader was adding. */
export function PendingAdd() {
  const { account } = useAccount();
  const [company, setCompany] = useState<CompanyRef | null>(null);
  useEffect(() => {
    if (!account?.signed_in) return;
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (raw) { sessionStorage.removeItem(PENDING_KEY); setCompany(JSON.parse(raw) as CompanyRef); }
  }, [account?.signed_in]);
  return company ? <AddToPortfolioDialog company={company} onClose={() => setCompany(null)} /> : null;
}

export const testIdFor = (prefix: string, ticker: string) => `${prefix}-${slug(ticker)}`;
