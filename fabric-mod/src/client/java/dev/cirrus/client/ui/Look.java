package dev.cirrus.client.ui;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.theme.Appearance;
import dev.cirrus.core.theme.CirrusTheme;

/** The theme tokens as constants for call sites that have no theme in scope. See {@link CirrusTheme} for what each is for. */
public final class Look {
    private Look() { }
    // These follow the player's Appearance choices: refresh() copies them from the current theme once per frame, so every component
    // that reads them (even ones with no theme in scope) changes with the theme.
    public static int SURFACE = CirrusTheme.DARK.surface, SURFACE_HOVER = CirrusTheme.DARK.surfaceHover;
    public static int FIELD = CirrusTheme.DARK.field, FIELD_HOVER = CirrusTheme.DARK.fieldHover;
    public static int POPUP = CirrusTheme.DARK.popup, BORDER = CirrusTheme.DARK.border;
    /** The Appearance text colour; used wherever a component asks for plain white text. */
    public static int TEXT = CirrusTheme.DARK.text;
    /** True when the Appearance font is the Minecraft font instead of Maple's UI font. */
    public static boolean MINECRAFT_FONT;
    /** True while the Glass theme is chosen: panels and buttons draw a sheen and a rim. */
    public static boolean GLASS;

    /** Applies the current Appearance to the shared tokens. Call at the start of every frame that draws Maple UI or HUD text. */
    public static void refresh(CirrusConfig config) {
        CirrusTheme t = Appearance.theme(config);
        SURFACE = t.surface; SURFACE_HOVER = t.surfaceHover; FIELD = t.field; FIELD_HOVER = t.fieldHover; POPUP = t.popup; BORDER = t.border;
        TEXT = t.text;
        MINECRAFT_FONT = Appearance.minecraftFont(config);
        GLASS = t.glass;
    }
    /** A dark tint for panels that sit straight over a bright scene (title screen), where the white surface tints would wash out. */
    public static final int SCENE = 0x73000000;
}
