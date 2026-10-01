import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, apiUpload } from "@/lib/api";
import type { TranscriptionResponse } from "@/lib/types";

export type VoiceState = "idle" | "requesting" | "recording" | "transcribing";
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const EXTENSION: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg" };

export const voiceSupported = () => typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";

export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.body && typeof error.body === "object" && "detail" in error.body) {
    const detail = (error.body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "message" in detail) return String((detail as { message: unknown }).message);
  }
  return fallback;
}

/** Records up to `maxSeconds` from the mic, uploads to /api/transcribe, and hands back the transcript. */
export function useVoiceRecorder({ maxSeconds, onResult, onError }: { maxSeconds: number; onResult: (result: TranscriptionResponse) => void; onError: (reason: string, message: string) => void }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const timer = useRef(0), frame = useRef(0), startedAt = useRef(0);
  const cancelled = useRef(false);

  const release = useCallback(() => {
    window.clearInterval(timer.current);
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    void audioContext.current?.close().catch(() => undefined);
    stream.current = null;
    audioContext.current = null;
    setLevel(0);
  }, []);

  const stop = useCallback(() => { if (recorder.current?.state === "recording") recorder.current.stop(); }, []);
  const cancel = useCallback(() => { cancelled.current = true; stop(); }, [stop]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    setState("requesting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setState("idle");
      onError("permission_denied", "Mic access is blocked. Allow the microphone in your browser settings, or type instead.");
      return;
    }
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const media = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    cancelled.current = false;
    media.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    media.onstop = async () => {
      const duration = Date.now() - startedAt.current;
      release();
      if (cancelled.current) { setState("idle"); return; }
      if (duration < 800) { setState("idle"); onError("too_short", "That was very short. Hold on and speak a full sentence."); return; }
      const type = (media.mimeType || mimeType || "audio/webm").split(";")[0];
      const form = new FormData();
      form.append("audio", new Blob(chunks, { type }), `observation.${EXTENSION[type] ?? "webm"}`);
      form.append("duration_ms", String(Math.min(duration, maxSeconds * 1000)));
      setState("transcribing");
      try { onResult(await apiUpload<TranscriptionResponse>("/transcribe", form)); }
      catch (error) { onError(error instanceof ApiError ? `http_${error.status}` : "network", errorMessage(error, "Transcription is unavailable right now. Please type instead.")); }
      finally { setState("idle"); }
    };
    recorder.current = media;
    media.start(250);
    startedAt.current = Date.now();
    setElapsed(0);
    setState("recording");
    timer.current = window.setInterval(() => {
      const seconds = (Date.now() - startedAt.current) / 1000;
      setElapsed(seconds);
      if (seconds >= maxSeconds) stop();
    }, 200);
    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream.current).connect(analyser);
      audioContext.current = context;
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
        frame.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* level meter is decorative */ }
  }, [state, maxSeconds, onError, onResult, release, stop]);

  useEffect(() => () => { cancelled.current = true; if (recorder.current?.state === "recording") recorder.current.stop(); release(); }, [release]);
  return { state, elapsed, level, start, stop, cancel };
}
