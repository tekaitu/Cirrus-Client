package dev.cirrus.client.ui;

import dev.cirrus.core.theme.CirrusTheme;
import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.client.mod.HudElement;
import net.minecraft.client.gui.GuiGraphics;

/** A framed, centred preview of a HUD element on a checker backdrop (so a transparent background reads as transparent). */
public final class HudPreview {
    private HudPreview() { }

    public static void draw(GuiGraphics g, HudElement e, CirrusConfig cfg, CirrusTheme t, int x, int y, int w, int h) {
        Gfx.fillRound(g, x, y, w, h, 8, 0xFF050505);
        g.enableScissor(x + 1, y + 1, x + w - 1, y + h - 1);
        for (int cy = 0; cy < h; cy += 10) for (int cx = 0; cx < w; cx += 10)
            if (((cx / 10) + (cy / 10)) % 2 == 0) g.fill(x + cx, y + cy, x + cx + 10, y + cy + 10, 0xFF141414);
        // Shrink the preview (never the real element) when a large scale would not fit the frame.
        float fit = Math.min(1f, Math.min((w - 12f) / e.width(), (h - 12f) / e.height()));
        var pose = g.pose();
        pose.pushMatrix();
        pose.translate(x + w / 2f, y + h / 2f);
        pose.scale(fit, fit);
        e.render(g, -e.width() / 2, -e.height() / 2, 0, cfg);
        pose.popMatrix();
        g.disableScissor();
        Gfx.strokeRound(g, x, y, w, h, 8, 0.5f, t.border);
    }
}
