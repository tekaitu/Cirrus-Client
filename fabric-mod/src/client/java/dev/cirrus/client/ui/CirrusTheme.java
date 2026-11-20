package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;

/**
 * The one Cirrus look: flat black surfaces, white text, thin grey borders. No blur, gradients, glow or textures.
 * Values are packed ARGB; accent and cyan are white so selected and active states read as white outlines and fills.
 */
public enum CirrusTheme {
    DARK(0xFF000000, 0xFF000000, 0xFF0D0D0D, 0xFF3A3A3A, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFC4C4C4, 0xFF35D49A, 0x00000000, 0x00000000, 0x00000000);
    public final int overlay, panel, surface, border, accent, cyan, text, muted, good, glow, highlight, shadow;
    CirrusTheme(int overlay,int panel,int surface,int border,int accent,int cyan,int text,int muted,int good,int glow,int highlight,int shadow){this.overlay=overlay;this.panel=panel;this.surface=surface;this.border=border;this.accent=accent;this.cyan=cyan;this.text=text;this.muted=muted;this.good=good;this.glow=glow;this.highlight=highlight;this.shadow=shadow;}
    public static CirrusTheme current(CirrusConfig config){return DARK;}
}
