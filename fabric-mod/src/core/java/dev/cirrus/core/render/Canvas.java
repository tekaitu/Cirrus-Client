package dev.cirrus.core.render;

import dev.cirrus.core.text.TextStyle;

/**
 * Cirrus' rendering abstraction. Core draws every Cirrus surface through this interface and never touches Minecraft, OpenGL or a
 * windowing library. Each Minecraft version provides one implementation on top of that version's own GUI pipeline, so Cirrus
 * does not run a renderer of its own and keeps working when Mojang changes the graphics backend underneath.
 *
 * <p>Coordinate spaces: {@link #fill}, {@link #cornerMask} use the <em>current space</em>, which is GUI units normally and
 * physical screen pixels between {@link #beginPixels()} and {@link #endPixels()}. {@link #icon}, {@link #text}, {@link #pushClip}
 * always use GUI units. Implementations are used from the render thread only.
 */
public interface Canvas {
    /** Physical pixels per GUI unit (at least 1). */
    int scale();

    /** Switches the current space to physical pixels. Must be balanced by {@link #endPixels()}; calls do not nest. */
    void beginPixels();

    void endPixels();

    /** Fills {@code [x0, x1) x [y0, y1)} with an ARGB colour. */
    void fill(int x0, int y0, int x1, int y1, int argb);

    /**
     * Draws one quadrant of the anti-aliased corner mask (see {@link CornerMask}) at {@code (x, y)}, {@code r x r} in size.
     * {@code qx, qy} are 0 or 1: 0,0 top-left, 1,0 top-right, 0,1 bottom-left, 1,1 bottom-right. {@code t == 0} is a filled disc.
     */
    void cornerMask(int r, int t, int qx, int qy, int x, int y, int argb);

    /** One glyph of the Cirrus icon sheet (see {@link Icons}), tinted, {@code size x size} GUI units. */
    void icon(int index, int x, int y, int size, int argb);

    void text(String text, TextStyle style, int x, int y, int argb, boolean shadow);

    /** Restricts drawing to a rectangle until {@link #popClip()}. Clips do not nest. */
    void pushClip(int x, int y, int w, int h);

    void popClip();
}
