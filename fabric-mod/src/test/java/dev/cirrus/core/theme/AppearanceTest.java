package dev.cirrus.core.theme;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.settings.ModSettings;
import dev.cirrus.core.settings.Setting;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AppearanceTest {
    private static CirrusConfig config() {
        try { return CirrusConfig.get(java.nio.file.Files.createTempDirectory("cirrus-appearance")); } catch (java.io.IOException e) { throw new IllegalStateException(e); }
    }
    private static Setting setting(String key) { return ModSettings.find(Appearance.settings(), key); }
    private static void set(CirrusConfig c, String key, String value) { ModSettings.set(c, Appearance.ID, setting(key), value); }

    @Test void defaultsAreTheMapleLook() {
        CirrusTheme t = Appearance.theme(config());
        CirrusTheme d = CirrusTheme.DARK;
        assertEquals(d.accent, t.accent);
        assertEquals(d.accentLight, t.accentLight);
        assertEquals(d.accentDark, t.accentDark);
        assertEquals(d.text, t.text);
        assertEquals(d.muted, t.muted);
        assertEquals(d.panel, t.panel);
        assertEquals(d.popup, t.popup);
        assertEquals(d.overlay, t.overlay);
        assertEquals(d.surface, t.surface);
        assertFalse(Appearance.minecraftFont(config()));
        assertTrue(Appearance.blurHudEditor(config()), "the HUD editor blurs the game by default");
        assertFalse(Appearance.blurMenus(config()));
    }

    @Test void accentChoiceChangesTheHighlightColours() {
        CirrusConfig c = config();
        set(c, "accent", "Ocean");
        CirrusTheme t = Appearance.theme(c);
        assertNotEquals(Brand.MAIN, t.accent);
        assertEquals(0xFF2E8BE6, t.accent);
        assertNotEquals(t.accent, t.accentLight);
        assertNotEquals(t.accent, t.accentDark);
        set(c, "accent", "Maple");
        assertEquals(Brand.MAIN, Appearance.theme(c).accent);
    }

    @Test void menuOpacityScalesThePanelAlphaOnly() {
        CirrusConfig c = config();
        set(c, "menuopacity", "100");
        CirrusTheme solid = Appearance.theme(c);
        set(c, "menuopacity", "40");
        CirrusTheme airy = Appearance.theme(c);
        assertEquals(255, solid.panel >>> 24);
        assertEquals(Math.round(255 * 0.4f), airy.panel >>> 24);
        assertEquals(solid.panel & 0xFFFFFF, airy.panel & 0xFFFFFF);
        assertEquals(solid.popup, airy.popup, "popups stay near-opaque so their text is always readable");
    }

    @Test void screenDimSetsTheOverlayAlpha() {
        CirrusConfig c = config();
        set(c, "dim", "0");
        assertEquals(0, Appearance.theme(c).overlay >>> 24);
        set(c, "dim", "60");
        assertEquals(Math.round(255 * 0.6f), Appearance.theme(c).overlay >>> 24);
    }

    @Test void themesChangeTheSurfacesAndStayDark() {
        CirrusConfig c = config();
        int maple = Appearance.theme(c).panel;
        for (String name : Appearance.THEMES) {
            set(c, "theme", name);
            CirrusTheme t = Appearance.theme(c);
            int rgb = t.panel & 0xFFFFFF;
            int luma = (((rgb >> 16) & 0xFF) * 3 + ((rgb >> 8) & 0xFF) * 6 + (rgb & 0xFF)) / 10;
            assertTrue(luma < 70, name + " must stay dark for white text");
        }
        set(c, "theme", "Midnight");
        assertNotEquals(maple & 0xFFFFFF, Appearance.theme(c).panel & 0xFFFFFF);
    }

    @Test void textColourAndFontAndBlurAreReadable() {
        CirrusConfig c = config();
        set(c, "textcolor", "Warm");
        assertEquals(0xFFFFF0E3, Appearance.theme(c).text);
        set(c, "font", "Minecraft");
        assertTrue(Appearance.minecraftFont(c));
        set(c, "blur", "All menus");
        assertTrue(Appearance.blurMenus(c));
        assertTrue(Appearance.blurHudEditor(c));
        set(c, "blur", "Off");
        assertFalse(Appearance.blurHudEditor(c));
    }

    @Test void unknownStoredValuesFallBackToDefaults() {
        CirrusConfig c = config();
        c.put(ModSettings.configKey(Appearance.ID, "accent"), "Hotpink");
        c.put(ModSettings.configKey(Appearance.ID, "menuopacity"), "9999");
        CirrusTheme t = Appearance.theme(c);
        assertEquals(Brand.MAIN, t.accent);
        assertTrue((t.panel >>> 24) <= 255);
    }

    @Test void glassIsAirierBrighterRimmedAndBlursMenus() {
        CirrusConfig c = config();
        set(c, "theme", "Graphite");
        CirrusTheme graphite = Appearance.theme(c);
        assertFalse(graphite.glass);
        assertFalse(Appearance.blurMenus(c), "only Glass blurs menus on its own");
        set(c, "theme", "Glass");
        CirrusTheme glass = Appearance.theme(c);
        assertTrue(glass.glass && Appearance.glass(c));
        assertTrue((glass.panel >>> 24) < (graphite.panel >>> 24), "more of the game shows through");
        assertTrue((glass.border >>> 24) > (graphite.border >>> 24), "a visible rim");
        assertTrue(Appearance.blurMenus(c), "Glass blurs behind menus by default");
        set(c, "blur", "Off");
        assertFalse(Appearance.blurMenus(c), "blur Off wins");
        set(c, "blur", "All menus");
        set(c, "theme", "Maple");
        assertTrue(Appearance.blurMenus(c));
    }

    @Test void menuOpacityCanGoDownToFifteenPercent() {
        CirrusConfig c = config();
        set(c, "menuopacity", "5");
        assertEquals(Math.round(255 * 0.15f), Appearance.theme(c).panel >>> 24);
    }

    @Test void resetRestoresTheDefaultLook() {
        CirrusConfig c = config();
        set(c, "accent", "Rose");
        set(c, "theme", "Glass");
        ModSettings.reset(c, Appearance.ID, Appearance.settings());
        assertEquals(CirrusTheme.DARK.accent, Appearance.theme(c).accent);
        assertEquals(CirrusTheme.DARK.panel, Appearance.theme(c).panel);
    }
}
