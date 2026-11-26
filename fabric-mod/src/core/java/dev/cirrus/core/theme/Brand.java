package dev.cirrus.core.theme;

/**
 * Maple Client's identity: its name, its one brand colour and the shades derived from it. Values are packed ARGB.
 * The shades are straight mixes of {@link #MAIN} (#E25303) with white or black, so every tint stays recognisably the same orange.
 */
public final class Brand {
    private Brand() { }

    public static final String NAME = "Maple Client";
    /** Short form for sentences such as "Maple menu". */
    public static final String SHORT = "Maple";

    /** The brand colour, #E25303. */
    public static final int MAIN = 0xFFE25303;
    /** 25%, 50% and 75% of the way to white. */
    public static final int LIGHT = 0xFFE97E42, LIGHTER = 0xFFF1A981, LIGHTEST = 0xFFF8D4C0;
    /** 25%, 50% and 75% of the way to black. */
    public static final int DARK = 0xFFAA3E02, DARKER = 0xFF712A02, DARKEST = 0xFF391501;

    /** The leaf mark is drawn square, so its width equals its height. */
    public static int markWidth(int height) { return Math.max(1, height); }
}
