"""Render the blip8 label's art from real blip8 samples.

The waveform is the logo, so nothing here is drawn by hand: every trace is a
sound the library actually makes, plotted the way an audio editor plots it. Each
product gets its own sound. The cover is the data.

Draws at half size and upscales 2x nearest neighbour, same as
win95-mode/scripts/itch_cover.py, so the pixels stay chunky.

Run: uv run scripts/covers.py
Output: assets/ (itch covers, GitHub social previews) and public/ (the favicon
the site and itch both serve).
"""

# /// script
# requires-python = ">=3.12"
# dependencies = ["blip8>=0.1.0", "pillow>=11.0"]
# ///

from pathlib import Path

import numpy as np
from blip8 import envelope, melody, sequence, square
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
COVERS = ROOT / "assets"
SITE = ROOT / "public"

# The Game Boy pea-soup ramp, deepened: the same values as the lab's CSS.
INK = "#071007"
SCREEN_BG = "#050b05"
GRID = "#1c4a1c"
LINE = "#306230"
DIM = "#8bac0f"
LIT = "#9bbc0f"

# The first that loads wins; edit for another machine.
FONTS = [
    ("/System/Library/Fonts/Menlo.ttc", 1, 0),  # path, bold index, plain index
    ("/System/Library/Fonts/Supplemental/Andale Mono.ttf", 0, 0),
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for path, bold_index, plain_index in FONTS:
        try:
            return ImageFont.truetype(path, size, index=bold_index if bold else plain_index)
        except OSError:
            continue
    raise SystemExit("no monospace font found: edit FONTS for this machine")


# Each product plots its own sound. Four exact cycles, so the trace ends where
# a cycle does.
SQUARE_WAVE = square(freq=50, length=0.08, volume=0.9)

COIN = sequence(
    envelope(square(freq=988, length=0.07, volume=0.4), attack=0.001, release=0.01),
    envelope(square(freq=1319, length=0.32, volume=0.4), attack=0.001, release=0.2),
)

WIN_JINGLE = melody("C5 E5 G5 C6", bpm=200)


# ---------------------------------------------------------------- drawing


def screen(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    """The oscilloscope face: dark glass, phosphor grid, brighter centre line."""
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=SCREEN_BG, outline=LINE)
    for i in range(1, 8):
        x = x0 + round((x1 - x0) * i / 8)
        d.line([(x, y0 + 1), (x, y1 - 1)], fill=GRID)
    for i in range(1, 4):
        y = y0 + round((y1 - y0) * i / 4)
        d.line([(x0 + 1, y), (x1 - 1, y)], fill=GRID)
    mid = (y0 + y1) // 2
    d.line([(x0 + 1, mid), (x1 - 1, mid)], fill=LINE)


def waveform(
    d: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    samples: np.ndarray,
    thickness: int = 1,
) -> None:
    """Min/max per pixel column, the same way the lab's scope.ts draws it."""
    x0, y0, x1, y1 = box
    width = x1 - x0 + 1
    mid = (y0 + y1) / 2
    scale = (y1 - y0) / 2 * 0.88
    peak = float(np.max(np.abs(samples))) or 1.0
    edges = np.linspace(0, len(samples), width + 1).astype(int)

    for i in range(width):
        chunk = samples[edges[i] : max(edges[i] + 1, edges[i + 1])]
        top = mid - float(chunk.max()) / peak * scale
        bottom = mid - float(chunk.min()) / peak * scale
        if bottom - top < thickness:
            centre = (top + bottom) / 2
            top, bottom = centre - thickness / 2, centre + thickness / 2
        d.rectangle([x0 + i, round(top), x0 + i, round(bottom)], fill=LIT)


def wordmark(
    d: ImageDraw.ImageDraw, xy: tuple[int, int], name: str, suffix: str, size: int
) -> None:
    """blip8 in the bright green, the product word after it in the dimmer one."""
    x, y = xy
    bold = font(size, bold=True)
    d.text((x, y), name, font=bold, fill=LIT)
    if suffix:
        d.text((x + d.textlength(name + " ", font=bold), y), suffix, font=bold, fill=DIM)


def save_at(img: Image.Image, target: Path, factor: int = 2) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    final = img.resize((img.width * factor, img.height * factor), Image.NEAREST)
    final.save(target)
    print(f"  {target.relative_to(ROOT)}  {final.width}x{final.height}")


# ---------------------------------------------------------------- layouts


def itch_cover(name: str, suffix: str, tagline: str, samples: np.ndarray, target: Path) -> None:
    """630x500 for itch, drawn at 315x250."""
    img = Image.new("RGB", (315, 250), INK)
    d = ImageDraw.Draw(img)

    wordmark(d, (18, 20), name, suffix, 26)
    d.text((18, 54), tagline, font=font(10), fill=LINE)

    box = (18, 84, 296, 196)
    screen(d, box)
    waveform(d, (box[0] + 2, box[1] + 6, box[2] - 2, box[3] - 6), samples, thickness=2)

    d.text((18, 210), "generated from code, not recorded", font=font(10), fill=LINE)
    d.text((18, 226), "sindriax.dev", font=font(10, bold=True), fill=DIM)
    save_at(img, target)


def social_preview(name: str, suffix: str, tagline: str, samples: np.ndarray, target: Path) -> None:
    """1280x640 for GitHub, drawn at 640x320: the same rig, wider."""
    img = Image.new("RGB", (640, 320), INK)
    d = ImageDraw.Draw(img)

    wordmark(d, (40, 38), name, suffix, 34)
    d.text((40, 82), tagline, font=font(12), fill=LINE)

    box = (40, 118, 600, 246)
    screen(d, box)
    waveform(d, (box[0] + 2, box[1] + 8, box[2] - 2, box[3] - 8), samples, thickness=2)

    d.text((40, 266), "generated from code, not recorded", font=font(12), fill=LINE)
    d.text((40, 288), "sindriax.dev", font=font(12, bold=True), fill=DIM)
    save_at(img, target)


def favicon() -> None:
    """One square-wave pulse at 16px: two cycles read as noise at this size."""
    img = Image.new("RGB", (16, 16), INK)
    d = ImageDraw.Draw(img)
    top, bottom, rise, fall = 4, 10, 4, 10
    for segment in [
        (1, bottom, rise + 1, bottom + 1),
        (rise, top, rise + 1, bottom + 1),
        (rise, top, fall + 1, top + 1),
        (fall, top, fall + 1, bottom + 1),
        (fall, bottom, 14, bottom + 1),
    ]:
        d.rectangle(segment, fill=LIT)
    save_at(img, SITE / "favicon-32.png", factor=2)
    save_at(img, SITE / "favicon-16.png", factor=1)
    # itch and the domain both take an .ico; one file covers both sizes.
    ico = SITE / "favicon.ico"
    img.resize((32, 32), Image.NEAREST).save(ico, sizes=[(16, 16), (32, 32)])
    print(f"  {ico.relative_to(ROOT)}  16x16 + 32x32")


# ---------------------------------------------------------------- render

PRODUCTS = [
    ("lab", "blip8", "lab", "8-bit sound maker, in your browser", SQUARE_WAVE),
    ("sounds", "blip8", "sounds", "chiptune SFX packs, CC0", COIN),
    ("blip8", "blip8", "", "chiptune synthesis from code", WIN_JINGLE),
]


def main() -> None:
    print("itch covers:")
    for key, name, suffix, tagline, samples in PRODUCTS:
        if key == "blip8":
            continue  # no itch page for the library
        itch_cover(name, suffix, tagline, samples, COVERS / f"blip8-{key}-cover.png")

    print("github social previews:")
    for key, name, suffix, tagline, samples in PRODUCTS:
        social_preview(name, suffix, tagline, samples, COVERS / f"blip8-{key}-social.png")

    print("favicon:")
    favicon()


if __name__ == "__main__":
    main()
