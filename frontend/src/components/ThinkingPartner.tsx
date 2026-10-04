import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageCircleQuestion, Send } from "lucide-react";
import { toast } from "sonner";

import { LessonLink } from "@/components/Video";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiPost } from "@/lib/api";
import type { CompanyRef, PartnerConversation, PartnerReply } from "@/lib/types";

const LESSON_NUMBERS: Record<string, number> = { "revenue-vs-profit": 1, margins: 2, "cash-flow": 3, "balance-sheet": 4, roce: 5, roe: 6, debt: 7, moat: 8, management: 9, "quality-of-growth": 10, sip: 13, "tax-on-shares": 15 };

function ReplyBlock({ reply, index }: { reply: PartnerReply; index: number }) {
  const parts: [string, string[]][] = [["Supported by the numbers", reply.supported], ["Still an assumption", reply.assumptions], ["Possible bias", reply.biases.map((bias) => `${bias.name}: ${bias.why}`)], ["Questions to answer next", [...reply.questions, ...(reply.evidence_to_change ? [`What would change the view: ${reply.evidence_to_change}`] : [])]]];
  return <div className="partner-reply" data-testid={`partner-reply-${index}`}>
    {reply.advice_redirected && <p className="partner-redirect" data-testid="partner-redirect-note">I can’t tell you whether to buy or sell — that’s your call. Here’s a checklist to make it yours.</p>}
    {parts.filter(([, items]) => items.length).map(([title, items]) => <section key={title}><span>{title}</span><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}
    {reply.lesson_slug && LESSON_NUMBERS[reply.lesson_slug] && <LessonLink slug={reply.lesson_slug} number={LESSON_NUMBERS[reply.lesson_slug]} label="Related lesson" testId={`partner-lesson-${index}`} newTab />}
    <small>AI context · educational reasoning help, not financial advice</small>
  </div>;
}

export function ThinkingPartnerButton({ company, surface, testId, label = "Challenge my thinking", initial = "" }: { company: CompanyRef; surface: "detail" | "holding" | "recap"; testId: string; label?: string; initial?: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(initial);
  const [conversation, setConversation] = useState<PartnerConversation | null>(null);
  const send = useMutation({
    mutationFn: () => apiPost<PartnerConversation>("/partner/messages", { conversation_id: conversation?.id ?? null, idea_id: company.idea_id ?? null, ticker: company.ticker, exchange: company.exchange, company_name: company.company_name, surface, message }),
    onSuccess: (result) => { setConversation(result); setMessage(""); },
    onError: (error) => { const detail = error instanceof ApiError && typeof error.body === "object" && error.body && "detail" in error.body ? (error.body as { detail: { message?: string } | string }).detail : null; toast.message(typeof detail === "string" ? detail : detail?.message ?? "The thinking partner is unavailable right now."); },
  });
  const userTurns = conversation?.turns.filter((turn) => turn.role === "user").length ?? 0;
  const done = conversation ? userTurns >= conversation.max_turns || conversation.remaining_today === 0 : false;
  return <>
    <button type="button" className="partner-button" onClick={() => setOpen(true)} data-testid={testId}><MessageCircleQuestion size={14} />{label}</button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="partner-sheet" data-testid="partner-sheet">
        <span className="mono-label partner-kicker">AI THINKING PARTNER · NOT AN ADVISER</span>
        <SheetTitle className="partner-title">Test your reasoning on {company.company_name}</SheetTitle>
        <SheetDescription className="partner-copy">Write your view. The partner separates what the sourced numbers support from what you’re assuming, and names any bias. It never says buy, sell or hold.</SheetDescription>
        <div className="partner-thread" data-testid="partner-thread">{conversation?.turns.map((turn, index) => turn.role === "user" ? <p className="partner-user" key={index} data-testid={`partner-user-${index}`}>{turn.text}</p> : turn.reply && <ReplyBlock key={index} reply={turn.reply} index={index} />)}{send.isPending && <p className="partner-thinking" data-testid="partner-thinking">Reading the sourced numbers…</p>}</div>
        {done ? <p className="partner-limit" data-testid="partner-limit">{conversation?.remaining_today === 0 ? "That’s today’s 10 messages — come back tomorrow." : "This conversation reached 6 turns. Close and start a fresh one."}</p>
          : <form className="partner-form" onSubmit={(event) => { event.preventDefault(); if (message.trim().length >= 3) send.mutate(); }}>
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={600} placeholder={conversation ? "Reply to the partner…" : `e.g. ${company.company_name} will keep growing because every shop near me stocks it`} data-testid="partner-input" />
            <Button type="submit" disabled={send.isPending || message.trim().length < 3} data-testid="partner-send-button"><Send size={14} /> {conversation ? "Reply" : "Challenge it"}</Button>
            {conversation && <small data-testid="partner-remaining">{conversation.remaining_today} messages left today · turn {userTurns}/{conversation.max_turns}</small>}
          </form>}
      </SheetContent>
    </Sheet>
  </>;
}
