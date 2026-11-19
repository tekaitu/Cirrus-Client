package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

/** A self-contained feature contribution. Render and lifecycle hooks are optional. */
public interface CirrusMod {
    String id(); String name(); String description(); ModCategory category();
    /** Index into the Cirrus icon sheet (see CirrusUi.ICON_*). */
    default int icon() {
        return switch (category()) { case ALL -> dev.cirrus.client.ui.CirrusUi.ICON_LIBRARY; case HUD -> dev.cirrus.client.ui.CirrusUi.ICON_HUD; case PVP -> dev.cirrus.client.ui.CirrusUi.ICON_PVP; case VISUALS -> dev.cirrus.client.ui.CirrusUi.ICON_VISUALS; case PERFORMANCE -> dev.cirrus.client.ui.CirrusUi.ICON_PERFORMANCE; case UTILITY -> dev.cirrus.client.ui.CirrusUi.ICON_UTILITY; case INTERFACE -> dev.cirrus.client.ui.CirrusUi.ICON_SETTINGS; };
    }
    default boolean defaultEnabled() { return false; }
    default boolean favorite(CirrusConfig config) { return config.getBoolean("favorite." + id(), false); }
    default boolean enabled(CirrusConfig config) { return config.getBoolean("enabled." + id(), defaultEnabled()); }
    default void setEnabled(CirrusConfig config, boolean enabled) {
        boolean wasEnabled = enabled(config);
        if (wasEnabled == enabled) return;
        config.put("enabled." + id(), Boolean.toString(enabled));
        if (enabled) onEnable(Minecraft.getInstance()); else onDisable(Minecraft.getInstance());
    }
    default void setFavorite(CirrusConfig config, boolean favorite) { config.put("favorite." + id(), Boolean.toString(favorite)); }
    default void onEnable(Minecraft client) {}
    default void onDisable(Minecraft client) {}
    default void render(GuiGraphics graphics, float tickDelta, CirrusConfig config) {}
    default boolean hasSettings() { return false; }
    default void openSettings(net.minecraft.client.gui.screens.Screen parent) {}
}
