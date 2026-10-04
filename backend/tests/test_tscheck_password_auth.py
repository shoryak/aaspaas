"""Email + password sign-up / sign-in (acceptance criterion: "Email + password sign-up and sign-in").

Each test uses its own unique tscheck-* email so it never touches seeded accounts.
"""
import time

import httpx


def _email(tag: str) -> str:
    return f"tscheck-pw-{tag}-{int(time.time() * 1000)}@aaspaas.dev"


def test_register_then_login_with_new_account(client: httpx.Client):
    email = _email("new")
    password = "chai-stall-2026"

    register_resp = client.post("/auth/register", json={"email": email, "password": password, "updates": False})
    assert register_resp.status_code == 200, register_resp.text
    body = register_resp.json()
    assert body["signed_in"] is True and body["email"] == email

    # Registering the same email again must be rejected.
    dup_resp = client.post("/auth/register", json={"email": email, "password": password, "updates": False})
    assert dup_resp.status_code == 409, dup_resp.text
    assert "already" in dup_resp.json()["detail"].lower()

    # Fresh client (no cookies) signing in with the right credentials succeeds.
    # Cookies are marked Secure (APP_URL is https) so a plain-http test client won't auto-resend them;
    # pull the raw Set-Cookie values and attach them explicitly to prove the session really was created.
    with httpx.Client(base_url=client.base_url, timeout=30.0) as fresh:
        login_resp = fresh.post("/auth/login", json={"email": email, "password": password, "updates": False})
        assert login_resp.status_code == 200, login_resp.text
        assert login_resp.json() == {"signed_in": True, "email": email, "updates_opt_in": False}
        raw_cookies = {c.split("=", 1)[0]: c.split("=", 1)[1].split(";", 1)[0] for c in login_resp.headers.get_list("set-cookie")}
        assert "aaspaas_account" in raw_cookies

        me_resp = fresh.get("/auth/me", cookies=raw_cookies)
        assert me_resp.status_code == 200 and me_resp.json()["signed_in"] is True

        logout_resp = fresh.post("/auth/logout", cookies=raw_cookies)
        assert logout_resp.status_code == 200 and logout_resp.json()["signed_in"] is False


def test_login_with_wrong_password_is_rejected(client: httpx.Client):
    email = _email("wrongpw")
    password = "chai-stall-2026"
    reg = client.post("/auth/register", json={"email": email, "password": password, "updates": False})
    assert reg.status_code == 200, reg.text

    with httpx.Client(base_url=client.base_url, timeout=30.0) as fresh:
        bad_resp = fresh.post("/auth/login", json={"email": email, "password": "not-the-password", "updates": False})
        assert bad_resp.status_code == 400, bad_resp.text
        assert "didn't match" in bad_resp.json()["detail"].lower()

        me_resp = fresh.get("/auth/me")
        assert me_resp.json()["signed_in"] is False


def test_existing_seeded_password_account_signs_in(client: httpx.Client):
    with httpx.Client(base_url=client.base_url, timeout=30.0) as fresh:
        resp = fresh.post("/auth/login", json={"email": "pw-user@aaspaas.dev", "password": "chai-stall-2026", "updates": False})
        assert resp.status_code == 200, resp.text
        assert resp.json()["signed_in"] is True
        assert resp.json()["email"] == "pw-user@aaspaas.dev"
