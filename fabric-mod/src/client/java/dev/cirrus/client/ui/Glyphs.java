package dev.cirrus.client.ui;

import dev.cirrus.client.render.McCanvas;
import net.minecraft.client.gui.GuiGraphics;

/** Static entry point for the Cirrus glyph sheet; the drawing itself is {@code McCanvas.icon}. Indices live in {@code dev.cirrus.core.render.Icons}. */
public final class Glyphs {
    private Glyphs() { }

    public static void draw(GuiGraphics g, int glyph, int x, int y, int size, int color) { McCanvas.of(g).icon(glyph, x, y, size, color); }
}
