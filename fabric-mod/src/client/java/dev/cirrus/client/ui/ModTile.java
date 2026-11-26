package dev.cirrus.client.ui;

import dev.cirrus.core.module.CirrusMod;
import net.minecraft.client.gui.GuiGraphics;

/** The square module icon: a Maple-orange tile with a white glyph when the module is on, a faint grey tile when off. */
public final class ModTile {
    private ModTile() { }

    public static void draw(GuiGraphics g, CirrusMod mod, boolean on, int x, int y, int size) {
        boolean planned = !mod.available();
        Gfx.fillRound(g, x, y, size, size, Math.max(4, size / 4f), on ? dev.cirrus.core.theme.Brand.MAIN : (planned ? Look.SURFACE : Look.SURFACE_HOVER));
        int glyph = Math.round(size * 0.6f / 2f) * 2;
        Glyphs.draw(g, mod.icon(), x + (size - glyph) / 2, y + (size - glyph) / 2, glyph, on ? 0xFFFFFFFF : (planned ? 0xFF6E6E6E : 0xFFFFFFFF));
    }
}
