"""Referral attribution: opening a share link attributes a human visitor but not crawlers."""

import httpx

SEED_IDEA_ID = "46aba722-e508-4b29-a69c-888d46e929c0"
BASE_URL = "http://localhost:8001/api"


def test_share_token_endpoint_returns_12_hex_chars():
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as c:
        resp = c.get("/share-token")
        assert resp.status_code == 200, resp.text
        token = resp.json()["token"]
        assert len(token) == 12
        int(token, 16)  # raises if not hex


def test_share_open_human_sets_session_cookie_and_og_tags():
    with httpx.Client(base_url=BASE_URL, timeout=30.0, follow_redirects=False) as c:
        resp = c.get(
            f"/share/{SEED_IDEA_ID}",
            params={"ref": "tscheck12345", "ch": "whatsapp"},
            headers={"User-Agent": "Mozilla/5.0 (tscheck real browser)"},
        )
        assert resp.status_code == 200, resp.text
        assert "og:image" in resp.text
        assert "twitter:card" in resp.text
        assert "aaspaas_session" in resp.cookies, "human open must set the session cookie"


def test_share_open_crawler_does_not_set_session_cookie():
    with httpx.Client(base_url=BASE_URL, timeout=30.0, follow_redirects=False) as c:
        resp = c.get(
            f"/share/{SEED_IDEA_ID}",
            params={"ref": "tscheck12345", "ch": "whatsapp"},
            headers={"User-Agent": "WhatsApp/2.24 A"},
        )
        assert resp.status_code == 200, resp.text
        assert "aaspaas_session" not in resp.cookies, "crawler fetch must not be counted as a visitor session"


def test_share_open_unknown_idea_404():
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as c:
        resp = c.get("/share/tscheck-does-not-exist")
        assert resp.status_code == 404, resp.text
