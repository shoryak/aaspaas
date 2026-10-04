import { useState } from "react";
import { Crosshair, MapPin, X } from "lucide-react";
import { toast } from "sonner";

import { useEngagement } from "@/hooks/useEngagement";
import { apiGet } from "@/lib/api";
import type { Place } from "@/lib/types";

const KEY = "aaspaas-place";
export const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow", "Surat", "Kochi", "Chandigarh", "Indore", "Bhopal", "Nagpur", "Coimbatore", "Visakhapatnam", "Patna", "Guwahati", "Bhubaneswar", "Gurugram", "Noida", "Thiruvananthapuram", "Mysuru", "Vadodara", "Ludhiana", "Dehradun", "Ranchi", "Raipur", "Goa", "Nashik", "Madurai", "Varanasi", "Amritsar", "Mangaluru", "Vijayawada", "Srinagar", "Jodhpur", "Udaipur"];

export function readStoredPlace(): Place | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null") as Place | null; } catch { return null; }
}

export const placeLabel = (place: Place) => place.area ? `${place.area}, ${place.city}` : place.city;

function parse(text: string): Place | null {
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length || parts[parts.length - 1].length < 2) return null;
  const city = parts[parts.length - 1];
  const area = parts.slice(0, -1).join(", ") || null;
  return { area, city, state: null, source: !area && CITIES.includes(city) ? "picked" : "typed" };
}

export function PlaceTag({ place, testId }: { place: Place | null | undefined; testId: string }) {
  if (!place) return null;
  return <span className="place-tag" data-testid={testId}><MapPin size={11} />{placeLabel(place)}</span>;
}

/** Optional "where did you notice this?" — GPS, a city list, or any custom area. Remembered in this browser. */
export function PlacePicker() {
  const { track } = useEngagement();
  const [place, setPlace] = useState<Place | null>(() => readStoredPlace());
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [locating, setLocating] = useState(false);
  const save = (next: Place | null) => { setPlace(next); setEditing(false); if (next) localStorage.setItem(KEY, JSON.stringify(next)); else localStorage.removeItem(KEY); };
  const locate = () => {
    if (!navigator.geolocation) { toast.error("This browser can't share location. Pick or type your city instead."); setEditing(true); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const found = await apiGet<Place>(`/places/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
        save(found);
        track({ event_name: "place_set", properties: { source: "gps" } });
      } catch { toast.error("Couldn't find a city for this spot. Pick or type one instead."); setEditing(true); }
      finally { setLocating(false); }
    }, () => { setLocating(false); toast.message("Location not shared — pick or type your city instead."); setEditing(true); }, { timeout: 10000, maximumAge: 600000 });
  };
  return <div className="place-picker" data-testid="place-picker">
    {place && !editing ? <div className="place-current">
      <MapPin size={14} /><span>Noticed in <strong data-testid="place-current-label">{placeLabel(place)}</strong></span>
      <button type="button" onClick={() => { setText(placeLabel(place)); setEditing(true); }} data-testid="place-change-button">Change</button>
      <button type="button" aria-label="Remove location" onClick={() => save(null)} data-testid="place-clear-button"><X size={13} /></button>
    </div> : editing ? <form className="place-edit" onSubmit={(event) => { event.preventDefault(); const next = parse(text); if (!next) { toast.error("Type a city, or “Area, City”."); return; } save(next); track({ event_name: "place_set", properties: { source: next.source } }); }}>
      <input list="aaspaas-cities" value={text} onChange={(event) => setText(event.target.value)} placeholder="Area, City — e.g. Indiranagar, Bengaluru" maxLength={110} autoFocus data-testid="place-input" />
      <datalist id="aaspaas-cities">{CITIES.map((city) => <option key={city} value={city} />)}</datalist>
      <button type="submit" className="place-save" data-testid="place-save-button">Save</button>
      <button type="button" onClick={locate} disabled={locating} aria-label="Use my location" data-testid="place-gps-inline"><Crosshair size={14} /></button>
      <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" data-testid="place-cancel-button"><X size={13} /></button>
    </form> : <div className="place-empty">
      <MapPin size={14} /><span>Where did you notice this? <small>optional</small></span>
      <button type="button" onClick={locate} disabled={locating} data-testid="place-gps-button"><Crosshair size={13} />{locating ? "Locating…" : "Use my location"}</button>
      <button type="button" onClick={() => { setText(""); setEditing(true); }} data-testid="place-pick-button">Pick or type a city</button>
    </div>}
    <p className="place-privacy">Only the city is ever shown to others, and only once 3+ people there have noticed something.</p>
  </div>;
}
