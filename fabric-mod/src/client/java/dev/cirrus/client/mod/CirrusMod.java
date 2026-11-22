package dev.cirrus.client.mod;

import dev.cirrus.core.module.ModStatus;
import dev.cirrus.core.module.ModCategory;
import dev.cirrus.core.settings.Setting;
import dev.cirrus.core.config.CirrusConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

/** A self-contained feature contribution. Render and lifecycle hooks are optional. */
public interface CirrusMod {
    String id(); String name(); String description(); ModCategory category();
    /** Index into the Cirrus glyph sheet (ui/Glyphs). Defaults to the category's glyph; modules override it with their own. */
    default int icon() { return category().glyph; }
    /** AVAILABLE modules work in game; PLANNED ones are catalogue entries that can never be switched on. */
    default ModStatus status() { return ModStatus.AVAILABLE; }
    default boolean available() { return status() == ModStatus.AVAILABLE; }
    /** Optional one-line note shown with the module, for example who provides a platform feature. */
    default String note() { return ""; }
    default boolean defaultEnabled() { return false; }
    default boolean favorite(CirrusConfig config) { return config.getBoolean("favorite." + id(), false); }
    default boolean enabled(CirrusConfig config) { return available() && config.getBoolean("enabled." + id(), defaultEnabled()); }
    default void setEnabled(CirrusConfig config, boolean enabled) {
        if (!available()) return;
        boolean wasEnabled = enabled(config);
        if (wasEnabled == enabled) return;
        config.put("enabled." + id(), Boolean.toString(enabled));
        if (enabled) onEnable(Minecraft.getInstance()); else onDisable(Minecraft.getInstance());
    }
    default void setFavorite(CirrusConfig config, boolean favorite) { config.put("favorite." + id(), Boolean.toString(favorite)); }
    default void onEnable(Minecraft client) {}
    default void onDisable(Minecraft client) {}
    default void render(GuiGraphics graphics, float tickDelta, CirrusConfig config) {}
    /** The options this feature exposes; each feature has its own list and its own settings page. */
    default java.util.List<Setting> settings() { return java.util.List.of(); }
    default boolean hasSettings() { return !settings().isEmpty(); }
    default void openSettings(net.minecraft.client.gui.screens.Screen parent) {}
}
