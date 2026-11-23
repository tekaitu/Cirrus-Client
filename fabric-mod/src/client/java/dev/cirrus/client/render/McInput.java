package dev.cirrus.client.render;

import com.mojang.blaze3d.platform.InputConstants;
import dev.cirrus.core.input.InputState;
import dev.cirrus.core.input.InputTracker;
import dev.cirrus.core.input.Keys;
import dev.cirrus.core.input.MouseButtons;
import net.minecraft.client.Minecraft;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;

/**
 * {@link InputState} for Minecraft 1.21.11. Everything that can be asked of the game directly is polled live, so held keys,
 * buttons, pointer position and modifiers can never drift or get stuck: {@code MouseHandler.isLeftPressed/isMiddlePressed/
 * isRightPressed}, {@code MouseHandler.getScaledXPos/getScaledYPos(Window)} and {@code InputConstants.isKeyDown(Window, int)}
 * (all confirmed against the 1.21.11 jar in CI). What the game only reports as events (scroll, per-frame movement, press and
 * release notifications for {@link dev.cirrus.core.input.InputListener}s) is fed in by {@code CirrusScreen} through the
 * {@code mouse*}/{@code key*} methods below, using the 1.21.11 {@link KeyEvent} and {@link MouseButtonEvent} records.
 *
 * <p>GLFW key and modifier numbering is what both {@link Keys} and Minecraft 1.21.11 use, so codes pass through unchanged.
 */
public final class McInput implements InputState {
    public static final McInput INSTANCE = new McInput();
    private final InputTracker events = new InputTracker();

    private McInput() { }

    /** Listener registration and event-only data (movement, scroll) live on the tracker. */
    public InputTracker events() { return events; }

    // ---- event feed (called from CirrusScreen) ----------------------------------------------------------------------------

    public void mouseMoved(double x, double y) { events.mouseMoved(x, y); }

    public void mousePressed(MouseButtonEvent e) { events.mousePressed(e.button(), e.x(), e.y(), e.modifiers()); }

    public void mouseReleased(MouseButtonEvent e) { events.mouseReleased(e.button(), e.x(), e.y(), e.modifiers()); }

    public void mouseScrolled(double x, double y, double sx, double sy) { events.mouseScrolled(x, y, sx, sy); }

    public void keyPressed(KeyEvent e) { events.keyPressed(e.key(), e.modifiers()); }

    public void keyReleased(KeyEvent e) { events.keyReleased(e.key(), e.modifiers()); }

    /** Call once per rendered frame after the frame's logic has run. */
    public void endFrame() { events.endFrame(); }

    /** Forget event-fed state, for example when a Cirrus screen opens or closes. */
    public void reset() { events.reset(); }

    // ---- InputState (live) ------------------------------------------------------------------------------------------------

    @Override public double mouseX() { Minecraft mc = Minecraft.getInstance(); return mc.mouseHandler.getScaledXPos(mc.getWindow()); }

    @Override public double mouseY() { Minecraft mc = Minecraft.getInstance(); return mc.mouseHandler.getScaledYPos(mc.getWindow()); }

    @Override public boolean isMouseDown(int button) {
        var mouse = Minecraft.getInstance().mouseHandler;
        switch (button) {
            case MouseButtons.LEFT: return mouse.isLeftPressed();
            case MouseButtons.RIGHT: return mouse.isRightPressed();
            case MouseButtons.MIDDLE: return mouse.isMiddlePressed();
            default: return false;
        }
    }

    @Override public boolean isKeyDown(int key) {
        return key > 0 && InputConstants.isKeyDown(Minecraft.getInstance().getWindow(), key);
    }

    @Override public int modifiers() {
        int m = 0;
        if (isKeyDown(Keys.LEFT_SHIFT) || isKeyDown(Keys.RIGHT_SHIFT)) m |= Keys.MOD_SHIFT;
        if (isKeyDown(Keys.LEFT_CONTROL) || isKeyDown(Keys.RIGHT_CONTROL)) m |= Keys.MOD_CONTROL;
        if (isKeyDown(Keys.LEFT_ALT) || isKeyDown(Keys.RIGHT_ALT)) m |= Keys.MOD_ALT;
        return m;
    }

    @Override public double mouseDeltaX() { return events.mouseDeltaX(); }
    @Override public double mouseDeltaY() { return events.mouseDeltaY(); }
    @Override public double scrollX() { return events.scrollX(); }
    @Override public double scrollY() { return events.scrollY(); }
}
