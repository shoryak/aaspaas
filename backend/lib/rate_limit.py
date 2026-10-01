"""Per-IP sliding-window throttle for /api traffic.

In-process (per worker): a cheap first line against scripted spam and metric inflation. Limits are
deliberately generous because Indian mobile carriers put many real users behind one CGNAT address.
"""
import os
import time
from collections import defaultdict, deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

WINDOW_SECONDS = 60
LIMITS = {
    "image": int(os.environ.get("RATE_LIMIT_IMAGE_PER_MIN", "60")),
    "write": int(os.environ.get("RATE_LIMIT_WRITE_PER_MIN", "240")),
    "read": int(os.environ.get("RATE_LIMIT_READ_PER_MIN", "900")),
}


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def _bucket(request: Request) -> str | None:
    path = request.url.path
    if not path.startswith("/api") or request.method == "OPTIONS":
        return None
    if path.endswith("/image.png"):
        return "image"
    return "write" if request.method in ("POST", "PUT", "PATCH", "DELETE") else "read"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.hits: dict[tuple[str, str], deque] = defaultdict(deque)
        self.calls = 0

    async def dispatch(self, request: Request, call_next):
        bucket = _bucket(request)
        if bucket is None:
            return await call_next(request)
        now = time.monotonic()
        key = (bucket, client_ip(request))
        window = self.hits[key]
        while window and now - window[0] > WINDOW_SECONDS:
            window.popleft()
        if len(window) >= LIMITS[bucket]:
            retry = max(1, int(WINDOW_SECONDS - (now - window[0])) + 1)
            return JSONResponse({"detail": "Too many requests. Please slow down."}, status_code=429, headers={"Retry-After": str(retry)})
        window.append(now)
        self.calls += 1
        if self.calls % 5000 == 0:  # drop idle keys so memory stays flat
            for stale in [k for k, v in self.hits.items() if not v or now - v[-1] > WINDOW_SECONDS]:
                self.hits.pop(stale, None)
        return await call_next(request)
