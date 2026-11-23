package dev.cirrus.client.mod;

import dev.cirrus.client.render.McCanvas;
import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.hud.HudMod;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.render.Canvas;
import dev.cirrus.core.theme.CirrusTheme;
import net.minecraft.client.gui.GuiGraphics;

/**
 * A HUD module that has to draw things only Minecraft can (item stacks, for example) and so cannot be written against Core's
 * {@link Canvas} alone. It keeps the {@link HudMod} behaviour (options, scale, background) and hands the subclass the
 * {@link GuiGraphics} it needs. Modules that only draw text, shapes and icons should extend {@link HudMod} in Core instead.
 */
public abstract class McHudMod extends HudMod {
    protected abstract int baseWidth(CirrusConfig c);
    protected abstract int baseHeight(CirrusConfig c);
    /** Draw at scale 1 with the top-left corner at (x, y). */
    protected abstract void drawGui(GuiGraphics g, int x, int y, float tick, CirrusConfig c);

    @Override protected final int baseWidth(ModContext m) { return baseWidth(m.config()); }
    @Override protected final int baseHeight(ModContext m) { return baseHeight(m.config()); }

    @Override protected final void draw(Canvas canvas, int x, int y, float tick, ModContext m) {
        drawGui(((McCanvas) canvas).graphics(), x, y, tick, m.config());
    }

    protected final void surface(GuiGraphics g, int x, int y, int w, int h, int radius, CirrusConfig c, CirrusTheme t) {
        surface(McCanvas.of(g), x, y, w, h, radius, c, t);
    }
}
