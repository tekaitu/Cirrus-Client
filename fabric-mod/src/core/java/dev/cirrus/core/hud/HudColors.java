package dev.cirrus.core.hud;

import dev.cirrus.core.settings.Setting;
import dev.cirrus.core.theme.Brand;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** The text colours a HUD widget offers. Named, so a config or share code can only ever select one of these. */
public final class HudColors {
    private HudColors() { }

    public static final String WHITE = "White";
    public static final List<String> NAMES = Collections.unmodifiableList(Arrays.asList(WHITE, "Maple", "Peach", "Yellow", "Green", "Red", "Blue", "Grey"));
    private static final int[] VALUES = {0xFFFFFFFF, Brand.MAIN, Brand.LIGHTER, 0xFFFFD54A, 0xFF5BD97A, 0xFFFF5A5A, 0xFF5AA9FF, 0xFFB0B0B0};

    /** The shared "Text colour" option. */
    public static Setting setting() {
        return Setting.choice("color", "Text colour", "Colour of the text.", WHITE, NAMES.toArray(new String[0])).group("Text");
    }

    /** Opaque ARGB for a colour name; anything unknown is white. */
    public static int argb(String name) {
        int i = NAMES.indexOf(name);
        return i < 0 ? VALUES[0] : VALUES[i];
    }
}
