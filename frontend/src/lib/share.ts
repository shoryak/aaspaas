import { useQuery } from "@tanstack/react-query";

import { apiBlob, apiGet } from "@/lib/api";
import type { PeriodKey } from "@/lib/performance";

export interface ShareImageOptions { period: PeriodKey; benchmark: boolean; hidden: string[] }

export type ShareChannel = "whatsapp" | "x" | "copy" | "native" | "download";

/** Every shared link carries the sharer's anonymous token + channel so Studio can trace the viral loop. */
export const shareLink = (ideaId: string, period: PeriodKey, token: string | undefined, channel: ShareChannel) =>
  `${window.location.origin}/api/share/${ideaId}?period=${period}&ch=${channel}${token ? `&ref=${token}` : ""}`;

export function useShareToken() {
  return useQuery({ queryKey: ["share-token"], queryFn: () => apiGet<{ token: string }>("/share-token"), staleTime: Infinity, retry: 1 });
}

const imagePath = (ideaId: string, { period, benchmark, hidden }: ShareImageOptions) =>
  `/share/${ideaId}/image.png?period=${period}&benchmark=${benchmark}&hidden=${encodeURIComponent(hidden.join(","))}`;

/** Prefetches the server-rendered card so the share sheet can open inside the click gesture. */
export function useShareImage(ideaId: string, options: ShareImageOptions) {
  return useQuery({
    queryKey: ["share-image", ideaId, options.period, options.benchmark, options.hidden.join(",")],
    queryFn: () => apiBlob(imagePath(ideaId, options)),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

export async function shareOrDownload({ blob, title, text, url }: { blob?: Blob; title: string; text: string; url: string }): Promise<ShareOutcome> {
  const file = blob ? new File([blob], "aaspaas-chart.png", { type: "image/png" }) : null;
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text: `${text}\n${url}` });
      return "shared";
    }
    if (!file && navigator.share) {
      await navigator.share({ title, text, url });
      return "shared";
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "cancelled";
  }
  if (file) {
    const href = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "aaspaas-chart.png";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1500);
  }
  await navigator.clipboard?.writeText(url).catch(() => undefined);
  return "downloaded";
}
