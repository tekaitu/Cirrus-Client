package dev.cirrus.core.theme;

import dev.cirrus.core.config.CirrusConfig;

/**
 * The one Maple look: flat black surfaces, white text, thin grey borders, and the {@link Brand} orange for anything active.
 * No blur, gradients, glow or textures. Values are packed ARGB. {@code accent} marks selected, focused and active states;
 * {@code accentLight} is for headings and hover emphasis, {@code accentDark} for pressed states and fills behind white text.
 * ({@code cyan} is the historical name of the heading colour and now holds {@code accentLight}.)
 */
public enum CirrusTheme {
    DARK(0xFF000000, 0xFF000000, 0xFF0D0D0D, 0xFF3A3A3A, Brand.MAIN, Brand.LIGHT, Brand.DARK, 0xFFFFFFFF, 0xFFC4C4C4, 0xFF35D49A, 0x00000000, 0x00000000, 0x00000000);
    public final int overlay, panel, surface, border, accent, cyan, accentDark, text, muted, good, glow, highlight, shadow;
    public final int accentLight;
    CirrusTheme(int overlay,int panel,int surface,int border,int accent,int accentLight,int accentDark,int text,int muted,int good,int glow,int highlight,int shadow){this.overlay=overlay;this.panel=panel;this.surface=surface;this.border=border;this.accent=accent;this.accentLight=accentLight;this.cyan=accentLight;this.accentDark=accentDark;this.text=text;this.muted=muted;this.good=good;this.glow=glow;this.highlight=highlight;this.shadow=shadow;}
    public static CirrusTheme current(CirrusConfig config){return DARK;}
}
