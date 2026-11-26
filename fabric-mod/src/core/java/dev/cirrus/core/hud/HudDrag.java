package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;

/**
 * Drag-to-position for one widget. The editor starts a drag on press, calls {@link #update} while the pointer moves and
 * {@link #end} on release; every update is clamped to the screen and written to the config, so the position persists immediately.
 * Version independent: positions come from whatever pointer coordinates the adapter reports, in GUI units.
 */
public final class HudDrag {
    private HudElement target;
    private int grabX, grabY;

    public boolean active() { return target != null; }

    public HudElement target() { return target; }

    /** Starts dragging an element the pointer pressed on, keeping the offset between the pointer and the element's corner. */
    public void begin(HudElement e, CirrusConfig c, int screenWidth, int screenHeight, double mx, double my) {
        target = e;
        grabX = (int) mx - e.x(c, screenWidth);
        grabY = (int) my - e.y(c, screenHeight);
    }

    /** Starts dragging by the element's centre, for placing an element by clicking an empty spot. */
    public void beginCentered(HudElement e) {
        target = e;
        grabX = e.width() / 2;
        grabY = e.height() / 2;
    }

    /** Moves the dragged element under the pointer. Returns false when nothing is being dragged. */
    public boolean update(CirrusConfig c, int screenWidth, int screenHeight, double mx, double my) {
        if (target == null) return false;
        target.setPosition(c, (int) mx - grabX, (int) my - grabY, screenWidth, screenHeight);
        return true;
    }

    public void end() { target = null; }
}
