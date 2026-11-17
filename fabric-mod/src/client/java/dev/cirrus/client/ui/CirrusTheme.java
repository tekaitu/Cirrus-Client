package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;

/** Palette tokens for all Cirrus screens. Values are packed ARGB. */
public enum CirrusTheme {
    DARK(0x9A070C14,0xC8141E2C,0x9C1D2B40,0x42FFFFFF,0xFF286FE8,0xFF42C8F5,0xFFF4F7FF,0xFFA4B0C2,0xFF35D49A,0x381B8FFF,0x16FFFFFF,0x88000000),
    LIGHT(0x99D6E2F2,0xDDF8FAFF,0xBEEBF2FB,0x80FFFFFF,0xFF2869D7,0xFF0788B8,0xFF152033,0xFF64748B,0xFF12845F,0x263B6EBF,0xA8FFFFFF,0x3A263A52);
    public final int overlay, panel, surface, border, accent, cyan, text, muted, good, glow, highlight, shadow;
    CirrusTheme(int overlay,int panel,int surface,int border,int accent,int cyan,int text,int muted,int good,int glow,int highlight,int shadow){this.overlay=overlay;this.panel=panel;this.surface=surface;this.border=border;this.accent=accent;this.cyan=cyan;this.text=text;this.muted=muted;this.good=good;this.glow=glow;this.highlight=highlight;this.shadow=shadow;}
    public static CirrusTheme current(CirrusConfig config){return "LIGHT".equals(config.getString("theme","DARK"))?LIGHT:DARK;}
    public static void set(CirrusConfig config,CirrusTheme theme){config.put("theme",theme.name());}
}
