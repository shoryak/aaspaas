import { ChevronDown, Download, Link2, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEngagement } from "@/hooks/useEngagement";
import { apiPost } from "@/lib/api";
import type { PeriodKey } from "@/lib/performance";
import { shareLink, shareOrDownload, useShareImage, useShareToken } from "@/lib/share";
import type { ShareChannel } from "@/lib/share";

const XIcon = () => <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23 22h-6.1l-4.8-6.3L6.6 22H3.5l7.3-8.3L1 2h6.2l4.3 5.7L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" /></svg>;

/** One share entry point: channel-tagged links for WhatsApp/X/copy, or the chart image via the native sheet. */
export function ShareMenu({ ideaId, observation, period, benchmark = false, hidden = [], surface, label, variant = "default", disabled, testId }: {
  ideaId: string; observation: string; period: PeriodKey; benchmark?: boolean; hidden?: string[]; surface: "chart" | "recap";
  label: string; variant?: "default" | "outline"; disabled?: boolean; testId: string;
}) {
  const token = useShareToken();
  const image = useShareImage(ideaId, { period, benchmark, hidden });
  const { track } = useEngagement();
  const text = `“${observation}” — I traced this everyday clue to listed Indian companies on Aaspaas. Educational, not advice.`;
  const record = (channel: ShareChannel) => {
    void apiPost<{ recorded: boolean }>("/shares", { idea_id: ideaId, surface, channel }).catch(() => undefined);
    track({ event_name: "share_channel_selected", idea_id: ideaId, properties: { surface, channel, period, benchmark, hidden: hidden.length } });
  };
  const url = (channel: ShareChannel) => shareLink(ideaId, period, token.data?.token, channel);

  const openWindow = (channel: "whatsapp" | "x") => {
    const link = url(channel);
    const target = channel === "whatsapp"
      ? `https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`
      : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
    window.open(target, "_blank", "noopener,noreferrer");
    record(channel);
  };
  const copy = async () => {
    await navigator.clipboard?.writeText(url("copy")).catch(() => undefined);
    record("copy");
    toast.success("Link copied. It shows the chart preview when pasted.");
  };
  const shareImage = async () => {
    const outcome = await shareOrDownload({ blob: image.data, title: "Aaspaas · how these stocks travelled", text, url: url("native") });
    if (outcome === "cancelled") return;
    record(outcome === "shared" ? "native" : "download");
    toast.success(outcome === "shared" ? "Shared." : "Chart image downloaded and link copied.");
  };

  return <DropdownMenu>
    <DropdownMenuTrigger disabled={disabled} render={<Button type="button" variant={variant} className="share-menu-trigger" data-testid={testId} />}>
      <Share2 size={15} />{label}<ChevronDown size={14} className="share-menu-chevron" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={6} className="share-menu-content w-60" data-testid={`${testId}-menu`}>
      <DropdownMenuGroup>
      <DropdownMenuLabel className="share-menu-label">Share with the chart preview</DropdownMenuLabel>
      <DropdownMenuItem onClick={() => openWindow("whatsapp")} data-testid={`${testId}-whatsapp`}><MessageCircle size={15} /> WhatsApp</DropdownMenuItem>
      <DropdownMenuItem onClick={() => openWindow("x")} data-testid={`${testId}-x`}><XIcon /> Post on X</DropdownMenuItem>
      <DropdownMenuItem onClick={() => void copy()} data-testid={`${testId}-copy`}><Link2 size={15} /> Copy link</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => void shareImage()} data-testid={`${testId}-image`}><Download size={15} /> Share or save image</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
