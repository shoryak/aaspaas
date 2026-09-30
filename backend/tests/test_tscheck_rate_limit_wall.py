"""Backend coverage for the daily submission rate-limit wall.

Criterion: "The fourth expensive submission in one UTC day reaches the designed
three-per-day wall without blocking saved content."

IMPORTANT: this test file does NOT create a fresh idea itself. The per-IP daily
allowance (3 starts/day) is shared across this whole test environment (same
egress IP), and the browser check `full-story-discovery-flow` is the one that
intentionally consumes the environment's last remaining slot for the day so it
can exercise the real story UI end-to-end. This test only asserts that once the
IP-level allowance is exhausted, the API correctly serves 429 with the
documented shape - it must run AFTER that browser check in the same day/iteration.
"""

import httpx


def test_fourth_submission_hits_daily_wall(client):
    resp = client.post("/ideas", json={"observation": "tscheck rate limit probe observation sentence"})
    assert resp.status_code == 429, (
        f"Expected 429 once the shared daily allowance is exhausted, got {resp.status_code}: {resp.text}. "
        "This test depends on the full-story-discovery-flow browser check having already used the day's "
        "last allowed submission for this IP; if it has not run yet in this iteration, rerun after it."
    )
    detail = resp.json()["detail"]
    assert detail["daily_limit"] == 3
    assert "reset_at" in detail and detail["reset_at"]
    assert "message" in detail


def test_saved_content_remains_reachable_after_wall(client):
    # /discoveries (saved content) must stay reachable even while the wall is up.
    resp = client.get("/discoveries")
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json(), list)
