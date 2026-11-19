#!/usr/bin/env python3
"""Generates the Cirrus UI glyph sheet (white on transparent, 64px cells, 8 columns x 3 rows).

All shapes are drawn here from primitives, so the sheet is original Cirrus artwork. It is tinted at draw time by
dev.cirrus.client.ui.Glyphs. Run: python3 tools/make_glyphs.py  (writes src/main/resources/assets/cirrus_fabric/textures/gui/glyphs.png)
Glyph order must match Glyphs.java.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

CELL, COLS, ROWS, SS = 64, 8, 3, 8          # supersample factor
K = SS                                       # 1 unit of the 64 grid in supersampled pixels
STROKE = 4.6                                 # stroke width in 64-grid units
OUT = Path(__file__).resolve().parent.parent / "src/main/resources/assets/cirrus_fabric/textures/gui/glyphs.png"

class Pen:
    def __init__(self, img, ox, oy):
        self.d = ImageDraw.Draw(img); self.ox = ox; self.oy = oy
    def p(self, x, y): return (self.ox + x * K, self.oy + y * K)
    def line(self, pts, w=STROKE):
        pts = [self.p(*a) for a in pts]; wp = w * K
        self.d.line(pts, fill=(255, 255, 255, 255), width=int(wp), joint="curve")
        for x, y in (pts[0], pts[-1]) + tuple(pts[1:-1]):
            self.d.ellipse((x - wp / 2, y - wp / 2, x + wp / 2, y + wp / 2), fill=(255, 255, 255, 255))
    def arc(self, box, a0, a1, w=STROKE):
        x0, y0 = self.p(box[0], box[1]); x1, y1 = self.p(box[2], box[3]); wp = int(w * K)
        self.d.arc((x0, y0, x1, y1), a0, a1, fill=(255, 255, 255, 255), width=wp)
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 - wp / 2, (y1 - y0) / 2 - wp / 2
        for a in (a0, a1):
            px, py = cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a))
            self.d.ellipse((px - wp / 2, py - wp / 2, px + wp / 2, py + wp / 2), fill=(255, 255, 255, 255))
    def circle(self, c, r, w=STROKE, fill=False):
        x, y = self.p(*c); rp = r * K
        if fill: self.d.ellipse((x - rp, y - rp, x + rp, y + rp), fill=(255, 255, 255, 255))
        else: self.d.ellipse((x - rp, y - rp, x + rp, y + rp), outline=(255, 255, 255, 255), width=int(w * K))
    def rrect(self, box, r, w=STROKE, erase=False):
        a = self.p(box[0], box[1]); b = self.p(box[2], box[3])
        if erase: self.d.rounded_rectangle((a[0], a[1], b[0], b[1]), radius=r * K, fill=(0, 0, 0, 0))
        else: self.d.rounded_rectangle((a[0], a[1], b[0], b[1]), radius=r * K, outline=(255, 255, 255, 255), width=int(w * K))
    def poly(self, pts, close=True, w=STROKE):
        self.line(pts + ([pts[0]] if close else []), w)
    def fillpoly(self, pts): self.d.polygon([self.p(*a) for a in pts], fill=(255, 255, 255, 255))

def person(p):
    p.circle((32, 21), 9.5); p.arc((13, 36, 51, 74), 200, 340)
def people(p):
    p.circle((25, 22), 8); p.arc((8, 35, 42, 69), 200, 340)
    p.arc((38, 15, 52, 29), 250, 70); p.arc((34, 33, 58, 57), 215, 335)
def shirt(p):
    p.poly([(24, 10), (11, 18), (16, 29), (22, 26), (22, 53), (42, 53), (42, 26), (48, 29), (53, 18), (40, 10)], close=False)
    p.arc((25, 4, 39, 18), 0, 180)
def camera(p):
    p.rrect((8, 19, 56, 51), 6); p.circle((32, 35), 8.5); p.line([(22, 19), (25, 13), (39, 13), (42, 19)])
def bag(p):
    p.rrect((13, 22, 51, 55), 5); p.arc((22, 8, 42, 36), 180, 360)
def power(p):
    p.arc((13, 13, 51, 51), 305, 235); p.line([(32, 9), (32, 31)])
def grid(p):
    for x in (10, 35):
        for y in (10, 35): p.rrect((x, y, x + 19, y + 19), 4)
def bubbles(p):
    p.rrect((7, 9, 41, 35), 8); p.line([(15, 35), (13, 46), (25, 35)], STROKE)
    p.rrect((27, 25, 57, 49), 8, erase=True); p.rrect((27, 25, 57, 49), 8)
    p.line([(46, 49), (50, 57), (41, 49)], STROKE)
def gear(p):
    for i in range(8):
        a = math.radians(i * 45); p.line([(32 + 15 * math.cos(a), 32 + 15 * math.sin(a)), (32 + 23 * math.cos(a), 32 + 23 * math.sin(a))], 7)
    p.circle((32, 32), 16, 5.2); p.circle((32, 32), 6.5, 4.4)
def gem(p):
    p.poly([(18, 12), (46, 12), (57, 25), (32, 55), (7, 25)]); p.line([(7, 25), (57, 25)])
    p.line([(23, 12), (26, 25), (32, 55)], 3.6); p.line([(41, 12), (38, 25), (32, 55)], 3.6)
def box(p):
    p.rrect((8, 12, 56, 26), 3); p.rrect((12, 26, 52, 54), 3); p.line([(26, 36), (38, 36)])
def lst(p):
    for y in (17, 32, 47):
        p.circle((13, y), 3.4, fill=True); p.line([(23, y), (53, y)])
def plus(p): p.line([(32, 12), (32, 52)]); p.line([(12, 32), (52, 32)])
def refresh(p):
    cx = cy = 32; r = 19
    p.arc((cx - r, cy - r, cx + r, cy + r), 20, 300)
    a = math.radians(300); px, py = cx + r * math.cos(a), cy + r * math.sin(a)
    tx, ty = -math.sin(a), math.cos(a); nx, ny = math.cos(a), math.sin(a)
    p.fillpoly([(px + tx * 9 + nx * 0, py + ty * 9 + ny * 0), (px + nx * 8.5, py + ny * 8.5), (px - nx * 8.5, py - ny * 8.5)])
def back(p): p.line([(52, 32), (13, 32)]); p.line([(27, 17), (13, 32), (27, 47)])
def ext(p):
    p.rrect((9, 19, 41, 55), 5); p.line([(29, 35), (54, 10)]); p.line([(38, 10), (54, 10), (54, 26)])
def pencil(p):
    p.line([(24, 40), (46, 18)], 9); p.fillpoly([(11, 53), (15, 38), (26, 49)]); p.line([(48, 16), (52, 12)], 5)
def trash(p):
    p.line([(13, 17), (51, 17)]); p.poly([(24, 17), (24, 11), (40, 11), (40, 17)], close=False)
    p.poly([(18, 17), (21, 54), (43, 54), (46, 17)], close=False); p.line([(28, 27), (28, 44)], 3.6); p.line([(36, 27), (36, 44)], 3.6)
def star(p):
    pts = []
    for i in range(10):
        r = 24 if i % 2 == 0 else 10.5; a = math.radians(-90 + i * 36); pts.append((32 + r * math.cos(a), 33.5 + r * math.sin(a)))
    p.poly(pts)
def globe(p):
    p.circle((32, 32), 22); p.rrect((22, 10, 42, 54), 10, 4); p.line([(10, 32), (54, 32)], 4)
def check(p): p.line([(13, 34), (26, 47), (51, 19)], 5.6)
def search(p): p.circle((27, 27), 16); p.line([(39, 39), (54, 54)], 5.4)
def server(p):
    p.rrect((9, 10, 55, 29), 5); p.rrect((9, 35, 55, 54), 5)
    for y in (19.5, 44.5): p.circle((19, y), 2.4, fill=True); p.line([(29, y), (45, y)], 3.6)
def close(p): p.line([(16, 16), (48, 48)], 5.4); p.line([(48, 16), (16, 48)], 5.4)

GLYPHS = [person, people, shirt, camera, bag, power, grid, bubbles,
          gear, gem, box, lst, plus, refresh, back, ext,
          pencil, trash, star, globe, check, search, server, close]
NAMES = "SINGLEPLAYER MULTIPLAYER COSMETICS SCREENSHOTS STORE POWER GRID CHAT SETTINGS GEM BOX LIST ADD REFRESH BACK EXTERNAL EDIT DELETE STAR GLOBE CHECK SEARCH SERVER CLOSE".split()

def main():
    assert len(GLYPHS) == len(NAMES) == COLS * ROWS
    sheet = Image.new("RGBA", (COLS * CELL * SS, ROWS * CELL * SS), (0, 0, 0, 0))
    for i, fn in enumerate(GLYPHS):
        fn(Pen(sheet, (i % COLS) * CELL * SS, (i // COLS) * CELL * SS))
    sheet = sheet.resize((COLS * CELL, ROWS * CELL), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, optimize=True)
    print(f"wrote {OUT} {sheet.size}")
    print("indices:", ", ".join(f"{n}={i}" for i, n in enumerate(NAMES)))

if __name__ == "__main__": main()
