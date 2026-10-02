"""Peer comparison API: GET /ideas/{id}/peers and GET /companies/{exch}/{ticker}/fundamentals."""

SEED_IDEA_ID = "2a3c3928-6c73-4855-b88c-94adb1d60d01"


def test_peers_ready_with_groups(client):
    resp = client.get(f"/ideas/{SEED_IDEA_ID}/peers")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ready"
    groups = body["groups"]
    by_ticker = {g["ticker"]: g for g in groups}
    assert "BRITANNIA" in by_ticker
    assert "BALRAMCHIN" in by_ticker
    assert "UFLEX" in by_ticker

    britannia_peers = {p["ticker"] for p in by_ticker["BRITANNIA"]["peers"]}
    assert "NESTLEIND" in britannia_peers
    assert "ITC" in britannia_peers
    assert {p["ticker"] for p in by_ticker["BALRAMCHIN"]["peers"]} == {"RENUKA"}
    assert {p["ticker"] for p in by_ticker["UFLEX"]["peers"]} == {"HUHTAMAKI"}

    for g in groups:
        for p in g["peers"]:
            assert "company_name" in p and p["company_name"]
            assert "exchange" in p and p["exchange"]
            assert "reason" in p and p["reason"]


def test_peers_backfilled_for_older_idea(client):
    """a594e733... is an older idea whose peers were backfilled after the fact."""
    resp = client.get("/ideas/a594e733-3734-4d9b-89ea-3ba3aa8236f1/peers")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ready"
    assert body["groups"], "expected backfilled peer groups on the older idea"


def test_peers_unknown_idea_404(client):
    resp = client.get("/ideas/tscheck-peers-does-not-exist/peers")
    assert resp.status_code == 404, resp.text


def test_fundamentals_britannia_available(client):
    resp = client.get("/companies/NSE/BRITANNIA/fundamentals")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["available"] is True
    assert "roce" in body
    assert len(body["lines"]) == 3
    keys = {line["key"] for line in body["lines"]}
    assert keys == {"revenue", "net_income", "operating_cash_flow"}


def test_fundamentals_invalid_exchange_422(client):
    resp = client.get("/companies/NYSE/AAPL/fundamentals")
    assert resp.status_code == 422, resp.text


def test_idea_companies_have_peers_and_scoreless_scorecard(client):
    """Seeded idea (read via ?shared=1, no new POST /ideas) should show companies[].peers
    and scorecard items with no 'score' field, matching the written-lenses spec."""
    resp = client.get(f"/ideas/{SEED_IDEA_ID}?shared=1")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    companies = body["companies"]
    assert companies, "expected at least one company"
    britannia = next(c for c in companies if c["ticker"] == "BRITANNIA")
    assert britannia["peers"], "expected peers on company"
    for p in britannia["peers"]:
        assert "company_name" in p and "ticker" in p and "reason" in p
    assert britannia["scorecard"], "expected scorecard notes"
    for item in britannia["scorecard"]:
        assert "score" not in item, f"scorecard item unexpectedly has a score field: {item}"
        assert "rationale" in item and item["rationale"]
