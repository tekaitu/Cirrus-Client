package dev.cirrus.core.input;

/**
 * Cirrus key and modifier codes. The values equal GLFW's, which every modern Minecraft (1.13+) uses, so the Minecraft adapter
 * passes them through unchanged. LWJGL 2 (Minecraft 1.8.9) numbers keys differently; that adapter must translate at the edge
 * and Core code must only ever use these names, never raw numbers or a windowing library's constants.
 */
public final class Keys {
    public static final int UNKNOWN = -1;
    public static final int SPACE = 32, F = 70;
    public static final int ESCAPE = 256, ENTER = 257, TAB = 258, BACKSPACE = 259, DELETE = 261;
    public static final int RIGHT = 262, LEFT = 263, DOWN = 264, UP = 265;
    public static final int LEFT_SHIFT = 340, LEFT_CONTROL = 341, LEFT_ALT = 342, RIGHT_CONTROL = 345, RIGHT_ALT = 346, RIGHT_SHIFT = 344, KP_ENTER = 335;
    public static final int MOD_SHIFT = 1, MOD_CONTROL = 2, MOD_ALT = 4, MOD_SUPER = 8;

    private Keys() { }

    /** Enter on the main block or the keypad. */
    public static boolean isConfirm(int key) { return key == ENTER || key == KP_ENTER; }

    public static boolean isShiftKey(int key) { return key == LEFT_SHIFT || key == RIGHT_SHIFT; }

    public static boolean isControlKey(int key) { return key == LEFT_CONTROL || key == RIGHT_CONTROL; }

    public static boolean isAltKey(int key) { return key == LEFT_ALT || key == RIGHT_ALT; }

    public static boolean hasModifier(int modifiers, int mask) { return (modifiers & mask) != 0; }
}
