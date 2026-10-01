"""Server-rendered 1200x630 share card (same image for the share sheet and link previews)."""
from datetime import datetime, timezone
from io import BytesIO
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from models.aaspaas import PricePoint

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
SCALE = 2  # supersample, then downscale for smooth lines
W, H = 1200, 630
BG, PANEL, INK, MUTED, GRID = "#17181a", "#1d1e21", "#efeee8", "#8c8e91", "#2e3034"
MARIGOLD, GAIN, LOSS, BENCH = "#e0a35a", "#63b987", "#e07b70", "#9a9b96"
SERIES_COLORS = ["#e0a35a", "#a394cf", "#7fb2d6", "#e9e5da"]
PERIOD_YEARS = {"1Y": 1, "3Y": 3, "5Y": 5}


def _font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / name), size * SCALE)


def points_for_period(points: list[PricePoint], period: str) -> list[PricePoint]:
    if len(points) < 2:
        return points
    latest = datetime.fromisoformat(points[-1].date)
    try:
        cutoff = latest.replace(year=latest.year - PERIOD_YEARS.get(period, 5))
    except ValueError:  # 29 Feb
        cutoff = latest.replace(year=latest.year - PERIOD_YEARS.get(period, 5), day=28)
    filtered = [point for point in points if datetime.fromisoformat(point.date) >= cutoff]
    return filtered if len(filtered) >= 2 else points


def _truncate(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, width: int) -> str:
    if draw.textlength(text, font=font) <= width:
        return text
    while text and draw.textlength(text + "…", font=font) > width:
        text = text[:-1]
    return text.rstrip() + "…"


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, width: int, max_lines: int) -> list[str]:
    words, lines, current = text.split(), [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= width:
            current = candidate
            continue
        lines.append(current)
        current = word
        if len(lines) == max_lines:
            break
    if len(lines) < max_lines and current:
        lines.append(current)
    if len(lines) == max_lines and " ".join(lines) != " ".join(words):
        lines[-1] = _truncate(draw, lines[-1] + " …", font, width)
    return lines


def render_share_card(observation: str, series: list[dict], period: str) -> bytes:
    """series: [{ticker, name, points: list[PricePoint], benchmark: bool}] — already filtered to what to show."""
    s = SCALE
    image = Image.new("RGB", (W * s, H * s), BG)
    draw = ImageDraw.Draw(image)
    serif, serif_i, mono, sans = "LiberationSerif-Regular.ttf", "LiberationSerif-Italic.ttf", "LiberationMono-Regular.ttf", "LiberationSans-Regular.ttf"

    # Header
    word = _font(serif, 34)
    draw.text((56 * s, 40 * s), "Aaspaas", font=word, fill=INK)
    draw.text((56 * s + draw.textlength("Aaspaas", font=word), 40 * s), ".", font=word, fill=MARIGOLD)
    label = f"HOW THESE STOCKS TRAVELLED · {period} · REBASED TO 0%"
    small_mono = _font(mono, 13)
    draw.text(((W - 56) * s - draw.textlength(label, font=small_mono), 54 * s), label, font=small_mono, fill=MARIGOLD)
    quote_font = _font(serif_i, 30)
    for index, line in enumerate(_wrap(draw, f"“{observation}”", quote_font, 1088 * s, 2)):
        draw.text((56 * s, (100 + index * 38) * s), line, font=quote_font, fill=INK)

    # Chart panel
    left, top, right, bottom = 56, 196, 800, 548
    draw.rectangle((left * s, top * s, right * s, bottom * s), fill=PANEL, outline="#34363a", width=s)
    plot_l, plot_t, plot_r, plot_b = left + 58, top + 22, right - 22, bottom - 34
    rebased = []
    for index, item in enumerate(series):
        pts = points_for_period(item["points"], period)
        if len(pts) < 2:
            continue
        base = pts[0].adjusted_close
        values = [(datetime.fromisoformat(p.date).timestamp(), (p.adjusted_close / base - 1) * 100) for p in pts]
        color = BENCH if item.get("benchmark") else SERIES_COLORS[index % len(SERIES_COLORS)]
        rebased.append({**item, "values": values, "color": color, "end": values[-1][1]})
    tick_font = _font(mono, 12)
    if rebased:
        t_min = min(r["values"][0][0] for r in rebased)
        t_max = max(r["values"][-1][0] for r in rebased)
        all_pct = [v for r in rebased for _, v in r["values"]]
        lo, hi = min(0.0, *all_pct), max(0.0, *all_pct)
        pad = max((hi - lo) * 0.08, 2)
        lo, hi = lo - pad, hi + pad

        def xy(t: float, v: float) -> tuple[float, float]:
            x = plot_l + (t - t_min) / max(t_max - t_min, 1) * (plot_r - plot_l)
            y = plot_t + (1 - (v - lo) / max(hi - lo, 1e-6)) * (plot_b - plot_t)
            return x * s, y * s

        raw_step = max((hi - lo) / 4, 1e-6)
        magnitude = 10 ** math.floor(math.log10(raw_step))
        step = next(m * magnitude for m in (1, 2, 2.5, 5, 10) if m * magnitude >= raw_step)
        if math.floor(hi / step) - math.ceil(lo / step) + 1 < 3:
            step /= 2
        tick = (lo // step + 1) * step
        while tick <= hi:
            _, y = xy(t_min, tick)
            if tick == 0:
                for x0 in range(plot_l * s, plot_r * s, 12 * s):
                    draw.line((x0, y, x0 + 6 * s, y), fill="#5a5c60", width=s)
            else:
                draw.line((plot_l * s, y, plot_r * s, y), fill=GRID, width=s)
            text = f"{'+' if tick > 0 else ''}{tick:g}%"
            draw.text(((plot_l - 10) * s - draw.textlength(text, font=tick_font), y - 7 * s), text, font=tick_font, fill=MUTED)
            tick += step
        for t, anchor in ((t_min, "l"), (t_max, "r")):
            text = datetime.fromtimestamp(t, timezone.utc).strftime("%b %Y")
            x, _ = xy(t, 0)
            draw.text((x - (draw.textlength(text, font=tick_font) if anchor == "r" else 0), (plot_b + 12) * s), text, font=tick_font, fill=MUTED)
        for item in sorted(rebased, key=lambda r: not r.get("benchmark")):  # benchmark underneath
            every = max(1, len(item["values"]) // 420)
            coords = [xy(t, v) for i, (t, v) in enumerate(item["values"]) if i % every == 0 or i == len(item["values"]) - 1]
            if item.get("benchmark"):
                for i in range(0, len(coords) - 1, 2):
                    draw.line((coords[i], coords[i + 1]), fill=item["color"], width=2 * s)
            else:
                draw.line(coords, fill=item["color"], width=3 * s, joint="curve")
            ex, ey = coords[-1]
            draw.ellipse((ex - 5 * s, ey - 5 * s, ex + 5 * s, ey + 5 * s), fill=item["color"])
    else:
        msg = "Price history unavailable right now — no movement is estimated."
        font = _font(sans, 16)
        draw.text((((left + right) / 2) * s - draw.textlength(msg, font=font) / 2, ((top + bottom) / 2) * s), msg, font=font, fill=MUTED)

    # Legend
    legend_x, y = 836, 204
    draw.text((legend_x * s, y * s), "TOTAL ADJUSTED MOVE", font=small_mono, fill=MUTED)
    y += 30
    name_font, pct_font, tick_label = _font(sans, 14), _font(serif, 30), _font(mono, 14)
    row = min(84, (556 - y) // max(len(rebased[:5]), 1))
    for item in rebased[:5]:
        draw.rectangle((legend_x * s, (y + 8) * s, (legend_x + 22) * s, (y + 11) * s), fill=item["color"])
        draw.text(((legend_x + 32) * s, y * s), item["ticker"], font=tick_label, fill=INK)
        pct = item["end"]
        pct_text = f"{'+' if pct >= 0 else ''}{pct:.1f}%"
        draw.text(((W - 56) * s - draw.textlength(pct_text, font=pct_font), (y - 6) * s), pct_text, font=pct_font, fill=GAIN if pct >= 0 else LOSS)
        draw.text((legend_x * s, (y + 24) * s), _truncate(draw, item["name"], name_font, 300 * s), font=name_font, fill=MUTED)
        if row >= 70:
            draw.line((legend_x * s, (y + row - 14) * s, (W - 56) * s, (y + row - 14) * s), fill="#2a2c2f", width=s)
        y += row

    # Footer disclaimer
    foot = _font(mono, 12)
    draw.line((56 * s, 572 * s, (W - 56) * s, 572 * s), fill="#2e3034", width=s)
    draw.text((56 * s, 586 * s), "EDUCATIONAL CONTEXT, NOT A RECOMMENDATION TO BUY OR SELL · AASPAAS NEVER PLACES TRADES", font=foot, fill=MUTED)
    draw.text((56 * s, 604 * s), "SOURCE: YAHOO FINANCE DAILY ADJUSTED CLOSE · DATA MAY BE DELAYED OR INCOMPLETE · PAST MOVEMENT IS NOT A PREDICTION", font=foot, fill="#696b6f")

    output = BytesIO()
    image.resize((W, H), Image.LANCZOS).save(output, format="PNG", optimize=True)
    return output.getvalue()
