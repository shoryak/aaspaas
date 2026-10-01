"""Shareable chart card: PNG rendering, validation, and share-event recording."""

SEED_IDEA_ID = "46aba722-e508-4b29-a69c-888d46e929c0"


def test_share_image_png_happy_path(client):
    resp = client.get(
        f"/share/{SEED_IDEA_ID}/image.png",
        params={"period": "1Y", "benchmark": "true", "hidden": "SWSOLAR"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "image/png"
    # 1200x630 PNG: verify via the PNG IHDR chunk (bytes 16-24 are width/height, big-endian).
    body = resp.content
    assert body[:8] == b"\x89PNG\r\n\x1a\n"
    width = int.from_bytes(body[16:20], "big")
    height = int.from_bytes(body[20:24], "big")
    assert (width, height) == (1200, 630), f"expected 1200x630, got {width}x{height}"


def test_share_image_invalid_period_rejected(client):
    resp = client.get(f"/share/{SEED_IDEA_ID}/image.png", params={"period": "10Y"})
    assert resp.status_code == 422, resp.text


def test_share_image_unknown_idea_404(client):
    resp = client.get("/share/tscheck-unknown-idea-zzz/image.png", params={"period": "1Y"})
    assert resp.status_code == 404, resp.text


def test_post_shares_records_chart_surface(client):
    resp = client.post("/shares", json={"idea_id": SEED_IDEA_ID, "surface": "chart"})
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"recorded": True}


def test_post_shares_unknown_idea_404(client):
    resp = client.post("/shares", json={"idea_id": "tscheck-unknown-idea-zzz", "surface": "chart"})
    assert resp.status_code == 404, resp.text
