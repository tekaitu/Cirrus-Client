package dev.cirrus.client.mod;

import dev.cirrus.client.ui.Glyphs;

/** Sidebar categories of the Click GUI. Adding a value here (plus a glyph) makes a new category appear once a module uses it. */
public enum ModCategory {
    COMBAT("Combat", Glyphs.SWORD),
    MOVEMENT("Movement", Glyphs.MOVE),
    RENDER("Render", Glyphs.EYE),
    PLAYER("Player", Glyphs.SINGLEPLAYER),
    HUD("HUD", Glyphs.HUD),
    UTILITY("Utility", Glyphs.TOOLS),
    SOCIAL("Social", Glyphs.MULTIPLAYER);

    public final String label;
    /** Index into the Cirrus glyph sheet. */
    public final int glyph;
    ModCategory(String label, int glyph) { this.label = label; this.glyph = glyph; }
}
