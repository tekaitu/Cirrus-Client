package dev.cirrus.client.ui;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.resources.Identifier;

/** Cirrus' own glyph sheet (tools/make_glyphs.py): white 64px cells, 8 columns x 3 rows, tinted when drawn. */
public final class Glyphs {
    public static final int SINGLEPLAYER = 0, MULTIPLAYER = 1, COSMETICS = 2, SCREENSHOTS = 3, STORE = 4, POWER = 5, GRID = 6, CHAT = 7,
        SETTINGS = 8, GEM = 9, BOX = 10, LIST = 11, ADD = 12, REFRESH = 13, BACK = 14, EXTERNAL = 15,
        EDIT = 16, DELETE = 17, STAR = 18, GLOBE = 19, CHECK = 20, SEARCH = 21, SERVER = 22, CLOSE = 23;
    private static final Identifier SHEET = Identifier.fromNamespaceAndPath("cirrus_fabric", "textures/gui/glyphs.png");
    private static final int COLS = 8, ROWS = 3, CELL = 64;
    private Glyphs() { }

    public static void draw(GuiGraphics g, int glyph, int x, int y, int size, int color) {
        int index = Math.floorMod(glyph, COLS * ROWS);
        Gfx.region(g, SHEET, x, y, size, size, (index % COLS) * CELL, (index / COLS) * CELL, CELL, CELL, COLS * CELL, ROWS * CELL, color);
    }
}
