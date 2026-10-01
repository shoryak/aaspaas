"""Link preview HTML for shared links: og:image, twitter card, redirect, 404."""

import re

SEED_IDEA_ID = "46aba722-e508-4b29-a69c-888d46e929c0"


def test_share_link_preview_has_og_tags_and_redirect(client, backend_url):
    resp = client.get(f"/share/{SEED_IDEA_ID}", follow_redirects=False)
    assert resp.status_code == 200, resp.text
    html = resp.text

    og_image_match = re.search(r'og:image" content="([^"]+)"', html)
    assert og_image_match, "missing og:image tag"
    og_image = og_image_match.group(1)
    assert og_image.startswith("http"), og_image
    assert f"/api/share/{SEED_IDEA_ID}/image.png" in og_image

    assert 'og:title" content=' in html
    assert 'twitter:card" content="summary_large_image"' in html

    # Client-side redirect to the recap view (meta refresh + JS replace — share pages
    # are plain HTML, not HTTP 3xx, so browsers/crawlers both resolve correctly).
    assert f"/?idea={SEED_IDEA_ID}&amp;view=recap&amp;shared=1" in html or \
        f"/?idea={SEED_IDEA_ID}&view=recap&shared=1" in html


def test_share_link_preview_unknown_id_404(client):
    resp = client.get("/share/tscheck-unknown-link-zzz")
    assert resp.status_code == 404, resp.text
