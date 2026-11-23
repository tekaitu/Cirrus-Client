package dev.cirrus.client.ui;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;

import java.util.HashMap;
import java.util.Map;

/**
 * Shape drawing in physical pixels. Layout is in GUI units, but every edge is snapped to a real screen pixel
 * and corners are anti-aliased textures, so panels stay crisp at any GUI scale (vanilla sprites are 1:1 and go blocky).
 */
public final class Gfx {
    private static final Map<Integer, Identifier> CORNERS = new HashMap<>();
    private Gfx() { }

    public static int scale() { return Math.max(1, Minecraft.getInstance().getWindow().getGuiScale()); }

    public static int alpha(int argb) { return argb >>> 24; }
    public static int withAlpha(int argb, int a) { return (Math.max(0, Math.min(255, a)) << 24) | (argb & 0xFFFFFF); }
    public static int scaleAlpha(int argb, float f) { return withAlpha(argb, Math.round(alpha(argb) * f)); }

    public static int mix(int a, int b, float t) {
        t = Math.max(0f, Math.min(1f, t));
        int aa = Math.round(((a >>> 24) & 255) * (1 - t) + ((b >>> 24) & 255) * t);
        int r = Math.round(((a >>> 16) & 255) * (1 - t) + ((b >>> 16) & 255) * t);
        int g = Math.round(((a >>> 8) & 255) * (1 - t) + ((b >>> 8) & 255) * t);
        int bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
        return aa << 24 | r << 16 | g << 8 | bl;
    }

    /** Filled rounded rectangle. Coordinates and radius are GUI units. */
    public static void fillRound(GuiGraphics g, float x, float y, float w, float h, float radius, int color) {
        draw(g, x, y, w, h, radius, 0, color);
    }

    /** Rounded outline drawn inside the given rectangle. Thickness is in GUI units, never thinner than one real pixel. */
    public static void strokeRound(GuiGraphics g, float x, float y, float w, float h, float radius, float thickness, int color) {
        draw(g, x, y, w, h, radius, Math.max(0.0001f, thickness), color);
    }

    /** Soft drop shadow made of a few expanding translucent layers. */
    public static void shadow(GuiGraphics g, float x, float y, float w, float h, float radius, float spread, int color) {
        int layers = 5;
        for (int i = layers; i >= 1; i--) {
            float grow = spread * i / layers;
            fillRound(g, x - grow, y - grow + spread * 0.45f, w + grow * 2, h + grow * 2, radius + grow, scaleAlpha(color, 0.22f / i * 1.6f));
        }
    }

    /** One real-pixel horizontal highlight line (used for the glass top edge). */
    public static void hairline(GuiGraphics g, float x, float y, float w, int color) {
        int s = scale();
        int px = Math.round(x * s), py = Math.round(y * s), pw = Math.round((x + w) * s) - px;
        if (pw <= 0) return;
        var pose = g.pose();
        pose.pushMatrix();
        pose.scale(1f / s, 1f / s);
        g.fill(px, py, px + pw, py + 1, color);
        pose.popMatrix();
    }

    private static void draw(GuiGraphics g, float x, float y, float w, float h, float radius, float stroke, int color) {
        if (w <= 0 || h <= 0 || alpha(color) == 0) return;
        int s = scale();
        int px = Math.round(x * s), py = Math.round(y * s);
        int pw = Math.round((x + w) * s) - px, ph = Math.round((y + h) * s) - py;
        if (pw <= 0 || ph <= 0) return;
        int r = Math.max(0, Math.min(Math.round(radius * s), Math.min(pw, ph) / 2));
        int t = stroke > 0 ? Math.max(1, Math.round(stroke * s)) : 0;
        var pose = g.pose();
        pose.pushMatrix();
        pose.scale(1f / s, 1f / s);
        if (t == 0) {
            if (r == 0) {
                g.fill(px, py, px + pw, py + ph, color);
            } else {
                g.fill(px + r, py, px + pw - r, py + ph, color);
                g.fill(px, py + r, px + r, py + ph - r, color);
                g.fill(px + pw - r, py + r, px + pw, py + ph - r, color);
                Identifier tex = corner(r, 0);
                corners(g, tex, px, py, pw, ph, r, color);
            }
        } else {
            t = Math.min(t, Math.min(pw, ph) / 2);
            if (r == 0) {
                g.fill(px, py, px + pw, py + t, color);
                g.fill(px, py + ph - t, px + pw, py + ph, color);
                g.fill(px, py + t, px + t, py + ph - t, color);
                g.fill(px + pw - t, py + t, px + pw, py + ph - t, color);
            } else {
                g.fill(px + r, py, px + pw - r, py + t, color);
                g.fill(px + r, py + ph - t, px + pw - r, py + ph, color);
                g.fill(px, py + r, px + t, py + ph - r, color);
                g.fill(px + pw - t, py + r, px + pw, py + ph - r, color);
                corners(g, corner(r, Math.min(t, r)), px, py, pw, ph, r, color);
            }
        }
        pose.popMatrix();
    }

    private static void corners(GuiGraphics g, Identifier tex, int px, int py, int pw, int ph, int r, int color) {
        int size = r * 2;
        g.blit(RenderPipelines.GUI_TEXTURED, tex, px, py, 0f, 0f, r, r, r, r, size, size, color);
        g.blit(RenderPipelines.GUI_TEXTURED, tex, px + pw - r, py, (float) r, 0f, r, r, r, r, size, size, color);
        g.blit(RenderPipelines.GUI_TEXTURED, tex, px, py + ph - r, 0f, (float) r, r, r, r, r, size, size, color);
        g.blit(RenderPipelines.GUI_TEXTURED, tex, px + pw - r, py + ph - r, (float) r, (float) r, r, r, r, r, size, size, color);
    }

    /** White anti-aliased disc (t == 0) or ring of thickness t, 2r by 2r pixels. Sliced into four corners when drawn. */
    private static Identifier corner(int r, int t) {
        int key = r * 1024 + t;
        Identifier cached = CORNERS.get(key);
        if (cached != null) return cached;
        int size = r * 2;
        NativeImage image = new NativeImage(size, size, false);
        final int samples = 6;
        for (int j = 0; j < size; j++) {
            for (int i = 0; i < size; i++) {
                int hit = 0;
                for (int sy = 0; sy < samples; sy++) for (int sx = 0; sx < samples; sx++) {
                    double dx = i + (sx + 0.5) / samples - r, dy = j + (sy + 0.5) / samples - r;
                    double d = Math.sqrt(dx * dx + dy * dy);
                    if (d <= r && (t == 0 || d >= r - t)) hit++;
                }
                int a = Math.round(255f * hit / (samples * samples));
                image.setPixel(i, j, (a << 24) | 0xFFFFFF);
            }
        }
        Identifier id = Identifier.fromNamespaceAndPath("cirrus_fabric", "generated/corner_" + r + "_" + t);
        Minecraft.getInstance().getTextureManager().register(id, new DynamicTexture(() -> "Cirrus corner " + id.getPath(), image));
        CORNERS.put(key, id);
        return id;
    }

    /** Textured quad from a pixel region of a texture, stretched into a GUI-unit rectangle. */
    public static void region(GuiGraphics g, Identifier tex, int x, int y, int w, int h, int u, int v, int uw, int vh, int texW, int texH, int color) {
        if (w <= 0 || h <= 0) return;
        g.blit(RenderPipelines.GUI_TEXTURED, tex, x, y, (float) u, (float) v, w, h, uw, vh, texW, texH, color);
    }
}
