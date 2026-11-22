package dev.cirrus.core.render;

/**
 * Rounded shapes drawn on a {@link Canvas}. Layout is in GUI units, but every edge is snapped to a real screen pixel and corners
 * are anti-aliased masks, so panels stay crisp at any GUI scale. This is the algorithm that used to live in the Minecraft-only
 * {@code Gfx} class, moved here unchanged so it can be tested without a game.
 */
public final class Shapes {
    private Shapes() { }

    /** Filled rounded rectangle. Coordinates and radius are GUI units. */
    public static void fillRound(Canvas c, float x, float y, float w, float h, float radius, int color) {
        draw(c, x, y, w, h, radius, 0, color);
    }

    /** Rounded outline drawn inside the given rectangle. Thickness is in GUI units, never thinner than one real pixel. */
    public static void strokeRound(Canvas c, float x, float y, float w, float h, float radius, float thickness, int color) {
        draw(c, x, y, w, h, radius, Math.max(0.0001f, thickness), color);
    }

    /** Soft drop shadow made of a few expanding translucent layers. */
    public static void shadow(Canvas c, float x, float y, float w, float h, float radius, float spread, int color) {
        int layers = 5;
        for (int i = layers; i >= 1; i--) {
            float grow = spread * i / layers;
            fillRound(c, x - grow, y - grow + spread * 0.45f, w + grow * 2, h + grow * 2, radius + grow, Colors.scaleAlpha(color, 0.22f / i * 1.6f));
        }
    }

    /** One real-pixel horizontal highlight line. */
    public static void hairline(Canvas c, float x, float y, float w, int color) {
        int s = c.scale();
        int px = Math.round(x * s), py = Math.round(y * s), pw = Math.round((x + w) * s) - px;
        if (pw <= 0) return;
        c.beginPixels();
        c.fill(px, py, px + pw, py + 1, color);
        c.endPixels();
    }

    private static void draw(Canvas c, float x, float y, float w, float h, float radius, float stroke, int color) {
        if (w <= 0 || h <= 0 || Colors.alpha(color) == 0) return;
        int s = c.scale();
        int px = Math.round(x * s), py = Math.round(y * s);
        int pw = Math.round((x + w) * s) - px, ph = Math.round((y + h) * s) - py;
        if (pw <= 0 || ph <= 0) return;
        int r = Math.max(0, Math.min(Math.round(radius * s), Math.min(pw, ph) / 2));
        int t = stroke > 0 ? Math.max(1, Math.round(stroke * s)) : 0;
        c.beginPixels();
        if (t == 0) {
            if (r == 0) {
                c.fill(px, py, px + pw, py + ph, color);
            } else {
                c.fill(px + r, py, px + pw - r, py + ph, color);
                c.fill(px, py + r, px + r, py + ph - r, color);
                c.fill(px + pw - r, py + r, px + pw, py + ph - r, color);
                corners(c, r, 0, px, py, pw, ph, color);
            }
        } else {
            t = Math.min(t, Math.min(pw, ph) / 2);
            if (r == 0) {
                c.fill(px, py, px + pw, py + t, color);
                c.fill(px, py + ph - t, px + pw, py + ph, color);
                c.fill(px, py + t, px + t, py + ph - t, color);
                c.fill(px + pw - t, py + t, px + pw, py + ph - t, color);
            } else {
                c.fill(px + r, py, px + pw - r, py + t, color);
                c.fill(px + r, py + ph - t, px + pw - r, py + ph, color);
                c.fill(px, py + r, px + t, py + ph - r, color);
                c.fill(px + pw - t, py + r, px + pw, py + ph - r, color);
                corners(c, r, Math.min(t, r), px, py, pw, ph, color);
            }
        }
        c.endPixels();
    }

    private static void corners(Canvas c, int r, int t, int px, int py, int pw, int ph, int color) {
        c.cornerMask(r, t, 0, 0, px, py, color);
        c.cornerMask(r, t, 1, 0, px + pw - r, py, color);
        c.cornerMask(r, t, 0, 1, px, py + ph - r, color);
        c.cornerMask(r, t, 1, 1, px + pw - r, py + ph - r, color);
    }
}
