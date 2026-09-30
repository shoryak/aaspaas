import hashlib
import os
import uuid
from datetime import datetime, timezone

from fastapi import Request, Response

SESSION_COOKIE = "aaspaas_session"


def ensure_session(request: Request, response: Response) -> str:
    session_id = request.cookies.get(SESSION_COOKIE)
    if session_id:
        return session_id
    session_id = str(uuid.uuid4())
    response.set_cookie(
        SESSION_COOKIE,
        session_id,
        httponly=True,
        samesite="lax",
        secure=os.environ.get("APP_URL", "").startswith("https://"),
        max_age=31536000,
    )
    return session_id


def daily_ip_fingerprint(request: Request, day: str) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")
    salt = os.environ.get("ADMIN_PASSWORD", "aaspaas")
    return hashlib.sha256(f"{day}:{ip}:{salt}".encode()).hexdigest()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)