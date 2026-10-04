"""City/area handling: normalisation and GPS → place via OpenStreetMap Nominatim (cached, ~1 km grid)."""
import logging
from datetime import timedelta

import httpx

from lib.db import db
from lib.session import utc_now
from models.aaspaas import Place

logger = logging.getLogger(__name__)
ALIASES = {
    "bangalore": "Bengaluru", "bengaluru urban": "Bengaluru", "bombay": "Mumbai", "calcutta": "Kolkata", "madras": "Chennai",
    "gurgaon": "Gurugram", "new delhi": "Delhi", "delhi ncr": "Delhi", "poona": "Pune", "baroda": "Vadodara", "trivandrum": "Thiruvananthapuram",
    "cochin": "Kochi", "mysore": "Mysuru", "mangalore": "Mangaluru", "benares": "Varanasi", "banaras": "Varanasi", "allahabad": "Prayagraj",
    "pondicherry": "Puducherry", "vizag": "Visakhapatnam", "noida": "Noida",
}


def _clean(text: str | None) -> str:
    return " ".join((text or "").replace("\n", " ").split())[:60]


def normalize_city(city: str | None) -> str:
    cleaned = _clean(city)
    if not cleaned:
        return ""
    return ALIASES.get(cleaned.lower(), cleaned.title() if cleaned.islower() or cleaned.isupper() else cleaned)


def normalize_place(place: Place) -> Place | None:
    city = normalize_city(place.city)
    if len(city) < 2:
        return None
    area = _clean(place.area) or None
    return Place(area=area if area and area.lower() != city.lower() else None, city=city, state=_clean(place.state) or None, source=place.source)


async def reverse_geocode(lat: float, lon: float) -> Place | None:
    key = f"{round(lat, 2)},{round(lon, 2)}"
    cached = await db.geo_cache.find_one({"key": key})
    if cached:
        return Place(**cached["place"]) if cached.get("place") else None
    try:
        async with httpx.AsyncClient(timeout=8, headers={"User-Agent": "Aaspaas/1.0 (educational app; reverse geocoding city only)"}) as client:
            response = await client.get("https://nominatim.openstreetmap.org/reverse", params={"lat": round(lat, 3), "lon": round(lon, 3), "format": "jsonv2", "zoom": 16, "accept-language": "en"})
            response.raise_for_status()
        address = response.json().get("address", {})
    except Exception as exc:
        logger.warning("Reverse geocode failed for %s: %s", key, exc)
        return None
    city = address.get("city") or address.get("town") or address.get("state_district") or address.get("county") or address.get("village")
    area = address.get("suburb") or address.get("neighbourhood") or address.get("city_district") or address.get("quarter")
    place = normalize_place(Place(area=area, city=city, state=address.get("state"), source="gps")) if city else None
    await db.geo_cache.update_one({"key": key}, {"$set": {"key": key, "place": place.model_dump() if place else None, "created_at": utc_now(), "expires_at": utc_now() + timedelta(days=90)}}, upsert=True)
    return place
