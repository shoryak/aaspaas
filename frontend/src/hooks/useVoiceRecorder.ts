import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, apiPost, apiUpload } from "@/lib/api";
import type { TranscriptionResponse, VoicePassResponse } from "@/lib/types";

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

interface LiveFinal { text: string; remaining: number }

/** Opens a Deepgram live stream through the backend proxy (single-use pass). Resolves null when live is unavailable. */
async function openLiveSocket(): Promise<WebSocket | null> {
  let pass: VoicePassResponse;
  try { pass = await apiPost<VoicePassResponse>("/voice/session"); }
  catch (error) { if (error instanceof ApiError && error.status === 429) throw error; return null; }
  const socket = new WebSocket(`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/voice/stream?token=${encodeURIComponent(pass.token)}`);
  const ready = await new Promise<boolean>((resolve) => {
    const timeout = window.setTimeout(() => resolve(false), 5000);
    socket.onmessage = (event) => { const message = JSON.parse(String(event.data)); window.clearTimeout(timeout); resolve(message.type === "ready"); };
    socket.onerror = () => { window.clearTimeout(timeout); resolve(false); };
  });
  if (!ready) { socket.close(); return null; }
  return socket;
}

/**
 * Records up to `maxSeconds` from the mic. With `live`, audio streams to Deepgram Nova-3 and words arrive while speaking;
 * otherwise (or if live fails) the same locally recorded clip is uploaded to Whisper.
 */
export function useVoiceRecorder({ maxSeconds, live, onPartial, onResult, onError }: { maxSeconds: number; live: boolean; onPartial: (finalText: string) => void; onResult: (result: TranscriptionResponse) => void; onError: (reason: string, message: string) => void }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const [streaming, setStreaming] = useState(false);
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
    let socket: WebSocket | null = null;
    if (live) {
      try { socket = await openLiveSocket(); }
      catch (error) { stream.current?.getTracks().forEach((track) => track.stop()); setState("idle"); onError("http_429", errorMessage(error, "Today's voice notes are used up.")); return; }
    }
    let liveFailed = !socket;
    let finalWaiter: ((value: LiveFinal | null) => void) | null = null;
    if (socket) {
      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === "partial") { onPartial(message.final); setInterim(message.interim); }
        else if (message.type === "final") finalWaiter?.({ text: message.text, remaining: message.remaining });
        else if (message.type === "error") liveFailed = true;
      };
      socket.onclose = () => finalWaiter?.(null);
    }
    setStreaming(Boolean(socket));
    setInterim("");
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const media = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    cancelled.current = false;
    media.ondataavailable = (event) => {
      if (!event.data.size) return;
      chunks.push(event.data);
      if (socket?.readyState === WebSocket.OPEN && !liveFailed) socket.send(event.data);
    };
    media.onstop = async () => {
      const duration = Date.now() - startedAt.current;
      release();
      setInterim("");
      setStreaming(false);
      if (cancelled.current) { socket?.close(); setState("idle"); return; }
      if (socket && !liveFailed && socket.readyState === WebSocket.OPEN) {
        setState("transcribing");
        const finished = await new Promise<LiveFinal | null>((resolve) => { finalWaiter = resolve; socket.send(JSON.stringify({ type: "close" })); window.setTimeout(() => resolve(null), 6000); });
        socket.close();
        if (finished?.text) { onResult({ text: finished.text, language: null, remaining: finished.remaining }); setState("idle"); return; }
        if (finished && duration >= 800) { onError("silent", "We couldn't make out any words. Try again in a quieter spot."); setState("idle"); return; }
        // live stream dropped without a result: fall back to Whisper with the locally recorded clip
      }
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
  }, [state, maxSeconds, live, onPartial, onError, onResult, release, stop]);

  useEffect(() => () => { cancelled.current = true; if (recorder.current?.state === "recording") recorder.current.stop(); release(); }, [release]);
  return { state, elapsed, level, interim, streaming, start, stop, cancel };
}
