package dev.cirrus.client.ui;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.resources.Identifier;

/** Cirrus' own glyph sheet (tools/make_glyphs.py): white 64px cells, 8 columns x 8 rows, tinted when drawn. */
public final class Glyphs {
    // Icon indices live in dev.cirrus.core.render.Icons (no Minecraft types there).
    private static final Identifier SHEET = Identifier.fromNamespaceAndPath("cirrus_fabric", "textures/gui/glyphs.png");
    private static final int COLS = 8, ROWS = 8, CELL = 64;
    private Glyphs() { }

    public static void draw(GuiGraphics g, int glyph, int x, int y, int size, int color) {
        int index = Math.floorMod(glyph, COLS * ROWS);
        Gfx.region(g, SHEET, x, y, size, size, (index % COLS) * CELL, (index / COLS) * CELL, CELL, CELL, COLS * CELL, ROWS * CELL, color);
    }
}
