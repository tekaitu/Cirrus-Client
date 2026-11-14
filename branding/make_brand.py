#!/usr/bin/env python3
"""Build every logo file from the three source images in branding/source/.

  mark.png       white cloud-and-stars mark on a transparent background
  icon-art.png   the cloud-and-leaf emblem, white on black (the app icon)
  wordmark.png   "Cirrus Client" lettering, white on black

Outputs (committed, so the build never needs Python):
  public/brand/{mark,icon,wordmark}.png, public/favicon.png
  src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.png,icon.ico}
Usage: python branding/make_brand.py        Needs Pillow and numpy.
"""
from __future__ import annotations

import io
import pathlib
import struct

import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "branding" / "source"
TILE = (10, 10, 12, 255)


def white_from_luma(img: Image.Image) -> Image.Image:
    """White artwork on black -> white artwork with the black made transparent."""
    rgb = np.asarray(img.convert("RGB"), dtype=np.uint8)
    alpha = rgb.max(axis=2)
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[..., :3] = 255
    out[..., 3] = alpha
    return Image.fromarray(out, "RGBA")


def crop_to_content(img: Image.Image, pad: float, threshold: int = 24) -> Image.Image:
    alpha = np.asarray(img.getchannel("A"))
    ys, xs = np.where(alpha > threshold)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    px, py = int((x1 - x0) * pad), int((y1 - y0) * pad)
    box = (max(x0 - px, 0), max(y0 - py, 0), min(x1 + px, img.width), min(y1 + py, img.height))
    return img.crop(box)


def fit_width(img: Image.Image, width: int) -> Image.Image:
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


def icon_tile(size: int, art: Image.Image) -> Image.Image:
    """The emblem, centred on a near-black rounded tile."""
    S = size * 4
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * 0.22), fill=255)
    bg = Image.new("RGBA", (S, S), TILE)
    tile.paste(bg, (0, 0), mask)
    inner = int(S * 0.64)
    scale = inner / max(art.size)
    emblem = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    tile.alpha_composite(emblem, ((S - emblem.width) // 2, (S - emblem.height) // 2))
    return tile.resize((size, size), Image.LANCZOS)


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def ico(art: Image.Image, sizes: list[int]) -> bytes:
    frames = [(s, png_bytes(icon_tile(s, art))) for s in sizes]
    head = struct.pack("<HHH", 0, 1, len(frames))
    off = 6 + 16 * len(frames)
    entries, blob = b"", b""
    for s, data in frames:
        entries += struct.pack("<BBBBHHII", 0 if s >= 256 else s, 0 if s >= 256 else s, 0, 0, 1, 32, len(data), off)
        blob += data
        off += len(data)
    return head + entries + blob


def write(path: pathlib.Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print("wrote", path.relative_to(ROOT), len(data), "bytes")


def main() -> None:
    mark = crop_to_content(Image.open(SRC / "mark.png").convert("RGBA"), 0.03)
    wordmark = crop_to_content(white_from_luma(Image.open(SRC / "wordmark.png")), 0.03)
    art = crop_to_content(white_from_luma(Image.open(SRC / "icon-art.png")), 0.0)

    write(ROOT / "public" / "brand" / "mark.png", png_bytes(fit_width(mark, 640)))
    write(ROOT / "public" / "brand" / "wordmark.png", png_bytes(fit_width(wordmark, 900)))
    write(ROOT / "public" / "brand" / "icon.png", png_bytes(icon_tile(256, art)))
    write(ROOT / "public" / "favicon.png", png_bytes(icon_tile(64, art)))
    icons = ROOT / "src-tauri" / "icons"
    for name, size in (("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256), ("icon.png", 512)):
        write(icons / name, png_bytes(icon_tile(size, art)))
    write(icons / "icon.ico", ico(art, [16, 24, 32, 48, 64, 128, 256]))


if __name__ == "__main__":
    main()
