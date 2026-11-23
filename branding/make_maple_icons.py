#!/usr/bin/env python3
"""Draw the Maple Client maple leaf into every icon the launcher ships.

The leaf is one closed polygon: the same outline as src/components/Logo.tsx,
filled with the brand orange #E25303. Everything is rasterised here without
Pillow or an SVG renderer, using exact horizontal span coverage plus four
vertical samples per pixel, so the curves stay smooth and the icons stay
transparent where they should. The .ico file is a container of PNG entries,
which Windows 10/11 and Tauri both accept.

Run from the repository root:

    python3 branding/make_maple_icons.py
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORANGE = (226, 83, 3)
TILE = (14, 12, 10)

# Keep this string identical to MAPLE_LEAF_POINTS in src/components/Logo.tsx.
POINTS = (
    "75.0,68.7 75.2,68.5 95.5,50.6 91.6,48.9 90.9,48.2 90.7,47.4 95.0,32.6 83.6,35.1 "
    "82.7,35.2 82.1,34.8 81.6,34.0 78.4,27.3 67.6,39.5 66.2,40.0 65.0,39.8 64.5,39.3 "
    "64.2,38.6 64.4,36.3 69.6,12.2 61.1,16.9 60.2,17.2 59.4,17.0 58.8,16.3 57.5,14.2 "
    "50.0,0.0 42.5,14.2 41.2,16.3 40.6,17.0 39.8,17.2 38.9,16.9 30.4,12.2 35.6,36.3 "
    "35.8,38.6 35.5,39.3 35.0,39.8 33.8,40.0 32.4,39.5 21.6,27.3 18.4,34.0 17.9,34.8 "
    "17.3,35.1 16.4,35.1 5.0,32.6 9.3,47.4 9.1,48.2 8.4,48.9 4.5,50.6 24.3,68.1 "
    "26.1,69.8 26.4,70.8 26.3,71.9 24.1,79.9 44.6,75.5 46.6,75.7 47.4,76.2 47.9,76.7 "
    "48.1,77.4 48.2,78.4 47.1,100.0 52.9,100.0 51.8,78.4 51.9,77.2 52.4,76.4 53.6,75.7 "
    "55.4,75.5 75.9,79.9 73.6,71.3 73.8,70.0"
)
LEAF = [tuple(float(n) for n in pair.split(",")) for pair in POINTS.split()]


def rounded_rect(x: float, y: float, size: float, radius: float) -> bool:
    if x < 0 or y < 0 or x > size or y > size:
        return False
    cx = min(max(x, radius), size - radius)
    cy = min(max(y, radius), size - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius**2


def coverage(size: int, scale: float, offset: float) -> list[list[float]]:
    """Fraction of each pixel (row-major) covered by the leaf."""
    rows: list[list[float]] = []
    edges = [(LEAF[i], LEAF[(i + 1) % len(LEAF)]) for i in range(len(LEAF))]
    for py in range(size):
        row = [0.0] * size
        for sy in range(4):
            y = (py + (sy + 0.5) / 4 - offset) / scale
            xs = []
            for (x1, y1), (x2, y2) in edges:
                if (y1 > y) != (y2 > y):
                    xs.append((x2 - x1) * (y - y1) / (y2 - y1) + x1)
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                x0 = xs[i] * scale + offset
                x1 = xs[i + 1] * scale + offset
                if x1 <= 0 or x0 >= size:
                    continue
                x0 = max(0.0, x0)
                x1 = min(float(size), x1)
                first = int(x0)
                last = min(size - 1, int(x1 - 1e-9))
                for px in range(first, last + 1):
                    span = min(x1, px + 1) - max(x0, px)
                    if span > 0:
                        row[px] += span / 4
        rows.append(row)
    return rows


def render(size: int, *, tile: bool) -> bytes:
    """An RGBA PNG. `tile` draws the leaf on a dark rounded app tile."""
    leaf_scale = size / 100.0 * (0.68 if tile else 1.0)
    offset = (size - 100.0 * leaf_scale) / 2
    alpha = coverage(size, leaf_scale, offset)
    radius = size * 0.22 if tile else 0
    raw_rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            a = min(1.0, alpha[y][x])
            if tile:
                t = 1.0 if rounded_rect(x + 0.5, y + 0.5, size, radius) else 0.0
                r = round(ORANGE[0] * a + TILE[0] * (1 - a))
                g = round(ORANGE[1] * a + TILE[1] * (1 - a))
                b = round(ORANGE[2] * a + TILE[2] * (1 - a))
                row.extend((r, g, b, round(t * 255)))
            else:
                row.extend((ORANGE[0], ORANGE[1], ORANGE[2], round(a * 255)))
        raw_rows.append(bytes(row))
    raw = b"".join(b"\x00" + r for r in raw_rows)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f"{path.relative_to(ROOT)}  {len(data):,} bytes")


def ico(images: list[tuple[int, bytes]]) -> bytes:
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries = b""
    blob = b""
    for size, png in images:
        entries += struct.pack(
            "<BBBBHHII",
            0 if size >= 256 else size,
            0 if size >= 256 else size,
            0,
            0,
            1,
            32,
            len(png),
            offset,
        )
        offset += len(png)
        blob += png
    return header + entries + blob


def main() -> None:
    mark = render(512, tile=False)
    write(ROOT / "public" / "brand" / "mark.png", mark)
    write(ROOT / "public" / "brand" / "icon.png", render(512, tile=True))
    write(ROOT / "public" / "favicon.png", render(64, tile=True))

    icons = ROOT / "src-tauri" / "icons"
    write(icons / "icon.png", render(512, tile=True))
    write(icons / "32x32.png", render(32, tile=True))
    write(icons / "128x128.png", render(128, tile=True))
    write(icons / "128x128@2x.png", render(256, tile=True))
    write(icons / "icon.ico", ico([(s, render(s, tile=True)) for s in (16, 32, 48, 64, 128, 256)]))
    write(icons / "maple-mark.png", mark)

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">'
        '<polygon fill="#E25303" points="' + POINTS + '"/></svg>\n'
    )
    write(ROOT / "public" / "brand" / "maple.svg", svg.encode())


if __name__ == "__main__":
    main()
