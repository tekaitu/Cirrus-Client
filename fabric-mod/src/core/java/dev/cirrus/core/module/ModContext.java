package dev.cirrus.core.module;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.input.GameAction;
import dev.cirrus.core.input.InputState;
import dev.cirrus.core.text.TextMetrics;

/**
 * Everything module and HUD logic is allowed to ask of the running game. A version adapter implements it once; Core modules take
 * it instead of reaching for Minecraft classes, so the same module runs on any supported version. It is deliberately small: a
 * method is added only when a real module needs it.
 */
public interface ModContext {
    /** The player's Cirrus settings for this instance. */
    CirrusConfig config();

    /** Live keyboard and mouse state. */
    InputState input();

    /** Text measurement in the game's own font. */
    TextMetrics text();

    /** Size of the GUI in GUI units. */
    int screenWidth();

    int screenHeight();

    /** Frames per second as the game reports them. */
    int fps();

    /** Round-trip latency to the current server in milliseconds, or -1 when there is nothing to measure (no server, singleplayer). */
    int pingMillis();

    /** Whether a world is loaded and the player is in it. HUD previews in menus use sample values when this is false. */
    boolean inWorld();

    /** Whether the key currently bound to a game action is held (respects the player's own key bindings). */
    boolean isActionDown(GameAction action);
}
