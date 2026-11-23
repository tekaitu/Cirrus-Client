package dev.cirrus.core.input;

/**
 * A read-only view of the player's input right now, supplied by the version adapter. Core code asks this instead of calling a
 * windowing library, so the same logic runs on any Minecraft version. Positions are in GUI units (the same space Cirrus draws in).
 * Keys use {@link Keys}, buttons use {@link MouseButtons}, modifiers are {@link Keys#MOD_SHIFT} and friends OR-ed together.
 */
public interface InputState {
    double mouseX();

    double mouseY();

    /** Whether the given {@link MouseButtons} button is currently held. */
    boolean isMouseDown(int button);

    /** Whether the given {@link Keys} key is currently held. */
    boolean isKeyDown(int key);

    /** Currently held modifier keys as a bit mask of {@link Keys#MOD_SHIFT}, {@link Keys#MOD_CONTROL}, {@link Keys#MOD_ALT}. */
    int modifiers();

    /** Mouse movement since the last {@link InputTracker#endFrame()}. */
    double mouseDeltaX();

    double mouseDeltaY();

    /** Scroll accumulated since the last {@link InputTracker#endFrame()}; positive Y is away from the user (scroll up). */
    double scrollX();

    double scrollY();
}
