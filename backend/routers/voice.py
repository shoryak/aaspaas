import asyncio
import io
import json
import logging
import os
import secrets
import time
import uuid
from datetime import timedelta
from urllib.parse import urlencode

import websockets
from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile, WebSocket, WebSocketDisconnect

from emergentintegrations.llm.openai import OpenAISpeechToText
from lib.dates import today_iso
from lib.db import db
from lib.session import daily_ip_fingerprint, ensure_session, utc_now
from lib.session import SESSION_COOKIE
from models.aaspaas import TranscriptionResponse, VoiceAllowanceResponse, VoicePassResponse

router = APIRouter(tags=["voice"])
logger = logging.getLogger(__name__)

STT_DAILY_LIMIT = int(os.environ.get("STT_DAILY_LIMIT", "5"))  # per anonymous visitor
STT_IP_DAILY_LIMIT = int(os.environ.get("STT_IP_DAILY_LIMIT", "60"))  # per network (mobile CGNAT friendly)
STT_GLOBAL_DAILY_CAP = int(os.environ.get("STT_GLOBAL_DAILY_CAP", "3000"))
STT_MAX_SECONDS = int(os.environ.get("STT_MAX_SECONDS", "30"))
MAX_BYTES = 2 * 1024 * 1024  # 30s of opus/aac is far below this
WHISPER_USD_PER_MIN = 0.006
EXTENSIONS = {"audio/webm": "webm", "audio/mp4": "mp4", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg"}
DEEPGRAM_USD_PER_MIN = float(os.environ.get("DEEPGRAM_USD_PER_MIN", "0.0092"))
DEEPGRAM_QUERY = urlencode({"model": "nova-3", "language": "multi", "interim_results": "true", "smart_format": "true", "punctuate": "true", "endpointing": "300"})
PASS_TTL = timedelta(seconds=60)
PROMPT = "An everyday observation from India about shops, apps, brands, habits or services. It may mix Hindi and English."


async def _usage(request: Request, session_id: str) -> tuple[str, str, int, int]:
    day = today_iso("UTC")
    fingerprint = daily_ip_fingerprint(request, day)
    session_used = await db.transcriptions.count_documents({"day": day, "session_id": session_id})
    ip_used = await db.transcriptions.count_documents({"day": day, "ip_fingerprint": fingerprint})
    return day, fingerprint, session_used, ip_used


@router.get("/voice/allowance", response_model=VoiceAllowanceResponse)
async def voice_allowance(request: Request, response: Response):
    session_id = ensure_session(request, response)
    _, _, used, _ = await _usage(request, session_id)
    return VoiceAllowanceResponse(remaining=max(STT_DAILY_LIMIT - used, 0), daily_limit=STT_DAILY_LIMIT, max_seconds=STT_MAX_SECONDS, live=bool(os.environ.get("DEEPGRAM_API_KEY")))


async def _check_allowance(request: Request, session_id: str) -> tuple[str, str, int]:
    day, fingerprint, used, ip_used = await _usage(request, session_id)
    if used >= STT_DAILY_LIMIT or ip_used >= STT_IP_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail={"message": f"Today's {STT_DAILY_LIMIT} voice notes are used up. You can still type your observation.", "remaining": 0})
    if await db.transcriptions.count_documents({"day": day}) >= STT_GLOBAL_DAILY_CAP:
        raise HTTPException(status_code=503, detail={"message": "Voice input is busy today. Please type your observation instead.", "remaining": max(STT_DAILY_LIMIT - used, 0)})
    return day, fingerprint, used


@router.post("/voice/session", response_model=VoicePassResponse)
async def voice_session(request: Request, response: Response):
    """Issues a short-lived, single-use pass for one live Deepgram stream, after the allowance check."""
    session_id = ensure_session(request, response)
    if not os.environ.get("DEEPGRAM_API_KEY"):
        raise HTTPException(status_code=503, detail={"code": "live_unavailable", "message": "Live voice is not configured."})
    day, fingerprint, used = await _check_allowance(request, session_id)
    token = secrets.token_urlsafe(24)
    await db.voice_passes.insert_one({"token": token, "session_id": session_id, "ip_fingerprint": fingerprint, "day": day, "used": False, "expires_at": utc_now() + PASS_TTL, "remaining_before": STT_DAILY_LIMIT - used})
    return VoicePassResponse(token=token, max_seconds=STT_MAX_SECONDS)


@router.websocket("/voice/stream")
async def voice_stream(websocket: WebSocket, token: str = ""):
    """Browser mic chunks (webm/opus or mp4) → Deepgram Nova-3 live → {partial|final} JSON back to the browser."""
    await websocket.accept()
    voice_pass = await db.voice_passes.find_one_and_update(
        {"token": token, "used": False, "expires_at": {"$gt": utc_now()}}, {"$set": {"used": True}}
    )
    if not voice_pass or voice_pass["session_id"] != websocket.cookies.get(SESSION_COOKIE, voice_pass and voice_pass["session_id"]):
        await websocket.send_json({"type": "error", "code": "invalid_pass"})
        await websocket.close(code=1008)
        return
    finals: list[str] = []
    started: float | None = None
    try:
        async with websockets.connect(
            f"{os.environ.get('DEEPGRAM_LISTEN_URL', 'wss://api.deepgram.com/v1/listen')}?{DEEPGRAM_QUERY}",
            additional_headers={"Authorization": f"Token {os.environ['DEEPGRAM_API_KEY']}"}, open_timeout=6, max_size=4 * 1024 * 1024,
        ) as deepgram:
            await websocket.send_json({"type": "ready"})

            async def browser_to_deepgram():
                nonlocal started
                while True:
                    message = await websocket.receive()
                    if message.get("type") == "websocket.disconnect":
                        break
                    if message.get("bytes"):
                        started = started or time.monotonic()
                        if time.monotonic() - started > STT_MAX_SECONDS + 1:
                            break
                        await deepgram.send(message["bytes"])
                    elif message.get("text") and json.loads(message["text"]).get("type") == "close":
                        break
                await deepgram.send(json.dumps({"type": "CloseStream"}))

            async def deepgram_to_browser():
                async for raw in deepgram:
                    data = json.loads(raw)
                    if data.get("type") != "Results":
                        continue
                    text = ((data.get("channel") or {}).get("alternatives") or [{}])[0].get("transcript", "")
                    if data.get("is_final") and text:
                        finals.append(text)
                    await websocket.send_json({"type": "partial", "final": " ".join(finals), "interim": "" if data.get("is_final") else text})

            sender = asyncio.create_task(browser_to_deepgram())
            await asyncio.wait_for(deepgram_to_browser(), timeout=STT_MAX_SECONDS + 15)
            sender.cancel()
    except WebSocketDisconnect:
        return
    except Exception as exc:
        logger.warning("Deepgram live stream failed: %s", exc)
        if not finals:
            await websocket.send_json({"type": "error", "code": "upstream"})
            await websocket.close(code=1011)
            return
    text = " ".join(" ".join(finals).split())
    seconds = min(time.monotonic() - started, STT_MAX_SECONDS) if started else 0
    remaining = max(voice_pass["remaining_before"] - (1 if text else 0), 0)
    if text:  # failed or silent attempts never count against the allowance
        await db.transcriptions.insert_one({
            "id": str(uuid.uuid4()), "day": voice_pass["day"], "session_id": voice_pass["session_id"], "ip_fingerprint": voice_pass["ip_fingerprint"],
            "engine": "deepgram", "language": "multi", "seconds": round(seconds, 2), "characters": len(text),
            "cost_usd": round(seconds / 60 * DEEPGRAM_USD_PER_MIN, 6), "created_at": utc_now(),
        })
    await websocket.send_json({"type": "final", "text": text, "remaining": remaining})
    await websocket.close()


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(request: Request, response: Response, audio: UploadFile = File(...), duration_ms: int = Form(0, ge=0)):
    session_id = ensure_session(request, response)
    day, fingerprint, used = await _check_allowance(request, session_id)
    content_type = (audio.content_type or "").split(";")[0].strip().lower()
    extension = EXTENSIONS.get(content_type)
    if not extension:
        raise HTTPException(status_code=415, detail="Unsupported audio format.")
    if duration_ms > (STT_MAX_SECONDS + 1) * 1000:
        raise HTTPException(status_code=413, detail=f"Voice notes can be up to {STT_MAX_SECONDS} seconds.")
    data = await audio.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="That recording is too large.")
    if len(data) < 1500:
        raise HTTPException(status_code=422, detail="We couldn't hear anything. Try again a little closer to the mic.")

    buffer = io.BytesIO(data)
    buffer.name = f"observation.{extension}"
    try:
        stt = OpenAISpeechToText(api_key=os.environ["EMERGENT_LLM_KEY"])
        result = await stt.transcribe(file=buffer, model="whisper-1", response_format="verbose_json", prompt=PROMPT, temperature=0)
    except Exception as exc:
        logger.warning("Whisper transcription failed for %s: %s", session_id, exc)
        raise HTTPException(status_code=502, detail="Transcription is unavailable right now. Please type your observation.") from exc
    text = " ".join((getattr(result, "text", "") or "").split())
    if not text:
        raise HTTPException(status_code=422, detail="We couldn't make out any words. Try again in a quieter spot.")
    language = getattr(result, "language", None)
    seconds = duration_ms / 1000 if duration_ms else float(getattr(result, "duration", 0) or 0)
    await db.transcriptions.insert_one({
        "id": str(uuid.uuid4()), "day": day, "session_id": session_id, "ip_fingerprint": fingerprint,
        "engine": "whisper", "language": language, "seconds": round(seconds, 2), "bytes": len(data), "format": extension,
        "characters": len(text), "cost_usd": round(seconds / 60 * WHISPER_USD_PER_MIN, 6), "created_at": utc_now(),
    })
    return TranscriptionResponse(text=text, language=language, remaining=max(STT_DAILY_LIMIT - used - 1, 0))
