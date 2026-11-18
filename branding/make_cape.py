#!/usr/bin/env python3
"""Draw the original Cirrus Cloud cape texture (64 x 32, Minecraft cape layout).

The cape's back face lives at (1, 1) and is 10 x 16 pixels; the inside face is
at (12, 1). Only the back is ever seen in the launcher, but both are painted so
the texture is valid if it is ever used elsewhere.

Usage: python branding/make_cape.py        Needs Pillow and numpy.
Output: src/assets/capes/cirrus.png
"""
from __future__ import annotations

import pathlib

import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "assets" / "capes" / "cirrus.png"

TOP = (24, 41, 74)      # deep night blue at the shoulders
BOTTOM = (12, 18, 34)   # darker hem
CLOUD = (232, 240, 255)
STAR = (255, 255, 255)


def gradient(width: int, height: int) -> Image.Image:
    rows = np.linspace(0.0, 1.0, height)[:, None]
    top = np.array(TOP, dtype=float)
    bottom = np.array(BOTTOM, dtype=float)
    field = top + (bottom - top) * rows
    field = np.repeat(field[:, None, :], width, axis=1)
    return Image.fromarray(field.astype(np.uint8), "RGB")


def paint_face(draw: ImageDraw.ImageDraw, x: int, y: int, inside: bool) -> None:
    """A cloud over a night sky, drawn at 1:1 so it stays crisp at skin scale."""
    sky = (28, 46, 80) if inside else (24, 41, 74)
    draw.rectangle((x, y, x + 9, y + 15), fill=sky)
    # Cloud: three lobes and a flat base, centred in the upper half.
    cloud = (200, 214, 238) if inside else CLOUD
    draw.rectangle((x + 2, y + 6, x + 8, y + 9), fill=cloud)
    draw.rectangle((x + 3, y + 4, x + 5, y + 6), fill=cloud)
    draw.rectangle((x + 6, y + 3, x + 8, y + 6), fill=cloud)
    draw.rectangle((x + 1, y + 7, x + 2, y + 9), fill=cloud)
    draw.rectangle((x + 8, y + 7, x + 9, y + 9), fill=cloud)
    # Three stars, fixed positions so the texture is reproducible.
    for sx, sy in ((1, 1), (8, 1), (1, 12)):
        draw.point((x + sx, y + sy), fill=STAR)
    # A soft fold near the hem.
    draw.rectangle((x + 1, y + 13, x + 8, y + 14), fill=(18, 28, 50) if not inside else (22, 36, 64))


def main() -> None:
    sheet = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    sheet.paste(gradient(10, 16), (1, 1))
    draw = ImageDraw.Draw(sheet)
    paint_face(draw, 1, 1, inside=False)
    paint_face(draw, 12, 1, inside=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, format="PNG", optimize=True)
    print("wrote", OUT.relative_to(ROOT), OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
