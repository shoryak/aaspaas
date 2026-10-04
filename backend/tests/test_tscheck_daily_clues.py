"""Daily clues: GET /api/trending/today returns a fresh/previous day with <=5 clues,
and opening a clue's linked idea read-only (shared=1) does not require a new POST /api/ideas."""


def test_trending_today_is_fresh_with_at_most_five_clues(client):
    resp = client.get("/trending/today")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] in ("fresh", "previous")
    assert "date" in body
    assert isinstance(body["clues"], list)
    assert len(body["clues"]) <= 5
    if body["clues"]:
        first = body["clues"][0]
        assert "observation" in first and "source" in first and "tickers" in first


def test_clue_idea_opens_read_only_without_new_post(client):
    today = client.get("/trending/today")
    assert today.status_code == 200
    clues = today.json()["clues"]
    assert clues, "seed_facts promised today's clues are ready"
    idea_id = next((c["idea_id"] for c in clues if c.get("idea_id")), None)
    assert idea_id, "first clue should carry an idea_id per seed_facts"
    resp = client.get(f"/ideas/{idea_id}?shared=true")
    assert resp.status_code == 200, resp.text
    idea = resp.json()
    assert idea["id"] == idea_id
    assert isinstance(idea.get("companies"), list) and idea["companies"]
