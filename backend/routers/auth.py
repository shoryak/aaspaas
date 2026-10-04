import hashlib
import logging
import os
import secrets
import uuid
from datetime import timedelta
from html import escape
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse

from lib.accounts import ACCOUNT_COOKIE, ACCOUNT_TTL, current_account, token_hash
from lib.db import db
from lib.rate_limit import client_ip
from lib.session import SESSION_COOKIE, ensure_session, utc_now
from models.learning import AccountResponse, CodeVerify, GoogleSession, PasswordAuth, SignInRequest, SignInRequested

router = APIRouter(tags=["auth"])
logger = logging.getLogger(__name__)
LINK_TTL = timedelta(minutes=15)
MAX_CODE_ATTEMPTS = 5


def _secure() -> bool:
    return os.environ.get("APP_URL", "").startswith("https://")


def _safe_path(path: str) -> str:
    return path if path.startswith("/") and not path.startswith("//") and "\\" not in path else "/"


def _base_url(request: Request) -> str:
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", request.url.netloc)
    return f"{'https' if scheme == 'https' or _secure() else scheme}://{host}"


def _hash(kind: str, value: str) -> str:
    return hashlib.sha256(f"aaspaas-signin:{kind}:{value}".encode()).hexdigest()


def _email_html(link: str, code: str) -> str:
    return (
        '<table role="presentation" width="100%" style="background:#f4f2ec"><tr><td style="padding:28px;font-family:Georgia,serif;color:#1b1a16">'
        '<p style="font-size:26px;margin:0 0 14px">Aaspaas<span style="color:#b8752a">.</span></p>'
        '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">Tap the button to sign in and open your practice portfolios on this device. The link works once and expires in 15 minutes.</p>'
        f'<p><a href="{escape(link)}" style="background:#b8752a;color:#fffaf1;padding:12px 20px;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;display:inline-block">Sign in to Aaspaas</a></p>'
        '<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">If your mail app opened a different browser, type this code in the Aaspaas tab where you started:</p>'
        f'<p style="font-family:Courier,monospace;font-size:30px;letter-spacing:8px;margin:6px 0 18px">{escape(code)}</p>'
        '<p style="font-family:Arial,sans-serif;font-size:12px;color:#6e6b63">Sent by Aaspaas because someone asked to sign in with this address. If it wasn\'t you, ignore this email. '
        'Aaspaas never asks you to send a password or code back. Educational product · no trades · pretend money only.</p></td></tr></table>'
    )


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"


def _password_ok(password: str, stored: str | None) -> bool:
    if not stored or not stored.startswith("scrypt$"):
        return False
    _, salt, _digest = stored.split("$")
    return secrets.compare_digest(_hash_password(password, bytes.fromhex(salt)), stored)


async def _complete_sign_in(request: Request, response: Response, *, email: str, method: str, updates: bool = False, location: str | None = None, request_id: str | None = None, password_hash: str | None = None) -> dict:
    now = utc_now()
    session_id = ensure_session(request, response)
    account = await db.accounts.find_one({"email": email})
    if not account:
        account = {"id": str(uuid.uuid4()), "email": email, "primary_session_id": session_id, "created_at": now, "updates_opt_in": False, "updates_consented_at": None,
                   "password_hash": password_hash, "email_verified": method != "password"}
        await db.accounts.insert_one(dict(account))
    elif method != "password" and not account.get("email_verified"):
        # The inbox owner just proved ownership: drop any password set by an unverified sign-up and revoke its devices.
        await db.accounts.update_one({"id": account["id"]}, {"$set": {"email_verified": True, "password_hash": None}})
        await db.account_tokens.delete_many({"account_id": account["id"]})
    if updates and not account.get("updates_opt_in"):
        await db.accounts.update_one({"id": account["id"]}, {"$set": {"updates_opt_in": True, "updates_consented_at": now, "updates_consent_location": location}})
    primary = account["primary_session_id"]
    if session_id != primary:  # join this browser's anonymous history to the account
        for collection in ("ideas", "partner_chats", "lesson_progress"):
            await db[collection].update_many({"session_id": session_id}, {"$set": {"session_id": primary}})
        await db.sessions.update_one({"id": session_id}, {"$set": {"merged_into": primary}})
    token = secrets.token_urlsafe(32)
    await db.account_tokens.insert_one({"token_hash": token_hash(token), "account_id": account["id"], "created_at": now, "expires_at": now + ACCOUNT_TTL, "method": method})
    if request_id:
        await db.signin_requests.update_one({"id": request_id}, {"$set": {"used_at": now, "method": method}})
    await db.engagement_events.insert_one({"id": str(uuid.uuid4()), "event_name": "signin_completed", "session_id": primary, "properties": {"method": method, "updates": updates}, "created_at": now})
    response.set_cookie(SESSION_COOKIE, primary, httponly=True, samesite="lax", secure=_secure(), max_age=31536000)
    response.set_cookie(ACCOUNT_COOKIE, token, httponly=True, samesite="lax", secure=_secure(), max_age=int(ACCOUNT_TTL.total_seconds()))
    return await db.accounts.find_one({"id": account["id"]}, {"_id": 0})


def _account_response(account: dict) -> AccountResponse:
    return AccountResponse(signed_in=True, email=account["email"], updates_opt_in=bool(account.get("updates_opt_in")))


async def _guard_failures(email: str, request: Request) -> None:
    hour_ago = utc_now() - timedelta(hours=1)
    if await db.login_failures.count_documents({"email": email, "created_at": {"$gte": hour_ago}}) >= 10 or await db.login_failures.count_documents({"ip_hash": _hash("ip", client_ip(request)), "created_at": {"$gte": hour_ago}}) >= 30:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in an hour, or use the email code.")


@router.post("/auth/register", response_model=AccountResponse)
async def register(payload: PasswordAuth, request: Request, response: Response):
    email = payload.email.strip().lower()
    await _guard_failures(email, request)
    existing = await db.accounts.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="This email already has an account. Sign in instead — or use Google or the email code if you never set a password.")
    account = await _complete_sign_in(request, response, email=email, method="password", updates=payload.updates, location="password", password_hash=_hash_password(payload.password))
    return _account_response(account)


@router.post("/auth/login", response_model=AccountResponse)
async def password_login(payload: PasswordAuth, request: Request, response: Response):
    email = payload.email.strip().lower()
    await _guard_failures(email, request)
    account = await db.accounts.find_one({"email": email})
    if not account or not _password_ok(payload.password, account.get("password_hash")):
        await db.login_failures.insert_one({"email": email, "ip_hash": _hash("ip", client_ip(request)), "created_at": utc_now()})
        raise HTTPException(status_code=400, detail="Email or password didn't match. Accounts made with Google or the email code can sign in that way.")
    return _account_response(await _complete_sign_in(request, response, email=email, method="password", updates=payload.updates, location="password"))


@router.post("/auth/google", response_model=AccountResponse)
async def google_sign_in(payload: GoogleSession, request: Request, response: Response):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            result = await client.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": payload.session_id})
        result.raise_for_status()
        email = (result.json().get("email") or "").strip().lower()
    except Exception as exc:
        logger.warning("Google sign-in exchange failed: %s", exc)
        raise HTTPException(status_code=400, detail="Google sign-in didn't complete. Please try again.")
    if not email:
        raise HTTPException(status_code=400, detail="Google didn't share an email address.")
    return _account_response(await _complete_sign_in(request, response, email=email, method="google", updates=payload.updates, location="google"))


@router.get("/auth/me", response_model=AccountResponse)
async def me(request: Request):
    account = await current_account(request)
    return AccountResponse(signed_in=bool(account), email=account["email"] if account else None, updates_opt_in=bool(account and account.get("updates_opt_in")))


@router.post("/auth/request", response_model=SignInRequested)
async def request_sign_in(payload: SignInRequest, request: Request, response: Response):
    session_id = ensure_session(request, response)
    email = payload.email.strip().lower()
    hour_ago = utc_now() - timedelta(hours=1)
    ip_hash = _hash("ip", client_ip(request))
    if await db.signin_requests.count_documents({"email": email, "created_at": {"$gte": hour_ago}}) >= 3 or await db.signin_requests.count_documents({"ip_hash": ip_hash, "created_at": {"$gte": hour_ago}}) >= 10:
        raise HTTPException(status_code=429, detail="Too many sign-in emails. Try again in an hour.")
    token, code = secrets.token_urlsafe(32), f"{secrets.randbelow(1_000_000):06d}"
    row = {
        "id": str(uuid.uuid4()), "email": email, "token_hash": _hash("token", token), "code_hash": _hash("code", f"{email}:{code}"),
        "attempts": 0, "updates": payload.updates, "location": payload.location, "return_to": _safe_path(payload.return_to),
        "session_id": session_id, "ip_hash": ip_hash, "created_at": utc_now(), "expires_at": utc_now() + LINK_TTL, "used_at": None,
    }
    await db.signin_requests.insert_one(row)
    link = f"{_base_url(request)}/api/auth/verify?token={quote(token)}"
    try:
        await send_signin_email(email, link, code)
    except Exception as exc:
        logger.error("Sign-in email failed: %s", exc)
        await db.signin_requests.update_one({"id": row["id"]}, {"$set": {"send_failed": True}})
        raise HTTPException(status_code=502, detail="We couldn't send the sign-in email. Try again shortly.")
    return SignInRequested(sent=True, email=email)


async def send_signin_email(email: str, link: str, code: str) -> None:
    from lib.emailer import send_email
    await send_email(to=email, subject=f"Your Aaspaas sign-in code: {code}", html=_email_html(link, code))


@router.get("/auth/verify")
async def verify_link(request: Request, token: str = Query(min_length=10, max_length=100)):
    row = await db.signin_requests.find_one({"token_hash": _hash("token", token), "used_at": None, "expires_at": {"$gt": utc_now()}})
    if not row:
        return RedirectResponse("/?signin=expired", status_code=303)
    target = row.get("return_to", "/")
    redirect = RedirectResponse(f"{target}{'&' if '?' in target else '?'}signin=done", status_code=303)
    await _complete_sign_in(request, redirect, email=row["email"], method="link", updates=bool(row.get("updates")), location=row.get("location"), request_id=row["id"])
    return redirect


@router.post("/auth/verify-code", response_model=AccountResponse)
async def verify_code(payload: CodeVerify, request: Request, response: Response):
    email = payload.email.strip().lower()
    row = await db.signin_requests.find_one({"email": email, "used_at": None, "expires_at": {"$gt": utc_now()}}, sort=[("created_at", -1)])
    if not row or row.get("attempts", 0) >= MAX_CODE_ATTEMPTS:
        raise HTTPException(status_code=400, detail="This code has expired. Request a new sign-in email.")
    if row["code_hash"] != _hash("code", f"{email}:{payload.code}"):
        attempts = row.get("attempts", 0) + 1
        await db.signin_requests.update_one({"id": row["id"]}, {"$set": {"attempts": attempts, **({"expires_at": utc_now()} if attempts >= MAX_CODE_ATTEMPTS else {})}})
        raise HTTPException(status_code=400, detail="That code didn't match." if attempts < MAX_CODE_ATTEMPTS else "Too many wrong codes. Request a new sign-in email.")
    return _account_response(await _complete_sign_in(request, response, email=email, method="code", updates=bool(row.get("updates")), location=row.get("location"), request_id=row["id"]))


@router.post("/auth/logout", response_model=AccountResponse)
async def logout(request: Request, response: Response):
    token = request.cookies.get(ACCOUNT_COOKIE)
    if token:
        await db.account_tokens.delete_one({"token_hash": token_hash(token)})
    response.delete_cookie(ACCOUNT_COOKIE)
    response.set_cookie(SESSION_COOKIE, str(uuid.uuid4()), httponly=True, samesite="lax", secure=_secure(), max_age=31536000)  # fresh anonymous browser
    return AccountResponse(signed_in=False)


@router.post("/auth/updates", response_model=AccountResponse)
async def opt_in_updates(request: Request):
    account = await current_account(request)
    if not account:
        raise HTTPException(status_code=401, detail="Sign in first")
    await db.accounts.update_one({"id": account["id"]}, {"$set": {"updates_opt_in": True, "updates_consented_at": utc_now(), "updates_consent_location": "learn"}})
    return AccountResponse(signed_in=True, email=account["email"], updates_opt_in=True)
