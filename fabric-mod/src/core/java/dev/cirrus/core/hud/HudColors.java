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
    public static final List<String> NAMES = Collections.unmodifiableList(Arrays.asList(WHITE, "Maple", "Peach", "Yellow", "Green", "Red", "Blue", "Grey", "Black"));
    private static final int[] VALUES = {0xFFFFFFFF, Brand.MAIN, Brand.LIGHTER, 0xFFFFD54A, 0xFF5BD97A, 0xFFFF5A5A, 0xFF5AA9FF, 0xFFB0B0B0, 0xFF111111};

    public static final String BLACK = "Black";
    /** Background colours (the opacity is a separate option), darkest first so the default reads like the old look. */
    public static final List<String> BACKGROUNDS = Collections.unmodifiableList(Arrays.asList("Black", "Graphite", "Maple", "Navy", "Forest", "Wine", "White"));
    private static final int[] BACKGROUND_VALUES = {0xFF000000, 0xFF1B1E24, Brand.DARKER, 0xFF14284B, 0xFF123524, 0xFF4A1626, 0xFFF2F2F2};

    /** The "Background colour" option. */
    public static Setting backgroundSetting() {
        return Setting.choice("bgcolor", "Background colour", "Colour of the panel behind the text. The opacity is set separately.", BLACK,
            BACKGROUNDS.toArray(new String[0])).requires("background", "true").group("Appearance");
    }

    /** Opaque RGB for a background colour name; anything unknown is black. */
    public static int background(String name) {
        int i = BACKGROUNDS.indexOf(name);
        return i < 0 ? BACKGROUND_VALUES[0] : BACKGROUND_VALUES[i];
    }

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
