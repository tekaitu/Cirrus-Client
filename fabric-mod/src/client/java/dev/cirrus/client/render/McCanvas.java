package dev.cirrus.client.render;

import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Glyphs;
import dev.cirrus.core.perf.PerfCounters;
import dev.cirrus.core.render.Canvas;
import dev.cirrus.core.text.TextStyle;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.resources.Identifier;

/**
 * The Minecraft 1.21.11 implementation of {@link Canvas}: every call is forwarded to {@link GuiGraphics}, i.e. Minecraft's own
 * GUI pipeline. Cirrus owns no renderer, so a change of graphics backend underneath (OpenGL to Vulkan) is Mojang's to absorb.
 *
 * <p>A single instance is reused (no allocation per draw call); it is bound to the frame's {@code GuiGraphics} by {@link #of}.
 * Render thread only.
 */
public final class McCanvas implements Canvas {
    private static final McCanvas INSTANCE = new McCanvas();
    private GuiGraphics g;

    private McCanvas() { }

    public static McCanvas of(GuiGraphics graphics) {
        INSTANCE.g = graphics;
        return INSTANCE;
    }

    @Override public int scale() { return Math.max(1, Minecraft.getInstance().getWindow().getGuiScale()); }

    @Override public void beginPixels() {
        int s = scale();
        g.pose().pushMatrix();
        g.pose().scale(1f / s, 1f / s);
    }

    @Override public void endPixels() { g.pose().popMatrix(); }

    @Override public void fill(int x0, int y0, int x1, int y1, int argb) {
        PerfCounters.fills++;
        g.fill(x0, y0, x1, y1, argb);
    }

    @Override public void cornerMask(int r, int t, int qx, int qy, int x, int y, int argb) {
        PerfCounters.masks++;
        Identifier tex = CornerTextures.get(r, t);
        int size = r * 2;
        g.blit(RenderPipelines.GUI_TEXTURED, tex, x, y, (float) (qx * r), (float) (qy * r), r, r, r, r, size, size, argb);
    }

    @Override public void icon(int index, int x, int y, int size, int argb) {
        PerfCounters.icons++;
        Glyphs.draw(g, index, x, y, size, argb);
    }

    @Override public void text(String text, TextStyle style, int x, int y, int argb, boolean shadow) {
        PerfCounters.texts++;
        var font = Minecraft.getInstance().font;
        switch (style) {
            case BODY -> CirrusUi.text(g, font, text, x, y, argb, shadow);
            case SMALL -> CirrusUi.smallText(g, font, text, x, y, argb, shadow);
            case HEADING -> CirrusUi.headingText(g, font, text, x, y, argb);
        }
    }

    @Override public void pushTransform(float x, float y, float scale) {
        g.pose().pushMatrix();
        g.pose().translate(x, y);
        g.pose().scale(scale, scale);
    }

    @Override public void popTransform() { g.pose().popMatrix(); }

    /** The underlying graphics context, for client-only drawing (item stacks and similar) that Core cannot express. */
    public GuiGraphics graphics() { return g; }

    @Override public void pushClip(int x, int y, int w, int h) {
        PerfCounters.clips++;
        g.enableScissor(x, y, x + w, y + h);
    }

    @Override public void popClip() { g.disableScissor(); }
}
