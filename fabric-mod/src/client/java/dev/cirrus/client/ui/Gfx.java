package dev.cirrus.client.ui;

import dev.cirrus.client.render.McCanvas;
import dev.cirrus.core.render.Colors;
import dev.cirrus.core.render.Shapes;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.resources.Identifier;

/**
 * Minecraft-facing drawing helpers used throughout the 1.21.11 UI. The shape algorithms and colour maths now live in Core
 * ({@link Shapes}, {@link Colors}) and draw through the Cirrus {@code Canvas}; this class keeps the original static API so existing
 * screens did not have to change.
 */
public final class Gfx {
    private Gfx() { }

    public static int scale() { return Math.max(1, Minecraft.getInstance().getWindow().getGuiScale()); }

    public static int alpha(int argb) { return Colors.alpha(argb); }
    public static int withAlpha(int argb, int a) { return Colors.withAlpha(argb, a); }
    public static int scaleAlpha(int argb, float f) { return Colors.scaleAlpha(argb, f); }
    public static int mix(int a, int b, float t) { return Colors.mix(a, b, t); }

    /** Filled rounded rectangle. Coordinates and radius are GUI units. */
    public static void fillRound(GuiGraphics g, float x, float y, float w, float h, float radius, int color) {
        Shapes.fillRound(McCanvas.of(g), x, y, w, h, radius, color);
    }

    /** Rounded outline drawn inside the given rectangle. Thickness is in GUI units, never thinner than one real pixel. */
    public static void strokeRound(GuiGraphics g, float x, float y, float w, float h, float radius, float thickness, int color) {
        Shapes.strokeRound(McCanvas.of(g), x, y, w, h, radius, thickness, color);
    }

    /** Soft drop shadow made of a few expanding translucent layers. */
    public static void shadow(GuiGraphics g, float x, float y, float w, float h, float radius, float spread, int color) {
        Shapes.shadow(McCanvas.of(g), x, y, w, h, radius, spread, color);
    }

    /** One real-pixel horizontal highlight line (used for the glass top edge). */
    public static void hairline(GuiGraphics g, float x, float y, float w, int color) {
        Shapes.hairline(McCanvas.of(g), x, y, w, color);
    }

    /** Textured quad from a pixel region of a texture, stretched into a GUI-unit rectangle. */
    public static void region(GuiGraphics g, Identifier tex, int x, int y, int w, int h, int u, int v, int uw, int vh, int texW, int texH, int color) {
        if (w <= 0 || h <= 0) return;
        g.blit(RenderPipelines.GUI_TEXTURED, tex, x, y, (float) u, (float) v, w, h, uw, vh, texW, texH, color);
    }
}
