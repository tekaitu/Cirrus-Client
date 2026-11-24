package dev.cirrus.core.render;

import dev.cirrus.core.text.TextStyle;

import java.util.ArrayList;
import java.util.List;

/** A Canvas that only records calls, so drawing code can be tested and counted without a game. */
final class RecordingCanvas implements Canvas {
    static final class Fill { final int x0, y0, x1, y1, argb; Fill(int x0, int y0, int x1, int y1, int argb) { this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1; this.argb = argb; } }
    static final class Mask { final int r, t, qx, qy, x, y; Mask(int r, int t, int qx, int qy, int x, int y) { this.r = r; this.t = t; this.qx = qx; this.qy = qy; this.x = x; this.y = y; } }

    final int scale;
    final List<Fill> fills = new ArrayList<Fill>();
    final List<Mask> masks = new ArrayList<Mask>();
    int begins, ends, depth, maxDepth;
    boolean fillOutsidePixelSpace;

    RecordingCanvas(int scale) { this.scale = scale; }

    @Override public int scale() { return scale; }
    @Override public void beginPixels() { begins++; depth++; maxDepth = Math.max(maxDepth, depth); }
    @Override public void endPixels() { ends++; depth--; }
    @Override public void fill(int x0, int y0, int x1, int y1, int argb) { if (depth != 1) fillOutsidePixelSpace = true; fills.add(new Fill(x0, y0, x1, y1, argb)); }
    @Override public void cornerMask(int r, int t, int qx, int qy, int x, int y, int argb) { masks.add(new Mask(r, t, qx, qy, x, y)); }
    @Override public void icon(int index, int x, int y, int size, int argb) { }
    @Override public void text(String text, TextStyle style, int x, int y, int argb, boolean shadow) { }
    @Override public void pushTransform(float x, float y, float scale) { }
    @Override public void popTransform() { }
    @Override public void pushClip(int x, int y, int w, int h) { }
    @Override public void popClip() { }

    int ops() { return fills.size() + masks.size(); }
}
