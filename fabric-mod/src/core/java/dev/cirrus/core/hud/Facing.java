package dev.cirrus.core.hud;

/** Compass direction from a Minecraft yaw (0 = south, 90 = west, 180 = north, 270 = east). */
public final class Facing {
    private Facing() { }

    private static final String[] NAMES = {"S", "SW", "W", "NW", "N", "NE", "E", "SE"};

    public static String of(float yaw) {
        float y = yaw % 360f;
        if (y < 0) y += 360f;
        return NAMES[Math.round(y / 45f) % 8];
    }
}
