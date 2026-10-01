"""Studio auth: unlisted path is protected purely by the admin password on the API."""

import os

import httpx

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Aaspaas-admin-2026!")


def test_admin_session_without_cookie_is_unauthenticated(client: httpx.Client):
    resp = client.get("/admin/session")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"authenticated": False}


def test_admin_summary_requires_cookie(client: httpx.Client):
    resp = client.get("/admin/summary")
    assert resp.status_code == 401, resp.text


def test_admin_login_wrong_password_rejected(client: httpx.Client):
    resp = client.post("/admin/login", json={"password": "tscheck-wrong-password"})
    assert resp.status_code == 401, resp.text


def test_admin_login_correct_password_grants_summary_access():
    with httpx.Client(base_url="http://localhost:8001/api", timeout=30.0) as c:
        login = c.post("/admin/login", json={"password": ADMIN_PASSWORD})
        assert login.status_code == 200, login.text
        assert login.json()["authenticated"] is True
        assert "aaspaas_admin" in login.cookies

        session = c.get("/admin/session")
        assert session.status_code == 200
        assert session.json() == {"authenticated": True}

        summary = c.get("/admin/summary", params={"days": 30})
        assert summary.status_code == 200, summary.text
        body = summary.json()
        assert body["range_days"] == 30
        assert "headline" in body and "viral_funnel" in body


def test_admin_summary_invalid_days_rejected():
    with httpx.Client(base_url="http://localhost:8001/api", timeout=30.0) as c:
        c.post("/admin/login", json={"password": ADMIN_PASSWORD})
        resp = c.get("/admin/summary", params={"days": 5})
        assert resp.status_code == 422, resp.text
