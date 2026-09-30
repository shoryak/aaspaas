"""Backend coverage for the /admin auth + aggregate analytics criterion.

Criterion: "/admin authenticates with documented credentials and shows funnel,
latency, hook/chart/chain/question, return, email, limit, fallback, Screener,
and sharing metrics."
"""

import os

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Aaspaas-admin-2026!")


def test_admin_login_rejects_bad_password(client):
    resp = client.post("/admin/login", json={"password": "definitely-wrong-password"})
    assert resp.status_code == 401, resp.text


def test_admin_login_and_summary_metrics(client):
    login = client.post("/admin/login", json={"password": ADMIN_PASSWORD})
    assert login.status_code == 200, login.text
    assert login.json()["authenticated"] is True
    # httpx.Client persists cookies set by the server across requests on the same client.
    summary = client.get("/admin/summary")
    assert summary.status_code == 200, summary.text
    body = summary.json()

    # Top-level funnel + sharing signals
    assert "funnel" in body and len(body["funnel"]) >= 1
    funnel_keys = {step["key"] for step in body["funnel"]}
    assert {"ideas", "hooks", "recaps", "shares"}.issubset(funnel_keys)
    assert "shares" in body and "share_click_rate" in body

    # Engagement metrics: latency, hook/chart/chain/question, return, email, limit, fallback, screener
    engagement_keys = {metric["key"] for metric in body["engagement"]}
    expected_keys = {
        "first_company",  # latency (median generation time)
        "hook_continuation",
        "chart_expansion",
        "chain_completion",
        "question_engagement",
        "return_visitors",
        "email_conversion",
        "limit_hits",
        "fallback",
        "screener",
    }
    missing = expected_keys - engagement_keys
    assert not missing, f"admin summary missing engagement metrics: {missing}"


def test_admin_summary_requires_authentication(client):
    # Fresh client with no cookies must be rejected.
    import httpx

    with httpx.Client(base_url=client.base_url, timeout=30.0) as anon:
        resp = anon.get("/admin/summary")
        assert resp.status_code == 401, resp.text
