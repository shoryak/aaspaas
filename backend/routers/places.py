from collections import Counter, defaultdict
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Query

from lib.db import db
from lib.places import reverse_geocode
from lib.session import utc_now
from models.aaspaas import Place
from models.learning import CitiesResponse, CityThemes

router = APIRouter(tags=["places"])
MIN_PEOPLE = 3
WINDOW_DAYS = 60


@router.get("/places/reverse", response_model=Place)
async def reverse(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-180, le=180)):
    place = await reverse_geocode(lat, lon)
    if not place:
        raise HTTPException(status_code=404, detail="Couldn't find a city for this spot. Pick or type one instead.")
    return place


@router.get("/places/cities", response_model=CitiesResponse)
async def cities():
    """City-level themes only, and only once 3+ different people there have noticed something. Never anyone's words."""
    rows = await db.ideas.find(
        {"is_demo": False, "place.city": {"$exists": True}, "submitted_at": {"$gte": utc_now() - timedelta(days=WINDOW_DAYS)}},
        {"_id": 0, "place": 1, "session_id": 1, "observation_theme": 1, "tickers": 1},
    ).to_list(5000)
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row["place"]["city"]].append(row)
    shown, gathering = [], 0
    for city, items in grouped.items():
        people = len({item["session_id"] for item in items})
        if people < MIN_PEOPLE:
            gathering += 1
            continue
        themes = Counter(item.get("observation_theme") for item in items if item.get("observation_theme"))
        tickers = Counter(ticker for item in items for ticker in item.get("tickers", []))
        states = Counter(item["place"].get("state") for item in items if item["place"].get("state"))
        shown.append(CityThemes(city=city, state=states.most_common(1)[0][0] if states else None, people=people,
                                themes=[theme for theme, _ in themes.most_common(3)], tickers=[ticker for ticker, _ in tickers.most_common(4)]))
    shown.sort(key=lambda item: -item.people)
    return CitiesResponse(min_people=MIN_PEOPLE, window_days=WINDOW_DAYS, cities=shown[:24], gathering=gathering)
