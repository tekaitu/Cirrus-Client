package dev.cirrus.core.module;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.settings.Setting;

import java.util.Collections;
import java.util.List;

/**
 * A self-contained feature contribution: its identity, whether it is on, and its options. Nothing here depends on a Minecraft
 * version; anything that needs the game goes through {@link ModContext}. Lifecycle hooks are optional.
 */
public interface CirrusMod {
    String id();
    String name();
    String description();
    ModCategory category();

    /** Index into the Cirrus icon sheet (see {@code Icons}). Defaults to the category's icon; modules override it with their own. */
    default int icon() { return category().glyph; }

    /** AVAILABLE modules work in game; PLANNED ones are catalogue entries that can never be switched on. */
    default ModStatus status() { return ModStatus.AVAILABLE; }
    default boolean available() { return status() == ModStatus.AVAILABLE; }

    /** Optional one-line note shown with the module, for example who provides a platform feature. */
    default String note() { return ""; }
    default boolean defaultEnabled() { return false; }
    default boolean favorite(CirrusConfig config) { return config.getBoolean("favorite." + id(), false); }
    default boolean enabled(CirrusConfig config) { return available() && config.getBoolean("enabled." + id(), defaultEnabled()); }

    /** Switches the module and runs its lifecycle hook (when the registry has a bound {@link ModContext}). */
    default void setEnabled(CirrusConfig config, boolean enabled) {
        if (!available()) return;
        boolean wasEnabled = enabled(config);
        if (wasEnabled == enabled) return;
        config.put("enabled." + id(), Boolean.toString(enabled));
        if (!ModRegistry.isBound()) return;
        if (enabled) onEnable(ModRegistry.context()); else onDisable(ModRegistry.context());
    }

    default void setFavorite(CirrusConfig config, boolean favorite) { config.put("favorite." + id(), Boolean.toString(favorite)); }
    default void onEnable(ModContext context) { }
    default void onDisable(ModContext context) { }

    /** The options this feature exposes; each feature has its own list and its own settings page. */
    default List<Setting> settings() { return Collections.emptyList(); }
    default boolean hasSettings() { return !settings().isEmpty(); }
}
