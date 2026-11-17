package dev.cirrus.client.mod;
public enum ModCategory {
    ALL("All mods"), HUD("HUD"), PVP("PvP"), VISUALS("Visuals"), PERFORMANCE("Performance"), UTILITY("Utility"), INTERFACE("Interface");
    public final String label;
    ModCategory(String label) { this.label = label; }
}
