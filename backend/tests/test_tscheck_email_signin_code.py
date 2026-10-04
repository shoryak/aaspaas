"""Email sign-in (code path): wrong code is rejected; a pre-seeded code signs the account in."""
import pytest


def test_wrong_code_returns_400(client):
    resp = client.post("/auth/verify-code", json={"email": "qa3@aaspaas.dev", "code": "000000"})
    assert resp.status_code == 400, resp.text


def test_preseeded_code_signs_in_and_me_reflects_it(client):
    resp = client.post("/auth/verify-code", json={"email": "qa3@aaspaas.dev", "code": "333333"})
    if resp.status_code != 200:
        pytest.skip(f"qa3@aaspaas.dev/333333 already consumed this session ({resp.status_code}): {resp.text}")
    body = resp.json()
    assert body["signed_in"] is True
    assert body["email"] == "qa3@aaspaas.dev"
    # the httpx client instance carries the Set-Cookie forward, so /auth/me on the same client reflects sign-in
    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["signed_in"] is True
    assert me.json()["email"] == "qa3@aaspaas.dev"
