import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { LearnResponse, Lesson, SiteVideos, StudioMetric, TrendingLogResponse } from "@/lib/types";

const BLANK: Lesson = { number: 19, slug: "", module: "m3", title: "", promise: "", key_idea: "", paragraphs: [""], example: "", checks: [""], metric: "", duration: "6 min", youtube_url: "", reel_url: "", published: false, is_tax: false, last_checked: "" };

function LessonEditor({ lesson, onSaved }: { lesson: Lesson; onSaved: () => void }) {
  const [draft, setDraft] = useState(lesson);
  useEffect(() => setDraft(lesson), [lesson.slug]);
  const save = useMutation({ mutationFn: () => apiPut<Lesson>(`/admin/lessons/${draft.slug}`, draft), onSuccess: () => { toast.success("Lesson saved"); onSaved(); }, onError: () => toast.error("Check the slug (lowercase, dashes) and try again.") });
  const field = (key: keyof Lesson, label: string, multiline = false) => <label className="studio-field">{label}{multiline
    ? <Textarea value={Array.isArray(draft[key]) ? (draft[key] as string[]).join("\n\n") : String(draft[key])} onChange={(event) => setDraft({ ...draft, [key]: Array.isArray(draft[key]) ? event.target.value.split(/\n\n+/) : event.target.value })} data-testid={`studio-lesson-${key}`} />
    : <Input value={String(draft[key])} onChange={(event) => setDraft({ ...draft, [key]: key === "number" ? Number(event.target.value) : event.target.value })} data-testid={`studio-lesson-${key}`} />}</label>;
  return <form className="studio-lesson-form" onSubmit={(event) => { event.preventDefault(); save.mutate(); }} data-testid="studio-lesson-editor">
    <div className="studio-field-row">{field("number", "No.")}{field("slug", "Slug")}{field("module", "Module key")}{field("duration", "Length")}</div>
    {field("title", "Title")}{field("promise", "One-line promise")}{field("youtube_url", "YouTube link")}{field("reel_url", "Instagram Reel link")}{field("key_idea", "Key idea")}
    {field("paragraphs", "Notes (blank line between paragraphs)", true)}{field("example", "₹ worked example", true)}{field("checks", "Check-it-yourself list (blank line between items)", true)}
    <div className="studio-field-row">{field("metric", "Live metric key")}{field("last_checked", "Tax last checked")}
      <label className="studio-check"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} data-testid="studio-lesson-published" /> Published</label>
      <label className="studio-check"><input type="checkbox" checked={draft.is_tax} onChange={(event) => setDraft({ ...draft, is_tax: event.target.checked })} /> Tax lesson</label></div>
    <div className="studio-actions"><Button type="submit" disabled={save.isPending || !draft.slug} data-testid="studio-lesson-save">Save lesson</Button>{draft.slug && <a href={`/api/cards/lesson/${draft.slug}.png`} download className="studio-download" data-testid="studio-lesson-instagram"><Download size={13} /> Instagram image</a>}</div>
  </form>;
}

export function StudioContent({ days }: { days: number }) {
  const queryClient = useQueryClient();
  const metrics = useQuery({ queryKey: ["admin-learning", days], queryFn: () => apiGet<StudioMetric[]>(`/admin/learning-summary?days=${days}`) });
  const lessons = useQuery({ queryKey: ["admin-lessons"], queryFn: () => apiGet<LearnResponse>("/admin/lessons") });
  const videos = useQuery({ queryKey: ["site-videos"], queryFn: () => apiGet<SiteVideos>("/site/videos") });
  const trending = useQuery({ queryKey: ["admin-trending"], queryFn: () => apiGet<TrendingLogResponse>("/admin/trending") });
  const [selected, setSelected] = useState<string>("roce");
  const [slots, setSlots] = useState<SiteVideos>({ landing: "", friend: "" });
  useEffect(() => { if (videos.data) setSlots(videos.data); }, [videos.data]);
  const saveVideos = useMutation({ mutationFn: () => apiPut<SiteVideos>("/admin/videos", slots), onSuccess: (data) => { queryClient.setQueryData(["site-videos"], data); toast.success("Video slots saved"); } });
  const hide = useMutation({ mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => apiPost<TrendingLogResponse>(`/admin/trending/clues/${id}/hidden?hidden=${hidden}`), onSuccess: (data) => queryClient.setQueryData(["admin-trending"], data) });
  const regenerate = useMutation({ mutationFn: () => apiPost<TrendingLogResponse>("/admin/trending/regenerate"), onSuccess: (data) => { queryClient.setQueryData(["admin-trending"], data); toast.success("Today's clues regenerated"); } });
  const lesson = selected === "__new" ? BLANK : lessons.data?.lessons.find((item) => item.slug === selected);
  return <>
    <section className="studio-section" data-testid="studio-learning-metrics"><span className="mono-label">LEARNING LOOP</span><h2>Lessons, clues, portfolios, partner</h2><div className="studio-grid">{metrics.data?.map((metric) => <article key={metric.key} className="studio-metric" data-testid={`studio-learning-${metric.key}`}><span>{metric.label}</span><strong>{metric.display}</strong>{metric.hint && <p>{metric.hint}</p>}</article>)}</div></section>
    <section className="studio-section" data-testid="studio-videos"><span className="mono-label">LAUNCH VIDEOS</span><h2>“Watch how Aaspaas works” slots</h2><form className="studio-video-form" onSubmit={(event) => { event.preventDefault(); saveVideos.mutate(); }}><label className="studio-field">Landing page<Input value={slots.landing} onChange={(event) => setSlots({ ...slots, landing: event.target.value })} placeholder="YouTube link" data-testid="studio-video-landing" /></label><label className="studio-field">Friend landing<Input value={slots.friend} onChange={(event) => setSlots({ ...slots, friend: event.target.value })} placeholder="YouTube link" data-testid="studio-video-friend" /></label><Button type="submit" data-testid="studio-video-save">Save slots</Button></form></section>
    <section className="studio-section" data-testid="studio-lessons"><span className="mono-label">LESSONS MANAGER</span><h2>Course book</h2>
      <select className="studio-select" value={selected} onChange={(event) => setSelected(event.target.value)} data-testid="studio-lesson-select">{lessons.data?.lessons.map((item) => <option key={item.slug} value={item.slug} label={`${String(item.number).padStart(2, "0")} · ${item.title}${item.published ? "" : " (hidden)"}${item.youtube_url ? " ▶" : ""}`} />)}<option value="__new" label="+ Add a new lesson" /></select>
      {lesson && <LessonEditor key={selected} lesson={lesson} onSaved={() => { void queryClient.invalidateQueries({ queryKey: ["admin-lessons"] }); void queryClient.invalidateQueries({ queryKey: ["lessons"] }); }} />}
    </section>
    <section className="studio-section" data-testid="studio-trending"><span className="mono-label">TRENDING LOG · {trending.data?.date}</span><h2>Daily clues</h2>
      <Button variant="outline" onClick={() => regenerate.mutate()} disabled={regenerate.isPending} data-testid="studio-trending-regenerate"><RefreshCw size={13} /> {regenerate.isPending ? "Regenerating (≈1 min)…" : "Regenerate today"}</Button>
      <div className="studio-clues">{trending.data?.clues.map((clue) => <article key={clue.id} className={clue.hidden ? "studio-clue is-hidden" : "studio-clue"} data-testid={`studio-clue-${clue.id}`}><p>“{clue.observation}”</p><small>{clue.source} · {clue.tickers.join(", ")}</small><div><button type="button" onClick={() => hide.mutate({ id: clue.id, hidden: !clue.hidden })} data-testid={`studio-clue-hide-${clue.id}`}><EyeOff size={12} /> {clue.hidden ? "Show" : "Hide"}</button><a href={`/api/cards/clue/${clue.id}.png`} download data-testid={`studio-clue-instagram-${clue.id}`}><Download size={12} /> Instagram image</a></div></article>)}</div>
      <table className="studio-log" data-testid="studio-trending-log"><tbody>{trending.data?.items.map((item, index) => <tr key={`${item.title}-${index}`} className={item.picked ? "picked" : ""}><td>{item.source}</td><td>{item.title}</td><td>{item.picked ? "picked" : item.reason || "skipped"}</td></tr>)}</tbody></table>
    </section>
  </>;
}
