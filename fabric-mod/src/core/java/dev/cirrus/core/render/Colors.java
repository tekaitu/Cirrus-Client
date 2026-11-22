package dev.cirrus.core.render;

/** Packed ARGB colour helpers. */
public final class Colors {
    private Colors() { }

    public static int alpha(int argb) { return argb >>> 24; }
    public static int withAlpha(int argb, int a) { return (Math.max(0, Math.min(255, a)) << 24) | (argb & 0xFFFFFF); }
    public static int scaleAlpha(int argb, float f) { return withAlpha(argb, Math.round(alpha(argb) * f)); }

    /** Linear blend of two ARGB colours; {@code t} is clamped to 0..1. */
    public static int mix(int a, int b, float t) {
        t = Math.max(0f, Math.min(1f, t));
        int aa = Math.round(((a >>> 24) & 255) * (1 - t) + ((b >>> 24) & 255) * t);
        int r = Math.round(((a >>> 16) & 255) * (1 - t) + ((b >>> 16) & 255) * t);
        int g = Math.round(((a >>> 8) & 255) * (1 - t) + ((b >>> 8) & 255) * t);
        int bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
        return aa << 24 | r << 16 | g << 8 | bl;
    }
}
