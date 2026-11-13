#!/usr/bin/env python3
"""Draw the Unlimited app icon: a bold white "U" with a spark, on a cyan-violet-pink tile.

Original artwork. Outputs (committed, so the build never needs Python):
  src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.png,icon.ico}
  public/favicon.svg, branding/logo-icon.svg
Usage: python branding/make_icon.py        Needs Pillow and numpy.
"""
from __future__ import annotations

import io
import math
import pathlib
import struct

import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
STOPS = [(0.0, (34, 211, 238)), (0.55, (139, 92, 246)), (1.0, (244, 114, 182))]  # cyan, violet, pink
RADIUS = 58
U_PATH = "M80 64V136A48 48 0 0 0 176 136V64"
U_WIDTH = 30
STAR = (128, 92, 19)  # cx, cy, r


def star_points(cx: float, cy: float, r: float) -> list[tuple[float, float]]:
    k = 0.24
    return [(cx, cy - r), (cx + r * k, cy - r * k), (cx + r, cy), (cx + r * k, cy + r * k),
            (cx, cy + r), (cx - r * k, cy + r * k), (cx - r, cy), (cx - r * k, cy - r * k)]


def icon_svg() -> str:
    stops = "".join(f'<stop offset="{o}" stop-color="rgb{c}"/>' for o, c in STOPS).replace(" ", "")
    star = " ".join(f"{x:.1f},{y:.1f}" for x, y in star_points(*STAR))
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><title>Unlimited</title>'
        f'<defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1">{stops}</linearGradient></defs>'
        f'<rect width="256" height="256" rx="{RADIUS}" fill="url(#t)"/>'
        f'<path d="{U_PATH}" fill="none" stroke="#fff" stroke-width="{U_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<polygon points="{star}" fill="#fff"/></svg>\n'
    )


def gradient(S: int) -> Image.Image:
    ys, xs = np.mgrid[0:S, 0:S].astype(np.float32)
    t = (xs + ys) / (2 * (S - 1))
    out = np.zeros((S, S, 3), np.float32)
    for (o0, c0), (o1, c1) in zip(STOPS, STOPS[1:]):
        m = (t >= o0) & (t <= o1)
        f = ((t - o0) / (o1 - o0))[..., None]
        out = np.where(m[..., None], np.array(c0, np.float32) * (1 - f) + np.array(c1, np.float32) * f, out)
    return Image.fromarray(np.concatenate([out, np.full((S, S, 1), 255, np.float32)], axis=2).astype(np.uint8), "RGBA")


def render(size: int) -> Image.Image:
    S = size * 4
    k = S / 256
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=RADIUS * k, fill=255)
    canvas.paste(gradient(S), (0, 0), mask)

    pts = [(80, 64), (80, 136)]
    pts += [(128 - 48 * math.cos(a), 136 + 48 * math.sin(a)) for a in np.linspace(0, math.pi, 40)]
    pts += [(176, 136), (176, 64)]
    px = [(x * k, y * k) for x, y in pts]
    d = ImageDraw.Draw(canvas)
    w = U_WIDTH * k
    for (x0, y0), (x1, y1) in zip(px, px[1:]):
        steps = max(int(math.hypot(x1 - x0, y1 - y0) / (w / 6)), 1)
        for i in range(steps + 1):  # stamp round dots along the path: clean joins and caps
            x, y = x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps
            d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill="white")
    d.polygon([(x * k, y * k) for x, y in star_points(*STAR)], fill="white")
    return canvas.resize((size, size), Image.LANCZOS)


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def ico(sizes: list[int]) -> bytes:
    frames = [(s, png_bytes(render(s))) for s in sizes]
    head = struct.pack("<HHH", 0, 1, len(frames))
    off = 6 + 16 * len(frames)
    ent, blob = b"", b""
    for s, data in frames:
        ent += struct.pack("<BBBBHHII", 0 if s >= 256 else s, 0 if s >= 256 else s, 0, 0, 1, 32, len(data), off)
        blob += data
        off += len(data)
    return head + ent + blob


def write(path: pathlib.Path, data: bytes | str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data) if isinstance(data, bytes) else path.write_text(data, encoding="utf-8", newline="\n")
    print("wrote", path.relative_to(ROOT))


def main() -> None:
    icons = ROOT / "src-tauri" / "icons"
    for name, size in (("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256), ("icon.png", 512)):
        write(icons / name, png_bytes(render(size)))
    write(icons / "icon.ico", ico([16, 24, 32, 48, 64, 128, 256]))
    write(ROOT / "public" / "favicon.svg", icon_svg())
    write(ROOT / "branding" / "logo-icon.svg", icon_svg())


if __name__ == "__main__":
    main()
