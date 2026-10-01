"""Market context: Nifty 50 benchmark + NSE/Yahoo event markers (seeded idea)."""

SEED_IDEA_ID = "46aba722-e508-4b29-a69c-888d46e929c0"


def test_market_context_returns_benchmark_and_events(client):
    resp = client.get(f"/ideas/{SEED_IDEA_ID}/market-context")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["idea_id"] == SEED_IDEA_ID
    assert body["benchmark_status"] in ("live", "cached", "unavailable")
    # Roughly 1249 Nifty points per seed facts; allow generous tolerance, but require a
    # substantial series when status reports live/cached (not an empty/stale array).
    if body["benchmark_status"] in ("live", "cached"):
        assert len(body["benchmark_points"]) > 500, f"expected rich Nifty series, got {len(body['benchmark_points'])}"

    assert body["events_status"] in ("live", "cached", "unavailable")
    if body["events_status"] in ("live", "cached"):
        assert len(body["events"]) > 50, f"expected many NSE/Yahoo events, got {len(body['events'])}"
        sample = body["events"][0]
        for key in ("date", "ticker", "kind", "category", "summary"):
            assert key in sample


def test_market_context_unknown_idea_still_resolves(client):
    # Market context is informational per-idea; an idea that doesn't exist should not 500.
    resp = client.get("/ideas/does-not-exist-tscheck/market-context")
    assert resp.status_code in (200, 404), resp.text
