package dev.cirrus.client.ui;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.resources.Identifier;

/** Cirrus' own glyph sheet (tools/make_glyphs.py): white 64px cells, 8 columns x 8 rows, tinted when drawn. */
public final class Glyphs {
    public static final int SINGLEPLAYER = 0, MULTIPLAYER = 1, COSMETICS = 2, SCREENSHOTS = 3, STORE = 4, POWER = 5, GRID = 6, CHAT = 7,
        SETTINGS = 8, GEM = 9, BOX = 10, LIST = 11, ADD = 12, REFRESH = 13, BACK = 14, EXTERNAL = 15,
        EDIT = 16, DELETE = 17, STAR = 18, GLOBE = 19, CHECK = 20, SEARCH = 21, SERVER = 22, CLOSE = 23,
        SWORD = 24, MOVE = 25, EYE = 26, HUD = 27, TOOLS = 28, DROPLET = 29, HEART = 30, CUBE = 31,
        TOGGLE = 32, ORBIT = 33, ZOOM = 34, SUN = 35, FALL = 36, LAYERS = 37, SPARKLES = 38, BLUR = 39,
        FLAME = 40, CLOUD = 41, MOUSE = 42, TILT = 43, SHIELD = 44, FLASK = 45, CROSSHAIR = 46, GAUGE = 47,
        SIGNAL = 48, KEYCAP = 49, CURSOR = 50, PIN = 51, CLOCK = 52, LOCKCHAT = 53, MIC = 54, HEADSET = 55,
        FILM = 56, EYE_OFF = 57, CHEVRON = 58, GRIP = 59, KEY = 60, INFO = 61;
    private static final Identifier SHEET = Identifier.fromNamespaceAndPath("cirrus_fabric", "textures/gui/glyphs.png");
    private static final int COLS = 8, ROWS = 8, CELL = 64;
    private Glyphs() { }

    public static void draw(GuiGraphics g, int glyph, int x, int y, int size, int color) {
        int index = Math.floorMod(glyph, COLS * ROWS);
        Gfx.region(g, SHEET, x, y, size, size, (index % COLS) * CELL, (index / COLS) * CELL, CELL, CELL, COLS * CELL, ROWS * CELL, color);
    }
}
