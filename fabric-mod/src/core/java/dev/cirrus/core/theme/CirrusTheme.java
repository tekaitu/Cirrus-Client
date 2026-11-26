package dev.cirrus.core.theme;

import dev.cirrus.core.config.CirrusConfig;

/**
 * The one Maple look: translucent graphite surfaces over the game, white text, hairline borders at low contrast, and the
 * {@link Brand} orange only for what is active (toggles, selection marks, primary buttons). No blur, gradients, glow or textures.
 * Values are packed ARGB. The game stays visible: {@code overlay} is a light dim, {@code panel} is about 80% opaque,
 * {@code surface}/{@code surfaceHover} are faint white tints for rows, buttons and cards that sit on a panel, {@code field} is a
 * faint dark inset for inputs, and {@code popup} is the near-opaque surface for menus and tooltips so text stays readable.
 * {@code accentLight} is for headings and hover emphasis, {@code accentDark} for pressed states and fills behind white text.
 * ({@code cyan} is the historical name of the heading colour and now holds {@code accentLight}.)
 */
public enum CirrusTheme {
    DARK(0x4D000000, 0xCC14161A, 0x1AFFFFFF, 0x1FFFFFFF, Brand.MAIN, Brand.LIGHT, Brand.DARK, 0xFFFFFFFF, 0xFFB9BDC4, 0xFF35D49A,
        0x2BFFFFFF, 0x40000000, 0x26FFFFFF, 0xF2181A1F);
    public final int overlay, panel, surface, border, accent, cyan, accentDark, text, muted, good, surfaceHover, field, fieldHover, popup;
    public final int accentLight;
    CirrusTheme(int overlay, int panel, int surface, int border, int accent, int accentLight, int accentDark, int text, int muted, int good,
                int surfaceHover, int field, int fieldHover, int popup) {
        this.overlay = overlay; this.panel = panel; this.surface = surface; this.border = border;
        this.accent = accent; this.accentLight = accentLight; this.cyan = accentLight; this.accentDark = accentDark;
        this.text = text; this.muted = muted; this.good = good;
        this.surfaceHover = surfaceHover; this.field = field; this.fieldHover = fieldHover; this.popup = popup;
    }
    public static CirrusTheme current(CirrusConfig config) { return DARK; }
}
