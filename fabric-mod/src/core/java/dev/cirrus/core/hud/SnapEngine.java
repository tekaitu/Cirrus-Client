package dev.cirrus.core.hud;

import java.util.List;

/**
 * Magnetic alignment for the HUD editor. A moving box snaps its left, centre and right edges (and its top, middle and bottom)
 * to the screen's edges and centre and to the same lines of every other widget, when one is within the threshold. The line it
 * snapped to is reported so the editor can draw a guide. Pure arithmetic, in GUI units.
 */
public final class SnapEngine {
    private SnapEngine() { }

    /** Value of {@link Result#guideX} / {@link Result#guideY} when nothing was snapped on that axis. */
    public static final int NONE = Integer.MIN_VALUE;

    public static final class Result {
        public final int x, y, guideX, guideY;
        Result(int x, int y, int guideX, int guideY) { this.x = x; this.y = y; this.guideX = guideX; this.guideY = guideY; }
        public boolean snappedX() { return guideX != NONE; }
        public boolean snappedY() { return guideY != NONE; }
    }

    /**
     * @param others other widgets as {x, y, width, height}; may be null
     * @param threshold how close, in GUI units, an edge must be to snap; zero or less disables snapping
     */
    public static Result snap(int x, int y, int w, int h, int screenW, int screenH, List<int[]> others, int threshold) {
        if (threshold <= 0) return new Result(x, y, NONE, NONE);
        int[] ax = axis(x, w, screenW, others, 0, 2, threshold);
        int[] ay = axis(y, h, screenH, others, 1, 3, threshold);
        return new Result(ax[0], ay[0], ax[1], ay[1]);
    }

    /** Returns {snapped position, guide line or NONE} for one axis. {@code posIdx}/{@code sizeIdx} pick x/width or y/height from the boxes. */
    private static int[] axis(int pos, int size, int screen, List<int[]> others, int posIdx, int sizeIdx, int threshold) {
        int[] mine = {pos, pos + size / 2, pos + size};
        int bestDelta = 0, bestGuide = NONE, bestAbs = threshold + 1;
        for (int i = 0; i < mine.length; i++) {
            // screen edges and centre
            for (int t = 0; t < 3; t++) {
                int target = t == 0 ? 0 : t == 1 ? screen / 2 : screen;
                int d = target - mine[i];
                if (Math.abs(d) < bestAbs) { bestAbs = Math.abs(d); bestDelta = d; bestGuide = target; }
            }
            if (others == null) continue;
            for (int[] o : others) {
                int[] lines = {o[posIdx], o[posIdx] + o[sizeIdx] / 2, o[posIdx] + o[sizeIdx]};
                for (int target : lines) {
                    int d = target - mine[i];
                    if (Math.abs(d) < bestAbs) { bestAbs = Math.abs(d); bestDelta = d; bestGuide = target; }
                }
            }
        }
        return bestGuide == NONE ? new int[] {pos, NONE} : new int[] {pos + bestDelta, bestGuide};
    }
}
