package dev.cirrus.core.input;

/**
 * A read-only view of the player's input at this moment, supplied by the version adapter. Core code asks this instead of calling
 * a windowing library, so the same logic can run on any Minecraft version. Event-driven input (key presses, clicks) still arrives
 * through each version's screen callbacks and is translated to {@link Keys} / {@link MouseButtons} codes by the adapter.
 */
public interface InputState {
    /** Whether the given {@link MouseButtons} button is currently held. */
    boolean isMouseDown(int button);
}
