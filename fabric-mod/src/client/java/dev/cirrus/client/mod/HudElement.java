package dev.cirrus.client.mod;

import dev.cirrus.core.config.CirrusConfig;
import net.minecraft.client.gui.GuiGraphics;

/** A HUD contribution automatically exposed to the HUD editor when registered. */
public interface HudElement {
    String id();
    String label();
    int width();
    int height();
    default boolean enabled(CirrusConfig config) { return config.getBoolean("hud.enabled." + id(), true); }
    default void setEnabled(CirrusConfig config, boolean value) { config.put("hud.enabled." + id(), Boolean.toString(value)); }
    default int x(CirrusConfig config, int screenWidth) {
        if (config.getString("hud.anchor." + id(), "TOP_LEFT").equals("TOP_RIGHT")) return Math.max(0, screenWidth - width() - 8);
        return clamp(config.getInt("hud.x." + id(), defaultX()), 0, Math.max(0, screenWidth - width()));
    }
    default int y(CirrusConfig config, int screenHeight) { return clamp(config.getInt("hud.y." + id(), defaultY(screenHeight)), 0, Math.max(0, screenHeight - height())); }
    default void setPosition(CirrusConfig config, int x, int y, int screenWidth, int screenHeight) {
        config.put("hud.x." + id(), Integer.toString(clamp(x, 0, Math.max(0, screenWidth - width()))));
        config.put("hud.y." + id(), Integer.toString(clamp(y, 0, Math.max(0, screenHeight - height()))));
    }
    /** Where the element sits until the player moves it. */
    default int defaultX() { return 8; }
    default int defaultY(int screenHeight) { return 8; }
    void render(GuiGraphics graphics, int x, int y, float tickDelta, CirrusConfig config);
    private static int clamp(int n, int min, int max) { return Math.max(min, Math.min(max, n)); }
}
