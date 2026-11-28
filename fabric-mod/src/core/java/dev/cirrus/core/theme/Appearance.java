package dev.cirrus.core.theme;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.render.Colors;
import dev.cirrus.core.settings.ModSettings;
import dev.cirrus.core.settings.Setting;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * The Appearance page: how the menus and widgets look. Every option is a normal setting stored under {@code mod.appearance.<key>}, so it
 * is saved with profiles and share codes like any other, and {@link #theme} resolves the current choices to a {@link CirrusTheme}
 * on every call (cheaply, with a one-entry cache), so a change is visible the moment it is made.
 * <ul>
 * <li>Theme: the surface palette (Maple, Graphite, Midnight, Glass). All are dark so white text stays readable.</li>
 * <li>Accent: the highlight colour. Maple orange is the default; the others are for players who want a different one.</li>
 * <li>Text colour, UI font (Maple's own or Minecraft's), menu opacity, screen dim and background blur.</li>
 * </ul>
 */
public final class Appearance {
    private Appearance() { }

    public static final String ID = "appearance";
    private static final int GLASS = 3; // index of "Glass" in THEMES

    public static final String[] THEMES = {"Maple", "Graphite", "Midnight", "Glass"};
    public static final String[] ACCENTS = {"Maple", "Ocean", "Forest", "Violet", "Rose", "Gold"};
    public static final String[] TEXTS = {"White", "Warm", "Cool", "Soft"};
    public static final String[] FONTS = {"Maple", "Minecraft"};
    public static final String BLUR_OFF = "Off", BLUR_HUD = "HUD editor", BLUR_ALL = "All menus";
    public static final String[] BLURS = {BLUR_OFF, BLUR_HUD, BLUR_ALL};

    // panel / popup RGB and the white-ish tint used for rows, per theme (same order as THEMES)
    private static final int[] PANEL = {0x14161A, 0x1E1E1E, 0x0D1530, 0x0F141B};
    private static final int[] POPUP = {0x181A1F, 0x242424, 0x121B3A, 0x20252E};
    private static final int[] TINT = {0xFFFFFF, 0xFFFFFF, 0x9DB8FF, 0xFFFFFF};
    private static final int[] PANEL_ALPHA_SCALE = {100, 100, 100, 62}; // Glass is airier at the same opacity setting
    private static final int[] ACCENT_BASE = {Brand.MAIN, 0xFF2E8BE6, 0xFF2FA866, 0xFF8A5CE0, 0xFFE0508C, 0xFFD9A21B};
    private static final int[] TEXT_COLOR = {0xFFFFFFFF, 0xFFFFF0E3, 0xFFE4EEFF, 0xFFE3E3E3};

    private static final List<Setting> SETTINGS = Collections.unmodifiableList(Arrays.asList(
        Setting.choice("theme", "Theme", "The colours of every menu surface. All themes are dark so text stays readable.", "Maple", THEMES).group("Look"),
        Setting.choice("accent", "Accent colour", "Highlights: selected tabs, switches, sliders and primary buttons.", "Maple", ACCENTS).group("Look"),
        Setting.choice("textcolor", "Text colour", "The colour of the text in menus.", "White", TEXTS).group("Look"),
        Setting.choice("font", "Font", "Maple's own UI font, or the Minecraft font, for menus and widgets.", "Maple", FONTS).group("Look"),
        Setting.slider("menuopacity", "Menu opacity", "How solid the menu panels are. Lower lets more of the game show through.", 80, 15, 100, 5, "%").group("Transparency"),
        Setting.slider("dim", "Screen dim", "How much the game is darkened behind menus (in a world).", 30, 0, 60, 5, "%").group("Transparency"),
        Setting.choice("blur", "Blur game background", "Blur the game behind the HUD editor, or behind every menu. The Glass theme blurs behind menus unless this is Off. Needs Menu Background Blurriness above 0 in Video Settings.", BLUR_HUD, BLURS).group("Background")));

    /** The Appearance options, in display order. */
    public static List<Setting> settings() { return SETTINGS; }

    private static String get(CirrusConfig c, String key) { return ModSettings.get(c, ID, SETTINGS, key); }
    private static int index(String[] names, String value) { for (int i = 0; i < names.length; i++) if (names[i].equals(value)) return i; return 0; }

    /** Resolved choices as one string, to detect a change cheaply. */
    private static String key(CirrusConfig c) {
        return get(c, "theme") + '|' + get(c, "accent") + '|' + get(c, "textcolor") + '|' + get(c, "menuopacity") + '|' + get(c, "dim");
    }

    private static volatile String cachedKey;
    private static volatile CirrusTheme cached;

    /** The look the player chose. With every option at its default this equals {@link CirrusTheme#DARK}. */
    public static CirrusTheme theme(CirrusConfig config) {
        if (config == null) return CirrusTheme.DARK;
        String k = key(config);
        CirrusTheme t = cached;
        if (t != null && k.equals(cachedKey)) return t;
        t = build(index(THEMES, get(config, "theme")), index(ACCENTS, get(config, "accent")), index(TEXTS, get(config, "textcolor")),
            Integer.parseInt(get(config, "menuopacity")), Integer.parseInt(get(config, "dim")));
        cached = t;
        cachedKey = k;
        return t;
    }

    static CirrusTheme build(int theme, int accent, int text, int menuOpacity, int dim) {
        CirrusTheme base = CirrusTheme.DARK;
        int panelAlpha = Math.round(255f * menuOpacity / 100f * PANEL_ALPHA_SCALE[theme] / 100f);
        int panel = Colors.withAlpha(0xFF000000 | PANEL[theme], panelAlpha);
        int tint = TINT[theme];
        boolean glass = theme == GLASS;
        int surface = Colors.withAlpha(tint, glass ? 0x16 : 0x1A), surfaceHover = Colors.withAlpha(tint, glass ? 0x30 : 0x2B);
        int field = base.field, fieldHover = Colors.withAlpha(tint, 0x26);
        int popup = Colors.withAlpha(0xFF000000 | POPUP[theme], glass ? 0xDA : 0xF2);
        int border = Colors.withAlpha(tint, glass ? 0x3C : 0x1F); // glass has a visible rim
        int accentBase = ACCENT_BASE[accent];
        int accentLight = accent == 0 ? Brand.LIGHT : Colors.mix(accentBase, 0xFFFFFFFF, 0.25f);
        int accentDark = accent == 0 ? Brand.DARK : Colors.mix(accentBase, 0xFF000000, 0.35f);
        int textColor = TEXT_COLOR[text];
        int muted = text == 0 ? base.muted : Colors.mix(textColor, 0xFF8A8F98, 0.35f);
        int overlay = Colors.withAlpha(0xFF000000, Math.round(255f * dim / 100f));
        return new CirrusTheme(overlay, panel, surface, border, accentBase, accentLight, accentDark, textColor, muted, base.good, surfaceHover, field, fieldHover, popup, glass);
    }

    /** True when menus and widgets use the Minecraft font instead of Maple's UI font. */
    public static boolean minecraftFont(CirrusConfig config) { return config != null && get(config, "font").equals("Minecraft"); }
    public static boolean blurHudEditor(CirrusConfig config) { return config != null && !get(config, "blur").equals(BLUR_OFF); }
    /** Menus blur the game behind them when asked to ("All menus"), and by default with the Glass theme unless blur is Off. */
    public static boolean blurMenus(CirrusConfig config) {
        if (config == null) return false;
        String blur = get(config, "blur");
        return blur.equals(BLUR_ALL) || (glass(config) && !blur.equals(BLUR_OFF));
    }
    public static boolean glass(CirrusConfig config) { return config != null && index(THEMES, get(config, "theme")) == GLASS; }
}
