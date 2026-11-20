package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;

/**
 * Palette tokens for all Cirrus screens. Values are packed ARGB and mirror the
 * launcher's own tokens: pure black and near-black surfaces, hairline white
 * borders, white as the single highlight and a short ladder of neutral grays
 * for everything that supports it. There is no hue in the system.
 *
 * Field names are kept from the earlier pass so every screen keeps compiling;
 * read them as roles: {@code accent} is the highlight, {@code cyan} the
 * secondary gray label, {@code glow} the shadow under a filled control.
 */
public enum CirrusTheme {
    DARK(0xB3050505,0xE60A0A0A,0xCC1A1A1A,0x26FFFFFF,0xFFFFFFFF,0xFFA8A8A8,0xFFF5F5F5,0xFF8A8A8A,0xFF4FBF8B,0x33000000,0x14FFFFFF,0x66000000,0x29FFFFFF,0xFF0A0A0A,0xFF1E1E1E,0xFF0D0D0D),
    LIGHT(0xB3F1F1F1,0xF2FFFFFF,0xE6EDEDED,0x33000000,0xFF0C0C0C,0xFF5E5E5E,0xFF101010,0xFF606060,0xFF10855A,0x26000000,0x40FFFFFF,0x33101010,0x14101010,0xFFFFFFFF,0xFFFFFFFF,0xFFEEEEEE);
    public final int overlay, panel, surface, border, accent, cyan, text, muted, good, glow, highlight, shadow, accentSoft, onAccent, pageTop, pageBottom;
    CirrusTheme(int overlay,int panel,int surface,int border,int accent,int cyan,int text,int muted,int good,int glow,int highlight,int shadow,int accentSoft,int onAccent,int pageTop,int pageBottom){this.overlay=overlay;this.panel=panel;this.surface=surface;this.border=border;this.accent=accent;this.cyan=cyan;this.text=text;this.muted=muted;this.good=good;this.glow=glow;this.highlight=highlight;this.shadow=shadow;this.accentSoft=accentSoft;this.onAccent=onAccent;this.pageTop=pageTop;this.pageBottom=pageBottom;}
    public static CirrusTheme current(CirrusConfig config){return "LIGHT".equals(config.getString("theme","DARK"))?LIGHT:DARK;}
    public static void set(CirrusConfig config,CirrusTheme theme){config.put("theme",theme.name());}
}
