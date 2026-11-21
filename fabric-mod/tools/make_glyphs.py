#!/usr/bin/env python3
"""Generates the Cirrus UI glyph sheet (white on transparent, 64px cells, 8 columns x 3 rows).

All shapes are drawn here from primitives, so the sheet is original Cirrus artwork. It is tinted at draw time by
dev.cirrus.client.ui.Glyphs. Run: python3 tools/make_glyphs.py  (writes src/main/resources/assets/cirrus_fabric/textures/gui/glyphs.png)
Glyph order must match Glyphs.java.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

CELL, COLS, ROWS, SS = 64, 8, 8, 8          # supersample factor
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


def curve(p, a, c, b, w=STROKE, n=18):
    pts = [((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]) for t in [i / n for i in range(n + 1)]]
    p.line(pts, w)
def star4(p, cx, cy, r):
    q = r * 0.26
    p.fillpoly([(cx, cy - r), (cx + q, cy - q), (cx + r, cy), (cx + q, cy + q), (cx, cy + r), (cx - q, cy + q), (cx - r, cy), (cx - q, cy - q)])
def rect_fill(p, x0, y0, x1, y1): p.fillpoly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])

# ---- categories --------------------------------------------------------------------------------------------------------
def sword(p):
    p.line([(25, 39), (51, 13)], 6.4); p.line([(15, 33), (31, 49)], 5); p.line([(23, 41), (12, 52)], 5.4); p.circle((10, 54), 3, fill=True)
def move(p):
    p.line([(10, 32), (50, 32)]); p.line([(36, 18), (50, 32), (36, 46)]); p.line([(8, 18), (22, 18)], 4); p.line([(8, 46), (22, 46)], 4)
def eye(p):
    curve(p, (5, 32), (32, 4), (59, 32)); curve(p, (5, 32), (32, 60), (59, 32)); p.circle((32, 32), 8.5)
def hudframe(p):
    p.rrect((6, 10, 58, 54), 6); p.rrect((13, 17, 31, 27), 3, 3.8); p.rrect((35, 38, 51, 47), 3, 3.8)
def wrench(p):
    p.arc((30, 6, 58, 34), 350, 280); p.line([(36, 28), (12, 52)], 7.6)
# ---- combat / movement / render / player -------------------------------------------------------------------------------
def droplet(p):
    p.line([(32 + 25 * math.sin(math.radians(t)) * math.sin(math.radians(t / 2)), 33 - 26 * math.cos(math.radians(t))) for t in range(0, 361, 6)])
def heart(p):
    pts = []
    for i in range(61):
        t = math.radians(i * 6)
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((32 + x * 1.5, 30 - y * 1.5))
    p.line(pts)
def cube(p):
    p.poly([(32, 7), (55, 20), (55, 44), (32, 57), (9, 44), (9, 20)]); p.line([(9, 20), (32, 33), (55, 20)]); p.line([(32, 33), (32, 57)])
def toggle(p):
    p.rrect((6, 19, 58, 45), 13); p.circle((45, 32), 7.5, fill=True)
def orbit(p):
    refresh(p); p.circle((32, 32), 5.5, fill=True)
def zoom(p):
    search(p); p.line([(20, 27), (34, 27)], 4.2); p.line([(27, 20), (27, 34)], 4.2)
def sun(p):
    p.circle((32, 32), 10.5)
    for i in range(8):
        a = math.radians(i * 45); p.line([(32 + 18 * math.cos(a), 32 + 18 * math.sin(a)), (32 + 26 * math.cos(a), 32 + 26 * math.sin(a))], 4.6)
def fall(p):
    p.rrect((21, 7, 43, 29), 4); p.line([(27, 37), (27, 44)], 4); p.line([(37, 37), (37, 44)], 4); p.line([(8, 55), (56, 55)])
def layers(p):
    p.poly([(32, 7), (57, 19), (32, 31), (7, 19)]); p.line([(7, 31), (32, 43), (57, 31)]); p.line([(7, 43), (32, 55), (57, 43)])
def sparkles(p):
    star4(p, 26, 36, 21); star4(p, 49, 15, 10); star4(p, 51, 48, 7.5)
def blur(p):
    p.circle((47, 32), 10, fill=True); p.line([(6, 20), (30, 20)]); p.line([(6, 32), (33, 32)]); p.line([(6, 44), (30, 44)])
def flame(p):
    def q(a, c, b, n=10): return [((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]) for t in [i / n for i in range(n + 1)]]
    pts = q((32, 4), (46, 20), (49, 38)) + q((49, 38), (50, 58), (32, 59))[1:] + q((32, 59), (14, 58), (15, 38))[1:] + q((15, 38), (16, 28), (24, 24))[1:] + q((24, 24), (26, 32), (28, 34))[1:] + q((28, 34), (26, 18), (32, 4))[1:]
    p.line(pts)
    p.line(q((32, 40), (40, 48), (32, 54)) + q((32, 54), (24, 48), (32, 40))[1:], 4)
def cloud(p):
    p.arc((6, 30, 30, 54), 90, 270); p.arc((18, 12, 46, 40), 185, 30); p.arc((34, 30, 58, 54), 270, 90); p.line([(18, 54), (46, 54)])
def mouse(p):
    p.rrect((17, 6, 47, 58), 15); p.line([(17, 27), (47, 27)], 4); p.line([(32, 12), (32, 21)], 4.6)
def tilt(p):
    p.poly([(11, 22), (47, 8), (55, 42), (19, 56)]); p.line([(24, 34), (42, 28)], 4)
# ---- HUD ---------------------------------------------------------------------------------------------------------------
def shield(p):
    p.poly([(32, 6), (54, 14), (53, 36), (32, 58), (11, 36), (10, 14)]); p.line([(32, 6), (32, 58)], 3.8)
def flask(p):
    p.line([(22, 8), (42, 8)]); p.line([(27, 8), (27, 24)]); p.line([(37, 8), (37, 24)]); p.arc((14, 22, 50, 58), 290, 250); p.line([(19, 43), (45, 43)], 4)
def crosshair(p):
    p.circle((32, 32), 13)
    for a, b in (((32, 6), (32, 21)), ((32, 43), (32, 58)), ((6, 32), (21, 32)), ((43, 32), (58, 32))): p.line([a, b])
def gauge(p):
    p.arc((8, 16, 56, 64), 180, 360); p.line([(32, 40), (44, 24)], 5); p.circle((32, 40), 3.6, fill=True); p.line([(8, 40), (14, 40)], 4); p.line([(50, 40), (56, 40)], 4)
def signal(p):
    for i, x in enumerate((9, 22, 35, 48)):
        h = 14 + i * 12; rect_fill(p, x, 54 - h, x + 8, 54)
def keycap(p):
    p.rrect((23, 6, 41, 24), 4, 4); p.rrect((3, 30, 21, 48), 4, 4); p.rrect((23, 30, 41, 48), 4, 4); p.rrect((43, 30, 61, 48), 4, 4)
def cursor(p):
    p.poly([(16, 7), (16, 49), (27, 39), (35, 56), (43, 52), (35, 36), (49, 36)])
def pin(p):
    p.arc((16, 10, 48, 42), 160, 20); p.line([(17, 31.5), (32, 58), (47, 31.5)]); p.circle((32, 26), 6)
def clock(p):
    p.circle((32, 32), 23); p.line([(32, 17), (32, 32), (43, 39)])
# ---- utility / social ---------------------------------------------------------------------------------------------------
def lockchat(p):
    p.rrect((6, 7, 46, 39), 8); p.line([(14, 39), (12, 50), (25, 39)])
    p.rrect((31, 31, 63, 63), 6, erase=True)
    p.rrect((36, 42, 58, 58), 4); p.arc((40, 30, 54, 50), 180, 360)
def mic(p):
    p.rrect((23, 5, 41, 36), 9); p.arc((13, 16, 51, 50), 0, 180); p.line([(32, 50), (32, 58)]); p.line([(22, 58), (42, 58)])
def headset(p):
    p.arc((10, 8, 54, 52), 180, 360); p.rrect((7, 30, 19, 50), 4); p.rrect((45, 30, 57, 50), 4)
def film(p):
    p.rrect((5, 15, 40, 49), 7); p.poly([(40, 29), (58, 18), (58, 46), (40, 35)])
# ---- UI actions ---------------------------------------------------------------------------------------------------------
def eyeoff(p):
    eye(p); p.line([(11, 56), (53, 8)], 5.2)
def chevron(p): p.line([(24, 12), (44, 32), (24, 52)])
def grip(p):
    p.line([(56, 20), (20, 56)], 4.4); p.line([(56, 34), (34, 56)], 4.4); p.line([(56, 48), (48, 56)], 4.4)
def keyglyph(p):
    p.circle((19, 32), 11); p.line([(30, 32), (57, 32)]); p.line([(47, 32), (47, 43)], 4.4); p.line([(55, 32), (55, 41)], 4.4)
def info(p):
    p.circle((32, 32), 23); p.circle((32, 20), 3, fill=True); p.line([(32, 29), (32, 46)])

GLYPHS = [person, people, shirt, camera, bag, power, grid, bubbles,
          gear, gem, box, lst, plus, refresh, back, ext,
          pencil, trash, star, globe, check, search, server, close,
          sword, move, eye, hudframe, wrench, droplet, heart, cube,
          toggle, orbit, zoom, sun, fall, layers, sparkles, blur,
          flame, cloud, mouse, tilt, shield, flask, crosshair, gauge,
          signal, keycap, cursor, pin, clock, lockchat, mic, headset,
          film, eyeoff, chevron, grip, keyglyph, info]
NAMES = "SINGLEPLAYER MULTIPLAYER COSMETICS SCREENSHOTS STORE POWER GRID CHAT SETTINGS GEM BOX LIST ADD REFRESH BACK EXTERNAL EDIT DELETE STAR GLOBE CHECK SEARCH SERVER CLOSE SWORD MOVE EYE HUD TOOLS DROPLET HEART CUBE TOGGLE ORBIT ZOOM SUN FALL LAYERS SPARKLES BLUR FLAME CLOUD MOUSE TILT SHIELD FLASK CROSSHAIR GAUGE SIGNAL KEYCAP CURSOR PIN CLOCK LOCKCHAT MIC HEADSET FILM EYE_OFF CHEVRON GRIP KEY INFO".split()

def main():
    assert len(GLYPHS) == len(NAMES) <= COLS * ROWS
    sheet = Image.new("RGBA", (COLS * CELL * SS, ROWS * CELL * SS), (0, 0, 0, 0))
    for i, fn in enumerate(GLYPHS):
        fn(Pen(sheet, (i % COLS) * CELL * SS, (i // COLS) * CELL * SS))
    sheet = sheet.resize((COLS * CELL, ROWS * CELL), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, optimize=True)
    print(f"wrote {OUT} {sheet.size}")
    print("indices:", ", ".join(f"{n}={i}" for i, n in enumerate(NAMES)))

if __name__ == "__main__": main()
