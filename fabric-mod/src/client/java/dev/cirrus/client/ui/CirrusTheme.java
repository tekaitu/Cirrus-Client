package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;

/**
 * Palette tokens for all Cirrus screens. Values are packed ARGB and mirror the
 * launcher's own tokens: midnight black and deep navy surfaces, hairline
 * borders, one electric blue accent and cyan for the small highlights.
 */
public enum CirrusTheme {
    DARK(0xB305070D,0xE6080C15,0xCC121B2A,0x2696B4EB,0xFF2F80FF,0xFF38E0F0,0xFFF4F7FF,0xFF8896AE,0xFF37D39A,0x2E2F80FF,0x0FFFFFFF,0x66000000,0x2E2F80FF,0xFFFFFFFF),
    LIGHT(0xB3E8EEF9,0xF2FFFFFF,0xE6EFF5FD,0x33425F8F,0xFF1F6FF0,0xFF0A94AB,0xFF0B1424,0xFF58657E,0xFF108A58,0x1F1F6FF0,0xB3FFFFFF,0x33263A52,0x1F1F6FF0,0xFFFFFFFF);
    public final int overlay, panel, surface, border, accent, cyan, text, muted, good, glow, highlight, shadow, accentSoft, onAccent;
    CirrusTheme(int overlay,int panel,int surface,int border,int accent,int cyan,int text,int muted,int good,int glow,int highlight,int shadow,int accentSoft,int onAccent){this.overlay=overlay;this.panel=panel;this.surface=surface;this.border=border;this.accent=accent;this.cyan=cyan;this.text=text;this.muted=muted;this.good=good;this.glow=glow;this.highlight=highlight;this.shadow=shadow;this.accentSoft=accentSoft;this.onAccent=onAccent;}
    public static CirrusTheme current(CirrusConfig config){return "LIGHT".equals(config.getString("theme","DARK"))?LIGHT:DARK;}
    public static void set(CirrusConfig config,CirrusTheme theme){config.put("theme",theme.name());}
}
