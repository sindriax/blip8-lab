"""Cut Echo and the wordmark out of the brand original and size them for the web.

Source lives in blip8-sounds/brand/. The output is committed, so the build never
needs the sibling repo; re-run only when the artwork changes.

Run: uv run scripts/sprites.py
"""

# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow>=11.0"]
# ///

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT.parent / "blip8-sounds/brand/echo-lab.png"
SITE = ROOT / "public"

# Boxes measured on the 1608x1590 original.
BAT = (95, 125, 1465, 1178)
TITLE = (140, 1205, 1465, 1500)

BAT_WIDTH = 320
TITLE_WIDTH = 420
COLORS = 64

# The artwork's own grid backdrop comes with the crop and reads as a rectangle on
# the page, so it gets keyed out from the corners inward.
KEY = (255, 0, 255)
KEY_THRESHOLD = 60


def cut_background(img: Image.Image) -> Image.Image:
    flat = img.convert("RGB")
    drawer = ImageDraw.Draw(flat)
    for corner in [(0, 0), (flat.width - 1, 0), (0, flat.height - 1), (flat.width - 1, flat.height - 1)]:
        ImageDraw.floodfill(flat, corner, KEY, thresh=KEY_THRESHOLD)
    del drawer

    out = flat.convert("RGBA")
    pixels = out.load()
    for y in range(out.height):
        for x in range(out.width):
            if pixels[x, y][:3] == KEY:
                pixels[x, y] = (0, 0, 0, 0)
    return out


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing {SOURCE}\nEcho's originals live in blip8-sounds/brand/")

    original = Image.open(SOURCE).convert("RGB")
    SITE.mkdir(parents=True, exist_ok=True)

    for name, box, width in [("echo", BAT, BAT_WIDTH), ("wordmark", TITLE, TITLE_WIDTH)]:
        piece = cut_background(original.crop(box))
        # Not NEAREST: the shrink is not a whole-number ratio and would tear.
        height = round(piece.height * width / piece.width)
        small = piece.resize((width, height), Image.LANCZOS)
        # FASTOCTREE is the quantizer that keeps an alpha channel.
        reduced = small.quantize(colors=COLORS, method=Image.Quantize.FASTOCTREE)
        target = SITE / f"{name}.png"
        reduced.save(target, optimize=True)
        print(f"{target.relative_to(ROOT)}  {width}x{height}  {target.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
