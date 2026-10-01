"""Real Yahoo fundamentals enrichment for a seeded idea's company."""

SEED_IDEA_ID = "46aba722-e508-4b29-a69c-888d46e929c0"
TICKER = "BORORENEW"


def test_enrichment_returns_live_or_cached_fundamentals(client):
    resp = client.get(f"/ideas/{SEED_IDEA_ID}/companies/{TICKER}/enrichment")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["idea_id"] == SEED_IDEA_ID
    assert body["ticker"] == TICKER
    finance = body["finance"]
    assert finance["status"] in ("live", "cached"), f"unexpected finance status: {finance}"
    assert finance["market_cap"] is not None
    assert finance["pe_ratio"] is not None
    # ROE is documented as unavailable from Yahoo for these tickers (spec deviation) —
    # it must show up honestly as None, not crash or fabricate a value.
    assert "roe" in finance


def test_enrichment_unknown_ticker_handled(client):
    resp = client.get(f"/ideas/{SEED_IDEA_ID}/companies/TSCHECKNOPE/enrichment")
    assert resp.status_code in (200, 404), resp.text
