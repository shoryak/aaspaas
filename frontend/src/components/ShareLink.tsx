import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

/** Lightweight share row for lesson/clue pages: WhatsApp, X and copy link. */
export function ShareMenuLink({ path, text, testId }: { path: string; text: string; testId: string }) {
  const url = `${window.location.origin}${path}`;
  return <div className="share-link-row" data-testid={testId}>
    <span><Share2 size={13} /> Share</span>
    <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}?src=whatsapp`)}`} target="_blank" rel="noreferrer" data-testid={`${testId}-whatsapp`}>WhatsApp</a>
    <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${url}?src=x`)}`} target="_blank" rel="noreferrer" data-testid={`${testId}-x`}>X</a>
    <button type="button" onClick={() => { void navigator.clipboard?.writeText(`${url}?src=copy`); toast.success("Link copied"); }} data-testid={`${testId}-copy`}><Copy size={12} /> Copy link</button>
  </div>;
}
