"""Portrait 1080×1350 cards (Instagram-ready; also used as link-preview images). Pillow only."""
import io
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONTS = Path(__file__).resolve().parent.parent / "assets" / "fonts"
PAPER, INK, MUTED, MARIGOLD, INDIGO = "#f4f2ec", "#1b1a16", "#6e6b63", "#b8752a", "#5b4b8a"


def _font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


def render_portrait(kicker: str, title: str, body: str, chips: list[str], footer: str) -> bytes:
    image = Image.new("RGB", (1080, 1350), PAPER)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1080, 14), fill=MARIGOLD)
    draw.text((80, 90), "Aaspaas.", font=_font("LiberationSerif-Regular.ttf", 56), fill=INK)
    draw.text((80, 210), kicker.upper(), font=_font("LiberationMono-Regular.ttf", 30), fill=MARIGOLD)
    y = 280
    for line in textwrap.wrap(title, 22)[:5]:
        draw.text((80, y), line, font=_font("LiberationSerif-Regular.ttf", 84), fill=INK)
        y += 100
    y += 30
    draw.rectangle((80, y, 86, y + 40 * min(len(textwrap.wrap(body, 44)), 7)), fill=INDIGO)
    for line in textwrap.wrap(body, 44)[:7]:
        draw.text((110, y), line, font=_font("LiberationSans-Regular.ttf", 34), fill=INK)
        y += 46
    x, y = 80, max(y + 40, 1060)
    for chip in chips[:5]:
        width = draw.textlength(chip, font=_font("LiberationMono-Regular.ttf", 30)) + 40
        if x + width > 1000:
            break
        draw.rectangle((x, y, x + width, y + 58), outline=INK, width=2)
        draw.text((x + 20, y + 12), chip, font=_font("LiberationMono-Regular.ttf", 30), fill=INK)
        x += width + 16
    draw.text((80, 1220), footer, font=_font("LiberationMono-Regular.ttf", 24), fill=MUTED)
    draw.text((80, 1262), "Educational context · not a recommendation to buy or sell", font=_font("LiberationMono-Regular.ttf", 22), fill=MUTED)
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()
