"""Practice portfolio API requires sign-in: GET /api/portfolios without an account cookie -> 401."""


def test_portfolios_without_signin_returns_401(client):
    resp = client.get("/portfolios")
    assert resp.status_code == 401, resp.text
