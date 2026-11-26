package dev.cirrus.core.render;

/**
 * Anti-aliased coverage of a disc (thickness 0) or ring, {@code 2r x 2r} pixels. Drawn as four quadrants for the corners of
 * rounded rectangles. Pure maths; the adapter uploads the result as a texture once per (radius, thickness) and caches it.
 */
public final class CornerMask {
    private static final int SAMPLES = 6;
    private CornerMask() { }

    /** Row-major alpha values 0..255, length {@code (2r) * (2r)}. */
    public static int[] alpha(int r, int t) {
        int size = r * 2;
        int[] out = new int[size * size];
        for (int j = 0; j < size; j++) {
            for (int i = 0; i < size; i++) {
                int hit = 0;
                for (int sy = 0; sy < SAMPLES; sy++) for (int sx = 0; sx < SAMPLES; sx++) {
                    double dx = i + (sx + 0.5) / SAMPLES - r, dy = j + (sy + 0.5) / SAMPLES - r;
                    double d = Math.sqrt(dx * dx + dy * dy);
                    if (d <= r && (t == 0 || d >= r - t)) hit++;
                }
                out[j * size + i] = Math.round(255f * hit / (SAMPLES * SAMPLES));
            }
        }
        return out;
    }
}
