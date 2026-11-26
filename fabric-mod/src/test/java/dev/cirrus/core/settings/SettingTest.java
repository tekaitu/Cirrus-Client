package dev.cirrus.core.settings;

import dev.cirrus.core.hud.HudMod;

import dev.cirrus.core.config.CirrusConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SettingTest {
    private static final Setting SCALE = Setting.slider("scale", "Scale", "", 100, 50, 200, 10, "%");
    private static final Setting BG = Setting.toggle("background", "Background", "", true);
    private static final Setting OPACITY = Setting.slider("opacity", "Opacity", "", 80, 10, 100, 5, "%").requires("background", "true");
    private static final Setting DISPLAY = Setting.choice("display", "Display", "", "Both", "Number", "Percentage", "Both", "None");
    private static final List<Setting> ALL = List.of(SCALE, BG, OPACITY, DISPLAY);

    @Test void togglesAcceptOnlyBooleans() {
        assertEquals("true", BG.normalize("TRUE"));
        assertEquals("false", BG.normalize("false"));
        assertEquals("true", BG.normalize("banana"), "invalid values fall back to the default");
        assertEquals("true", BG.normalize(null));
    }

    @Test void choicesMustBeOneOfTheListedValues() {
        assertEquals("Number", DISPLAY.normalize("Number"));
        assertEquals("Both", DISPLAY.normalize("number"), "values are case sensitive; anything unknown is the default");
        assertEquals("Both", DISPLAY.normalize(""));
        assertThrows(IllegalArgumentException.class, () -> Setting.choice("x", "X", "", "Nope", "A", "B"));
    }

    @Test void slidersClampAndSnapToTheirStep() {
        assertEquals("200", SCALE.normalize("999"));
        assertEquals("50", SCALE.normalize("-5"));
        assertEquals("110", SCALE.normalize("107"));
        assertEquals("100", SCALE.normalize("abc"));
        assertEquals("100", SCALE.normalize(" 100 "));
        assertThrows(IllegalArgumentException.class, () -> Setting.slider("s", "S", "", 5, 10, 20, 1, ""));
    }

    @Test void steppingWrapsChoicesAndStopsSlidersAtTheirEnds() {
        assertEquals("false", BG.step("true", 1));
        assertEquals("true", BG.step("false", -1));
        assertEquals("None", DISPLAY.step("Both", 1));
        assertEquals("Number", DISPLAY.step("None", 1), "wraps forward");
        assertEquals("None", DISPLAY.step("Number", -1), "wraps backward");
        assertEquals("110", SCALE.step("100", 1));
        assertEquals("200", SCALE.step("200", 1));
        assertEquals("50", SCALE.step("50", -1));
    }

    @Test void sliderFractionsRoundTrip() {
        assertEquals("50", SCALE.fromFraction(-1));
        assertEquals("200", SCALE.fromFraction(2));
        assertEquals("130", SCALE.fromFraction(0.5333));
        assertEquals(0.0, SCALE.fraction("50"), 1e-9);
        assertEquals(1.0, SCALE.fraction("200"), 1e-9);
    }

    @Test void displayText() {
        assertEquals("On", BG.display("true"));
        assertEquals("Off", BG.display("false"));
        assertEquals("120%", SCALE.display("120"));
        assertEquals("Both", DISPLAY.display("Both"));
    }

    @Test void dependenciesDisableOptions(@TempDir Path dir) {
        CirrusConfig c = CirrusConfig.get(dir);
        assertTrue(ModSettings.active(c, "m", ALL, OPACITY));
        ModSettings.set(c, "m", BG, "false");
        assertFalse(ModSettings.active(c, "m", ALL, OPACITY));
        assertTrue(ModSettings.active(c, "m", ALL, BG), "options without a dependency are always active");
    }

    @Test void settingsPersistNormalizedAndResetToDefaults(@TempDir Path dir) {
        CirrusConfig c = CirrusConfig.get(dir);
        assertEquals(100, ModSettings.number(c, "m", ALL, "scale"));
        ModSettings.set(c, "m", SCALE, "999");
        assertEquals(200, ModSettings.number(c, "m", ALL, "scale"));
        ModSettings.set(c, "m", DISPLAY, "Percentage");
        c.put(ModSettings.configKey("m", "opacity"), "garbage");
        assertEquals(80, ModSettings.number(c, "m", ALL, "opacity"), "a corrupt stored value reads as the default");
        // survives a reload from disk
        assertEquals("Percentage", ModSettings.get(CirrusConfig.get(dir), "m", ALL, "display"));
        ModSettings.reset(c, "m", ALL);
        assertEquals(100, ModSettings.number(c, "m", ALL, "scale"));
        assertEquals("Both", ModSettings.get(c, "m", ALL, "display"));
    }

    @Test void settingsAreIndependentPerFeature(@TempDir Path dir) {
        CirrusConfig c = CirrusConfig.get(dir);
        ModSettings.set(c, "armor_status", DISPLAY, "Number");
        assertEquals("Both", ModSettings.get(c, "ping", ALL, "display"));
    }

    @Test void unknownKeysAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> ModSettings.find(ALL, "nope"));
    }

    @Test void commonHudAppearanceOptionsAreConsistent() {
        List<String> keys = HudMod.APPEARANCE.stream().map(Setting::key).toList();
        assertEquals(List.of("scale", "background", "bgcolor", "opacity", "border", "shadow"), keys);
        for (Setting s : HudMod.APPEARANCE) assertEquals(s.defaultValue(), s.normalize(s.defaultValue()));
        assertEquals("background", HudMod.APPEARANCE.get(2).requiresKey());
        assertEquals("background", HudMod.APPEARANCE.get(3).requiresKey());
    }
}
