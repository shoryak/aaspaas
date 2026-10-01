import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Mic, X } from "lucide-react";
import { toast } from "sonner";

import { useEngagement } from "@/hooks/useEngagement";
import { useVoiceRecorder, voiceSupported } from "@/hooks/useVoiceRecorder";
import { apiGet } from "@/lib/api";
import type { TranscriptionResponse, VoiceAllowanceResponse } from "@/lib/types";

const clock = (seconds: number) => `0:${String(Math.floor(seconds)).padStart(2, "0")}`;

/** Mic → Whisper → text in the observation box (always editable before submitting). */
export function VoiceInput({ onTranscript }: { onTranscript: (text: string) => void }) {
  const queryClient = useQueryClient();
  const { track } = useEngagement();
  const supported = voiceSupported();
  const allowance = useQuery({ queryKey: ["voice-allowance"], queryFn: () => apiGet<VoiceAllowanceResponse>("/voice/allowance"), enabled: supported, staleTime: 60_000 });
  const maxSeconds = allowance.data?.max_seconds ?? 30;

  const onResult = useCallback((result: TranscriptionResponse) => {
    onTranscript(result.text);
    queryClient.setQueryData<VoiceAllowanceResponse>(["voice-allowance"], (old) => old ? { ...old, remaining: result.remaining } : old);
    track({ event_name: "voice_transcribed", properties: { language: result.language, characters: result.text.length } });
    toast.success("Got it. Edit anything, then follow the clue.");
  }, [onTranscript, queryClient, track]);
  const onError = useCallback((reason: string, message: string) => {
    if (reason === "http_429") queryClient.setQueryData<VoiceAllowanceResponse>(["voice-allowance"], (old) => old ? { ...old, remaining: 0 } : old);
    track({ event_name: "voice_failed", properties: { reason } });
    toast.error(message);
  }, [queryClient, track]);
  const voice = useVoiceRecorder({ maxSeconds, onResult, onError });

  if (!supported) return null;
  const remaining = allowance.data?.remaining;
  const exhausted = remaining === 0;

  if (voice.state === "recording") return <div className="voice-recording" role="status" aria-live="polite" data-testid="voice-recording-panel">
    <span className="voice-live-dot" aria-hidden="true" />
    <div className="voice-bars" aria-hidden="true">{[0.55, 0.85, 1, 0.75, 0.5].map((weight, index) => <i key={index} style={{ transform: `scaleY(${0.18 + voice.level * weight})` }} />)}</div>
    <span className="voice-timer" data-testid="voice-timer">{`${clock(voice.elapsed)} / ${clock(maxSeconds)}`}</span>
    <div className="voice-progress" aria-hidden="true"><i style={{ transform: `scaleX(${Math.min(voice.elapsed / maxSeconds, 1)})` }} /></div>
    <button type="button" className="voice-cancel" onClick={() => { voice.cancel(); track({ event_name: "voice_cancelled" }); }} aria-label="Cancel recording" data-testid="voice-cancel-button"><X size={15} /></button>
    <button type="button" className="voice-stop" onClick={voice.stop} data-testid="voice-stop-button"><Check size={15} /> Done</button>
  </div>;

  if (voice.state === "transcribing") return <div className="voice-transcribing" role="status" aria-live="polite" data-testid="voice-transcribing"><Loader2 size={15} className="spin" /> Writing down what you said…</div>;

  return <div className="voice-row" data-testid="voice-input">
    <button type="button" className="voice-button" disabled={exhausted || voice.state === "requesting"} onClick={() => { track({ event_name: "voice_recording_started" }); void voice.start(); }} data-testid="voice-input-button">
      {voice.state === "requesting" ? <Loader2 size={16} className="spin" /> : <Mic size={16} />}{voice.state === "requesting" ? "Allow the mic…" : "Speak it instead"}
    </button>
    <span className="voice-hint" data-testid="voice-remaining">{exhausted ? "Today's voice notes are used up. Typing still works." : `Hindi, English or Hinglish · up to ${maxSeconds}s${remaining === undefined ? "" : ` · ${remaining} left today`}`}</span>
  </div>;
}
