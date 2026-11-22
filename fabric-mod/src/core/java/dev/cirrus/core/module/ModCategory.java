package dev.cirrus.core.module;


import dev.cirrus.core.render.Icons;

/** Sidebar categories of the Click GUI. Adding a value here (plus a glyph) makes a new category appear once a module uses it. */
public enum ModCategory {
    COMBAT("Combat", Icons.SWORD),
    MOVEMENT("Movement", Icons.MOVE),
    RENDER("Render", Icons.EYE),
    PLAYER("Player", Icons.SINGLEPLAYER),
    HUD("HUD", Icons.HUD),
    UTILITY("Utility", Icons.TOOLS),
    SOCIAL("Social", Icons.MULTIPLAYER);

    public final String label;
    /** Index into the Cirrus glyph sheet. */
    public final int glyph;
    ModCategory(String label, int glyph) { this.label = label; this.glyph = glyph; }
}
