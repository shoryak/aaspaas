"""Google callback handling with an invalid session_id (acceptance criterion: "Google callback handling").

POST /api/auth/google with a bogus session_id must fail cleanly (400), not crash or sign anyone in.
"""
import httpx


def test_invalid_google_session_id_returns_400(client: httpx.Client):
    resp = client.post("/auth/google", json={"session_id": "tscheck-invalid-test-session", "updates": False})
    assert resp.status_code == 400, resp.text
    detail = resp.json().get("detail", "")
    assert "didn't complete" in detail.lower() or "try again" in detail.lower()

    # No session/account cookie should have been set on a failed exchange.
    assert "aaspaas_account" not in resp.cookies


def test_me_endpoint_stays_signed_out_after_failed_google_exchange(client: httpx.Client):
    with httpx.Client(base_url=client.base_url, timeout=30.0) as fresh:
        bad = fresh.post("/auth/google", json={"session_id": "tscheck-another-invalid-session", "updates": False})
        assert bad.status_code == 400, bad.text
        me = fresh.get("/auth/me")
        assert me.status_code == 200
        assert me.json()["signed_in"] is False
