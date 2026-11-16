package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;

/** Palette tokens for all Cirrus screens. Values are packed ARGB. */
public enum CirrusTheme {
    DARK(0xF20A0D14,0xF2141923,0xFF0C1018,0xFF222A38,0xFF1E63E9,0xFF42C8F5,0xFFF2F5FF,0xFF9AA7BA,0xFF35D49A),
    LIGHT(0xF2EEF2F8,0xF2FFFFFF,0xFFF8FAFD,0xFFE0E6F0,0xFF2869D7,0xFF0788B8,0xFF152033,0xFF64748B,0xFF12845F);
    public final int overlay, panel, surface, border, accent, cyan, text, muted, good;
    CirrusTheme(int overlay,int panel,int surface,int border,int accent,int cyan,int text,int muted,int good){this.overlay=overlay;this.panel=panel;this.surface=surface;this.border=border;this.accent=accent;this.cyan=cyan;this.text=text;this.muted=muted;this.good=good;}
    public static CirrusTheme current(CirrusConfig config){return "LIGHT".equals(config.getString("theme","DARK"))?LIGHT:DARK;}
    public static void set(CirrusConfig config,CirrusTheme theme){config.put("theme",theme.name());}
}
