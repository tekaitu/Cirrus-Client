package dev.cirrus.core.perf;

import dev.cirrus.core.render.Canvas;
import dev.cirrus.core.render.Shapes;
import dev.cirrus.core.text.TextStyle;

import java.util.Locale;

/**
 * Micro-benchmark of Core's rounded-shape planner against a Canvas that discards everything. It measures only Cirrus' own CPU
 * work (rounding, clamping, deciding which fills and corner masks to issue) and counts the draw operations a shape costs. It does
 * not measure Minecraft, the GPU or a real frame. Run with:
 * {@code java -cp <classes> dev.cirrus.core.perf.ShapesBench}. Not a JUnit test, so it never slows the build.
 */
public final class ShapesBench {
    /** Counts and discards. */
    static final class NullCanvas implements Canvas {
        long fills, masks, begins;
        @Override public int scale() { return 2; }
        @Override public void beginPixels() { begins++; }
        @Override public void endPixels() { }
        @Override public void fill(int x0, int y0, int x1, int y1, int argb) { fills++; }
        @Override public void cornerMask(int r, int t, int qx, int qy, int x, int y, int argb) { masks++; }
        @Override public void icon(int index, int x, int y, int size, int argb) { }
        @Override public void text(String text, TextStyle style, int x, int y, int argb, boolean shadow) { }
        @Override public void pushTransform(float x, float y, float scale) { }
        @Override public void popTransform() { }
        @Override public void pushClip(int x, int y, int w, int h) { }
        @Override public void popClip() { }
    }

    private static void rect(NullCanvas c, int i) { Shapes.fillRound(c, i & 63, i & 31, 90 + (i & 7), 24, 6, 0xFFFFFFFF); }
    private static void outline(NullCanvas c, int i) { Shapes.strokeRound(c, i & 63, i & 31, 90 + (i & 7), 24, 6, 0.5f, 0xFFFFFFFF); }
    private static void shadow(NullCanvas c, int i) { Shapes.shadow(c, i & 63, i & 31, 90, 24, 6, 8, 0xFF000000); }

    private interface Op { void run(NullCanvas c, int i); }

    private static double nsPerCall(String name, Op op) {
        NullCanvas warm = new NullCanvas();
        for (int i = 0; i < 2_000_000; i++) op.run(warm, i);          // JIT warm-up
        double best = Double.MAX_VALUE;
        long fills = 0, masks = 0;
        for (int round = 0; round < 5; round++) {
            NullCanvas c = new NullCanvas();
            int n = 5_000_000;
            long t0 = System.nanoTime();
            for (int i = 0; i < n; i++) op.run(c, i);
            double ns = (System.nanoTime() - t0) / (double) n;
            if (ns < best) { best = ns; fills = c.fills / n; masks = c.masks / n; }
        }
        System.out.println(String.format(Locale.ROOT, "%-22s %7.1f ns/call   %d fills + %d corner masks = %d draw ops", name, best, fills, masks, fills + masks));
        return best;
    }

    public static void main(String[] args) {
        System.out.println("Java " + System.getProperty("java.version") + ", " + Runtime.getRuntime().availableProcessors() + " cores");
        nsPerCall("fillRound", ShapesBench::rect);
        nsPerCall("strokeRound", ShapesBench::outline);
        nsPerCall("shadow (5 layers)", ShapesBench::shadow);
        double panel = nsPerCall("panel (fill+stroke)", (c, i) -> { rect(c, i); outline(c, i); });
        // A busy Click GUI frame is on the order of a few hundred shapes; project the planning cost of 500 panels.
        System.out.println(String.format(Locale.ROOT, "500 panels per frame -> %.3f ms of planning work (excludes drawing)", panel * 500 / 1e6));
    }

    private ShapesBench() { }
}
