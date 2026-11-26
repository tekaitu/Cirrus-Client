package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.render.Canvas;

/**
 * One widget on the HUD. Its position and state are stored in the player's config under {@code hud.*} keys, so they survive
 * restarts and travel with profiles. A widget has two independent states: <b>disabled</b> (switched off but still part of the
 * layout, configured and shown dimmed in the editor, so it can be enabled again in place) and <b>removed</b> (taken out of the
 * layout; it can be restored from the widget list). Either way it keeps its saved position and settings.
 */
public interface HudElement {
    String id();
    String label();
    int width();
    int height();

    /** Whether the widget is switched on ({@link HudLayout#enable} / {@link HudLayout#disable}). A widget that is also a module follows the module's switch. */
    default boolean enabled(CirrusConfig config) { return config.getBoolean("hud.enabled." + id(), true); }
    default void setEnabled(CirrusConfig config, boolean value) { config.put("hud.enabled." + id(), Boolean.toString(value)); }

    /** Whether the widget has been taken out of the layout ({@link HudLayout#remove} / {@link HudLayout#restore}). */
    default boolean removed(CirrusConfig config) { return config.getBoolean("hud.removed." + id(), false); }
    default void setRemoved(CirrusConfig config, boolean value) { config.put("hud.removed." + id(), Boolean.toString(value)); }
    /** Whether the widget is drawn on the HUD: switched on and not removed. */
    default boolean visible(CirrusConfig config) { return enabled(config) && !removed(config); }
    default int x(CirrusConfig config, int screenWidth) {
        if (config.getString("hud.anchor." + id(), "TOP_LEFT").equals("TOP_RIGHT")) return Math.max(0, screenWidth - width() - 8);
        return clamp(config.getInt("hud.x." + id(), defaultX()), 0, Math.max(0, screenWidth - width()));
    }

    default int y(CirrusConfig config, int screenHeight) {
        return clamp(config.getInt("hud.y." + id(), defaultY(screenHeight)), 0, Math.max(0, screenHeight - height()));
    }

    /** Stores an explicit position. A widget that was pinned to the right edge becomes free-positioned, so the move takes effect. */
    default void setPosition(CirrusConfig config, int x, int y, int screenWidth, int screenHeight) {
        if (!config.getString("hud.anchor." + id(), "TOP_LEFT").equals("TOP_LEFT")) config.put("hud.anchor." + id(), "TOP_LEFT");
        config.put("hud.x." + id(), Integer.toString(clamp(x, 0, Math.max(0, screenWidth - width()))));
        config.put("hud.y." + id(), Integer.toString(clamp(y, 0, Math.max(0, screenHeight - height()))));
    }

    /** Where the element sits until the player moves it. */
    default int defaultX() { return 8; }
    default int defaultY(int screenHeight) { return 8; }

    /** Draws the widget with its top-left corner at {@code (x, y)}. */
    void render(Canvas canvas, int x, int y, float tickDelta, ModContext context);

    static int clamp(int n, int min, int max) { return Math.max(min, Math.min(max, n)); }
}
