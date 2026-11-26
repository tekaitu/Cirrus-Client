package dev.cirrus.client.ui;

import dev.cirrus.core.theme.CirrusTheme;

/** The theme tokens as constants for call sites that have no theme in scope. See {@link CirrusTheme} for what each is for. */
public final class Look {
    private Look() { }
    public static final int SURFACE = CirrusTheme.DARK.surface, SURFACE_HOVER = CirrusTheme.DARK.surfaceHover;
    public static final int FIELD = CirrusTheme.DARK.field, FIELD_HOVER = CirrusTheme.DARK.fieldHover;
    public static final int POPUP = CirrusTheme.DARK.popup, BORDER = CirrusTheme.DARK.border;
    /** A dark tint for panels that sit straight over a bright scene (title screen), where the white surface tints would wash out. */
    public static final int SCENE = 0x73000000;
}
