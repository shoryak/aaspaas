"""Studio range control: days in {7,30,90,0} are valid and shape the summary; anything else is rejected."""

import os

import httpx

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Aaspaas-admin-2026!")
BASE_URL = "http://localhost:8001/api"


def test_each_valid_range_returns_200_with_matching_range_days():
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as c:
        login = c.post("/admin/login", json={"password": ADMIN_PASSWORD})
        assert login.status_code == 200, login.text
        for days in (7, 30, 90, 0):
            resp = c.get("/admin/summary", params={"days": days})
            assert resp.status_code == 200, f"days={days}: {resp.text}"
            body = resp.json()
            assert body["range_days"] == days
            # 7-step viral funnel + headline metrics + channel/platform/trend/spreading sections always present
            assert len(body["viral_funnel"]) == 7
            assert len(body["headline"]) >= 1
            for key in ("channels", "preview_platforms", "acquisition_trend", "top_spreading", "monetization", "unit_economics", "power_users"):
                assert key in body


def test_invalid_days_value_rejected_with_422():
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as c:
        login = c.post("/admin/login", json={"password": ADMIN_PASSWORD})
        assert login.status_code == 200, login.text
        resp = c.get("/admin/summary", params={"days": 5})
        assert resp.status_code == 422, resp.text
