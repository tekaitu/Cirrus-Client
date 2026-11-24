package dev.cirrus.core.input;

import java.util.ArrayList;
import java.util.List;

/**
 * Turns the events a version adapter reports into queryable state: held keys and buttons, pointer position and movement, scroll,
 * modifiers. It is the one implementation of {@link InputState}; adapters only translate their game's events into calls on it.
 *
 * <p>Held-state is tracked from events, so a release that never arrives (focus lost, screen closed with a key down) would leave a
 * key stuck; adapters call {@link #reset()} when input focus changes. Not thread-safe: render/UI thread only. Event handling
 * allocates nothing.
 */
public final class InputTracker implements InputState {
    private static final int MAX_KEY = 512;
    private static final int MAX_BUTTON = 8;

    private final boolean[] keys = new boolean[MAX_KEY];
    private final boolean[] buttons = new boolean[MAX_BUTTON];
    private final List<InputListener> listeners = new ArrayList<InputListener>();
    private double x, y, dx, dy, scrollX, scrollY;
    private boolean positioned;
    private int modifiers;

    public void addListener(InputListener listener) { if (listener != null && !listeners.contains(listener)) listeners.add(listener); }

    public void removeListener(InputListener listener) { listeners.remove(listener); }

    // ---- events (called by the adapter) -----------------------------------------------------------------------------------

    public void keyPressed(int key, int modifiers) {
        this.modifiers = modifiers;
        if (key >= 0 && key < MAX_KEY) keys[key] = true;
        for (int i = 0; i < listeners.size(); i++) listeners.get(i).onKeyPressed(key, modifiers);
    }

    public void keyReleased(int key, int modifiers) {
        this.modifiers = modifiers;
        if (key >= 0 && key < MAX_KEY) keys[key] = false;
        for (int i = 0; i < listeners.size(); i++) listeners.get(i).onKeyReleased(key, modifiers);
    }

    public void mouseMoved(double nx, double ny) {
        double mdx = positioned ? nx - x : 0, mdy = positioned ? ny - y : 0;
        positioned = true;
        x = nx; y = ny;
        dx += mdx; dy += mdy;
        if (mdx == 0 && mdy == 0) return;
        for (int i = 0; i < listeners.size(); i++) listeners.get(i).onMouseMoved(nx, ny, mdx, mdy);
    }

    public void mousePressed(int button, double mx, double my, int modifiers) {
        mouseMoved(mx, my);
        this.modifiers = modifiers;
        if (button >= 0 && button < MAX_BUTTON) buttons[button] = true;
        for (int i = 0; i < listeners.size(); i++) listeners.get(i).onMousePressed(button, mx, my, modifiers);
    }

    public void mouseReleased(int button, double mx, double my, int modifiers) {
        mouseMoved(mx, my);
        this.modifiers = modifiers;
        if (button >= 0 && button < MAX_BUTTON) buttons[button] = false;
        for (int i = 0; i < listeners.size(); i++) listeners.get(i).onMouseReleased(button, mx, my, modifiers);
    }

    public void mouseScrolled(double mx, double my, double sx, double sy) {
        mouseMoved(mx, my);
        scrollX += sx; scrollY += sy;
        for (int i = 0; i < listeners.size(); i++) listeners.get(i).onMouseScrolled(mx, my, sx, sy);
    }

    /** Clears per-frame accumulators (movement, scroll). Call once per frame after the frame's logic has read them. */
    public void endFrame() { dx = dy = scrollX = scrollY = 0; }

    /** Forgets every held key and button, for example when the window loses focus or a screen closes. */
    public void reset() {
        for (int i = 0; i < MAX_KEY; i++) keys[i] = false;
        for (int i = 0; i < MAX_BUTTON; i++) buttons[i] = false;
        modifiers = 0;
        dx = dy = scrollX = scrollY = 0;
    }

    // ---- InputState -------------------------------------------------------------------------------------------------------

    @Override public double mouseX() { return x; }
    @Override public double mouseY() { return y; }
    @Override public boolean isMouseDown(int button) { return button >= 0 && button < MAX_BUTTON && buttons[button]; }
    @Override public boolean isKeyDown(int key) { return key >= 0 && key < MAX_KEY && keys[key]; }
    @Override public int modifiers() { return modifiers; }
    @Override public double mouseDeltaX() { return dx; }
    @Override public double mouseDeltaY() { return dy; }
    @Override public double scrollX() { return scrollX; }
    @Override public double scrollY() { return scrollY; }
}
