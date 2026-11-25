package dev.cirrus.core.hud;

import dev.cirrus.core.settings.Setting;
import dev.cirrus.core.theme.Brand;
import org.junit.jupiter.api.Test;

import java.util.HashSet;

import static org.junit.jupiter.api.Assertions.*;

class HudColorsTest {
    @Test void everyNameMapsToADistinctOpaqueColour() {
        HashSet<Integer> seen = new HashSet<Integer>();
        for (String name : HudColors.NAMES) {
            int argb = HudColors.argb(name);
            assertEquals(0xFF, argb >>> 24, name + " is opaque");
            assertTrue(seen.add(argb), name + " is distinct");
        }
        assertEquals(HudColors.NAMES.size(), seen.size());
    }

    @Test void whiteIsTheDefaultAndUnknownNamesAreWhite() {
        assertEquals(0xFFFFFFFF, HudColors.argb(HudColors.WHITE));
        assertEquals(0xFFFFFFFF, HudColors.argb("Chartreuse"));
        assertEquals(0xFFFFFFFF, HudColors.argb(null));
        assertEquals(HudColors.WHITE, HudColors.setting().defaultValue());
    }

    @Test void theBrandColourIsOffered() {
        assertEquals(Brand.MAIN, HudColors.argb("Maple"));
    }

    @Test void settingOnlyAcceptsNamedColours() {
        Setting s = HudColors.setting();
        assertEquals("color", s.key());
        assertEquals("Red", s.normalize("Red"));
        assertEquals(HudColors.WHITE, s.normalize("#FF0000"));
    }
}
