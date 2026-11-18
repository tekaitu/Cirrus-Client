package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/**
 * Base for every Cirrus screen. It fixes the render order once: backdrop (renderBackground, called by the game exactly once),
 * then the screen's own surfaces, then the widgets, then overlays. No screen calls renderBackground itself.
 */
public abstract class CirrusScreen extends Screen {
    protected final Screen parent;
    private final long openedAt = Anim.now();

    protected CirrusScreen(Component title, Screen parent) {
        super(title);
        this.parent = parent;
    }

    protected final CirrusConfig config() { return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath()); }
    protected final CirrusTheme theme() { return CirrusTheme.current(config()); }
    /** True when there is not much room; layouts drop optional elements instead of overlapping. */
    protected final boolean compact() { return width < 360 || height < 210; }

    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) {
        CirrusUi.backdrop(g, width, height, theme());
    }

    @Override public final void render(GuiGraphics g, int mx, int my, float delta) {
        CirrusTheme t = theme();
        drawSurfaces(g, mx, my, delta, t);
        super.render(g, mx, my, delta);
        drawOverlay(g, mx, my, delta, t);
        float open = Anim.easeOut((Anim.now() - openedAt) / 200f);
        if (open < 1f) g.fill(0, 0, width, height, Gfx.withAlpha(0xFF000000, Math.round((1f - open) * 120)));
    }

    /** Panels, cards and static text. Widgets are drawn after this. */
    protected abstract void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t);
    /** Anything that must sit above the widgets. */
    protected void drawOverlay(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) { }

    @Override public void onClose() { minecraft.setScreen(parent); }
}
