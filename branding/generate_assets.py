#!/usr/bin/env python3
"""Generate every Unlimited brand asset from one set of shapes.

Original artwork: a bold, forward-leaning "U" with speed streaks trailing behind it.
Two icon variants share the idea:
  * full   - used at 64 px and above (4 streaks, finer detail)
  * small  - used at 48 px and below (2 thick streaks, bolder L) so it stays readable

Outputs (all committed, so the build never needs Python):
  src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.png,icon.ico}
  public/favicon.svg
  branding/logo-icon.svg, logo-icon-small.svg, wordmark.svg
  src/branding/logo.generated.ts   (shapes used by the React Logo component)

Usage:  python branding/generate_assets.py [--preview DIR]
Needs:  Pillow and numpy.
"""
from __future__ import annotations

import argparse
import io
import json
import pathlib
import struct

import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Brand colours
NAVY_TOP = "#2A1D55"  # tile top (deep violet)
NAVY_BOTTOM = "#0C0816"  # tile bottom (near black)
BLUE = "#7C5CD6"  # accent purple
BLUE_BRIGHT = "#A78BFA"  # bright accent
WHITE = "#FFFFFF"

SKEW = 0.18  # forward lean, shared by the icon and the wordmark


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


# ---------------------------------------------------------------- icon shapes
def lean(x: float, y: float, base: float, dx: float) -> tuple[float, float]:
    return (x + (base - y) * SKEW + dx, y)


def build_variant(name: str) -> dict:
    if name == "full":
        radius, base, dx = 58, 198, 17
        l_raw = [(84, 56), (126, 56), (126, 154), (162, 154), (162, 56), (204, 56), (204, 170), (176, 198), (112, 198), (84, 170)]
        stem_left = 84
        streaks_raw = [(70, 14, 26), (97, 14, 48), (124, 14, 12), (151, 14, 38)]  # y, height, x start
        alpha_start = 0.12
    else:  # small
        radius, base, dx = 64, 206, 0
        l_raw = [(70, 42), (118, 42), (118, 148), (158, 148), (158, 42), (206, 42), (206, 176), (176, 206), (100, 206), (70, 176)]
        stem_left = 70
        streaks_raw = [(66, 24, 20), (112, 24, 38)]
        alpha_start = 0.35

    gap = 10
    xe = stem_left - gap
    streaks = []
    for y, h, xs in streaks_raw:
        pts = [(xs + 12, y), (xe, y), (xe, y + h), (xs, y + h)]  # tapered tip on the left
        leaned = [lean(px, py, base, dx) for px, py in pts]
        xs_all = [p[0] for p in leaned]
        streaks.append({"points": leaned, "x1": min(xs_all), "x2": max(xs_all), "alpha_start": alpha_start})
    return {
        "name": name,
        "radius": radius,
        "l": [lean(px, py, base, dx) for px, py in l_raw],
        "streaks": streaks,
    }


VARIANTS = {n: build_variant(n) for n in ("full", "small")}


def fmt_pts(pts) -> str:
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)


# ------------------------------------------------------------------ SVG output
def icon_svg(variant: dict, uid: str = "") -> str:
    v = variant
    defs = [
        f'<linearGradient id="tile{uid}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{NAVY_TOP}"/><stop offset="1" stop-color="{NAVY_BOTTOM}"/></linearGradient>'
    ]
    body = [f'<rect width="256" height="256" rx="{v["radius"]}" fill="url(#tile{uid})"/>']
    for i, s in enumerate(v["streaks"]):
        defs.append(
            f'<linearGradient id="s{i}{uid}" gradientUnits="userSpaceOnUse" x1="{s["x1"]:.2f}" y1="0" x2="{s["x2"]:.2f}" y2="0">'
            f'<stop offset="0" stop-color="{BLUE}" stop-opacity="{s["alpha_start"]}"/>'
            f'<stop offset="1" stop-color="{BLUE_BRIGHT}"/></linearGradient>'
        )
        body.append(f'<polygon points="{fmt_pts(s["points"])}" fill="url(#s{i}{uid})"/>')
    body.append(f'<polygon points="{fmt_pts(v["l"])}" fill="{WHITE}"/>')
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'
        f'<title>Unlimited</title><defs>{"".join(defs)}</defs>{"".join(body)}</svg>\n'
    )


# --------------------------------------------------------------- PNG rendering
def vertical_gradient(w: int, h: int, top: str, bottom: str) -> Image.Image:
    t = np.array(hex_rgb(top), dtype=np.float32)
    b = np.array(hex_rgb(bottom), dtype=np.float32)
    ramp = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    arr = (t * (1 - ramp) + b * ramp).repeat(w, axis=1)
    alpha = np.full((h, w, 1), 255, dtype=np.float32)
    return Image.fromarray(np.concatenate([arr, alpha], axis=2).astype(np.uint8), "RGBA")


def render(variant: dict, size: int) -> Image.Image:
    ss = 4  # supersample for clean edges
    S = size * ss
    k = S / 256.0

    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    tile_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(tile_mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=variant["radius"] * k, fill=255)
    canvas.paste(vertical_gradient(S, S, NAVY_TOP, NAVY_BOTTOM), (0, 0), tile_mask)

    c0, c1 = np.array(hex_rgb(BLUE), np.float32), np.array(hex_rgb(BLUE_BRIGHT), np.float32)
    for s in variant["streaks"]:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).polygon([(x * k, y * k) for x, y in s["points"]], fill=255)
        xs = (np.arange(S, dtype=np.float32) / k - s["x1"]) / max(s["x2"] - s["x1"], 1e-6)
        t = np.clip(xs, 0, 1)[None, :, None]
        rgb = c0 * (1 - t) + c1 * t
        a = (s["alpha_start"] + (1 - s["alpha_start"]) * t) * 255
        layer = np.concatenate([np.repeat(rgb, S, axis=0), np.repeat(a, S, axis=0)], axis=2).astype(np.uint8)
        layer_img = Image.fromarray(layer, "RGBA")
        layer_img.putalpha(Image.fromarray((np.array(layer_img.getchannel("A"), np.float32) * np.array(mask, np.float32) / 255).astype(np.uint8)))
        canvas = Image.alpha_composite(canvas, layer_img)

    l_layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(l_layer).polygon([(x * k, y * k) for x, y in variant["l"]], fill=(*hex_rgb(WHITE), 255))
    canvas = Image.alpha_composite(canvas, l_layer)

    return canvas.resize((size, size), Image.LANCZOS)


def variant_for(size: int) -> dict:
    return VARIANTS["small"] if size <= 48 else VARIANTS["full"]


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def build_ico(sizes: list[int]) -> bytes:
    frames = [(s, png_bytes(render(variant_for(s), s))) for s in sizes]
    header = struct.pack("<HHH", 0, 1, len(frames))
    offset = 6 + 16 * len(frames)
    entries, blobs = b"", b""
    for s, data in frames:
        entries += struct.pack("<BBBBHHII", 0 if s >= 256 else s, 0 if s >= 256 else s, 0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)
    return header + entries + blobs


# -------------------------------------------------------------------- wordmark
T = 2.4  # stroke weight on a 10-unit cap height


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


GLYPHS: dict[str, tuple[float, list]] = {
    "U": (7.2, [rect(0, 0, T, 10), rect(7.2 - T, 0, 7.2, 10), rect(T, 10 - T, 7.2 - T, 10)]),
    "N": (7.8, [[(0, 0), (2.4, 0), (5.4, 5.6), (5.4, 0), (7.8, 0), (7.8, 10), (5.4, 10), (2.4, 4.4), (2.4, 10), (0, 10)]]),
    "L": (6.2, [rect(0, 0, T, 10), rect(T, 10 - T, 6.2, 10)]),
    "I": (T, [rect(0, 0, T, 10)]),
    "M": (9.6, [[(0, 0), (2.6, 0), (4.8, 4.4), (7.0, 0), (9.6, 0), (9.6, 10), (7.2, 10), (7.2, 4.6),
                 (5.5, 8.0), (4.1, 8.0), (2.4, 4.6), (2.4, 10), (0, 10)]]),
    "T": (7.6, [rect(0, 0, 7.6, T), rect(2.6, T, 5.0, 10)]),
    "E": (6.2, [rect(0, 0, T, 10), rect(T, 0, 6.2, T), rect(T, 3.8, 5.6, 6.2), rect(T, 10 - T, 6.2, 10)]),
    "D": (7.4, [[(0, 0), (4.4, 0), (7.4, 2.6), (7.4, 7.4), (4.4, 10), (0, 10)],
                [(T, T), (3.9, T), (5.0, 3.4), (5.0, 6.6), (3.9, 7.6), (T, 7.6)]]),
    "F": (6.2, [rect(0, 0, T, 10), rect(T, 0, 6.2, T), rect(T, 3.8, 5.4, 6.2)]),
    "P": (7.2, [[(0, 0), (4.8, 0), (7.2, 2.2), (7.2, 5.2), (4.8, 7.4), (T, 7.4), (T, 10), (0, 10)],
                [(T, T), (4.2, T), (4.8, 3.0), (4.8, 4.4), (4.2, 5.0), (T, 5.0)]]),
    "S": (7.0, [rect(0, 0, 7.0, T), rect(0, T, T, 3.8), rect(0, 3.8, 7.0, 6.2),
                rect(4.6, 6.2, 7.0, 7.6), rect(0, 7.6, 7.0, 10)]),
}


def word_path(text: str, start_x: float) -> tuple[str, float]:
    """Return an SVG path (even-odd) for the word and the x position where it ends."""
    x = start_x
    parts = []
    for ch in text:
        w, polys = GLYPHS[ch]
        for poly in polys:
            pts = [(px + x + (10 - py) * SKEW, py) for px, py in poly]
            parts.append("M" + " L".join(f"{px:.2f},{py:.2f}" for px, py in pts) + "Z")
        x += w + 2.0
    return "".join(parts), x - 2.0


def build_wordmark() -> dict:
    accent, end = word_path("UN", 0.0)
    plain, end2 = word_path("LIMITED", end + 2.0)
    width = end2 + 10 * SKEW + 2.5
    return {"viewBox": f"-0.5 -0.5 {width:.2f} 11", "accent": accent, "plain": plain, "width": width}


def wordmark_svg(w: dict) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{w["viewBox"]}" height="40">'
        "<title>Unlimited</title>"
        f'<defs><linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{BLUE}"/>'
        f'<stop offset="1" stop-color="{BLUE_BRIGHT}"/></linearGradient></defs>'
        f'<path fill="url(#acc)" fill-rule="evenodd" d="{w["accent"]}"/>'
        f'<path fill="{WHITE}" fill-rule="evenodd" d="{w["plain"]}"/></svg>\n'
    )


# ------------------------------------------------------------------------ main
def write(path: pathlib.Path, data: bytes | str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        path.write_text(data, encoding="utf-8", newline="\n")
    else:
        path.write_bytes(data)
    print("wrote", path.relative_to(ROOT))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="also write preview PNGs of every size into this folder")
    args = ap.parse_args()

    icons = ROOT / "src-tauri" / "icons"
    for fname, size in (("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256), ("icon.png", 512)):
        write(icons / fname, png_bytes(render(variant_for(size), size)))
    write(icons / "icon.ico", build_ico([16, 24, 32, 48, 64, 128, 256]))

    write(ROOT / "branding" / "logo-icon.svg", icon_svg(VARIANTS["full"]))
    write(ROOT / "branding" / "logo-icon-small.svg", icon_svg(VARIANTS["small"]))
    word = build_wordmark()
    write(ROOT / "branding" / "wordmark.svg", wordmark_svg(word))
    write(ROOT / "public" / "favicon.svg", icon_svg(VARIANTS["small"]))

    ts = {
        "colors": {"tileTop": NAVY_TOP, "tileBottom": NAVY_BOTTOM, "accent": BLUE, "accentBright": BLUE_BRIGHT, "white": WHITE},
        "variants": {
            n: {
                "radius": v["radius"],
                "l": fmt_pts(v["l"]),
                "streaks": [
                    {"points": fmt_pts(s["points"]), "x1": round(s["x1"], 2), "x2": round(s["x2"], 2), "alphaStart": s["alpha_start"]}
                    for s in v["streaks"]
                ],
            }
            for n, v in VARIANTS.items()
        },
        "wordmark": {"viewBox": word["viewBox"], "accent": word["accent"], "plain": word["plain"]},
    }
    write(
        ROOT / "src" / "branding" / "logo.generated.ts",
        "// Generated by branding/generate_assets.py. Do not edit by hand.\n"
        f"export const LOGO = {json.dumps(ts, indent=2)} as const;\n",
    )

    if args.preview:
        out = pathlib.Path(args.preview)
        out.mkdir(parents=True, exist_ok=True)
        for s in (16, 24, 32, 48, 64, 128, 256, 512):
            render(variant_for(s), s).save(out / f"icon-{s}.png")
        print("previews in", out)


if __name__ == "__main__":
    main()
