"""Verified-email accounts. Signing in points this browser's anonymous session at the account's primary session,
so discoveries, field notes, partner chats and watched lessons follow the reader to every device."""
import hashlib
from datetime import timedelta

from fastapi import HTTPException, Request

from lib.db import db
from lib.session import utc_now

ACCOUNT_COOKIE = "aaspaas_account"
ACCOUNT_TTL = timedelta(days=90)


def token_hash(token: str) -> str:
    return hashlib.sha256(f"aaspaas-account:{token}".encode()).hexdigest()


async def current_account(request: Request) -> dict | None:
    token = request.cookies.get(ACCOUNT_COOKIE)
    if not token:
        return None
    row = await db.account_tokens.find_one({"token_hash": token_hash(token), "expires_at": {"$gt": utc_now()}})
    if not row:
        return None
    return await db.accounts.find_one({"id": row["account_id"]}, {"_id": 0})


async def require_account(request: Request) -> dict:
    account = await current_account(request)
    if not account:
        raise HTTPException(status_code=401, detail={"code": "sign_in_required", "message": "Sign in with your email to use practice portfolios."})
    return account
