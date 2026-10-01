import io
import logging
import os
import uuid

from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile

from emergentintegrations.llm.openai import OpenAISpeechToText
from lib.dates import today_iso
from lib.db import db
from lib.session import daily_ip_fingerprint, ensure_session, utc_now
from models.aaspaas import TranscriptionResponse, VoiceAllowanceResponse

router = APIRouter(tags=["voice"])
logger = logging.getLogger(__name__)

STT_DAILY_LIMIT = int(os.environ.get("STT_DAILY_LIMIT", "5"))  # per anonymous visitor
STT_IP_DAILY_LIMIT = int(os.environ.get("STT_IP_DAILY_LIMIT", "60"))  # per network (mobile CGNAT friendly)
STT_GLOBAL_DAILY_CAP = int(os.environ.get("STT_GLOBAL_DAILY_CAP", "3000"))
STT_MAX_SECONDS = int(os.environ.get("STT_MAX_SECONDS", "30"))
MAX_BYTES = 2 * 1024 * 1024  # 30s of opus/aac is far below this
WHISPER_USD_PER_MIN = 0.006
EXTENSIONS = {"audio/webm": "webm", "audio/mp4": "mp4", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg"}
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
    return VoiceAllowanceResponse(remaining=max(STT_DAILY_LIMIT - used, 0), daily_limit=STT_DAILY_LIMIT, max_seconds=STT_MAX_SECONDS)


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(request: Request, response: Response, audio: UploadFile = File(...), duration_ms: int = Form(0, ge=0)):
    session_id = ensure_session(request, response)
    day, fingerprint, used, ip_used = await _usage(request, session_id)
    if used >= STT_DAILY_LIMIT or ip_used >= STT_IP_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail={"message": f"Today's {STT_DAILY_LIMIT} voice notes are used up. You can still type your observation.", "remaining": 0})
    if await db.transcriptions.count_documents({"day": day}) >= STT_GLOBAL_DAILY_CAP:
        raise HTTPException(status_code=503, detail={"message": "Voice input is busy today. Please type your observation instead.", "remaining": max(STT_DAILY_LIMIT - used, 0)})
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
        "language": language, "seconds": round(seconds, 2), "bytes": len(data), "format": extension,
        "characters": len(text), "cost_usd": round(seconds / 60 * WHISPER_USD_PER_MIN, 6), "created_at": utc_now(),
    })
    return TranscriptionResponse(text=text, language=language, remaining=max(STT_DAILY_LIMIT - used - 1, 0))
