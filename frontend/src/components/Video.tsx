import { useState } from "react";
import { Play, PlayCircle, X } from "lucide-react";

import { youtubeId } from "@/lib/learn";

/** Thumbnail first; the YouTube player loads only on tap. */
export function YouTubeEmbed({ url, title, onPlay, testId }: { url: string; title: string; onPlay?: () => void; testId: string }) {
  const id = youtubeId(url);
  const [playing, setPlaying] = useState(false);
  if (!id) return <div className="video-soon" data-testid={`${testId}-soon`}><PlayCircle size={26} /><strong>Video coming soon</strong><span>The written notes below cover the full lesson.</span></div>;
  return <div className="video-frame" data-testid={testId}>{playing
    ? <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
    : <button type="button" className="video-thumb" onClick={() => { setPlaying(true); onPlay?.(); }} style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` }} aria-label={`Play ${title}`} data-testid={`${testId}-play`}><span><Play size={22} /></span></button>}</div>;
}

export function VideoOverlay({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return <div className="video-overlay" role="dialog" aria-label={title} data-testid="video-overlay" onClick={onClose}>
    <div className="video-overlay-card" onClick={(event) => event.stopPropagation()}>
      <div className="video-overlay-top"><span className="mono-label">{title}</span><button type="button" onClick={onClose} aria-label="Close video" data-testid="video-overlay-close"><X size={16} /></button></div>
      <YouTubeEmbed url={url} title={title} testId="video-overlay-player" />
    </div>
  </div>;
}

export function LessonLink({ slug, number, label = "Watch the lesson", testId, newTab = false }: { slug: string; number: number; label?: string; testId: string; newTab?: boolean }) {
  return <a href={`/learn/${slug}`} className="lesson-link" target={newTab ? "_blank" : undefined} rel={newTab ? "noreferrer" : undefined} data-testid={testId}><PlayCircle size={12} />{label} · {String(number).padStart(2, "0")}</a>;
}
