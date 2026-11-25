package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;

import java.util.ArrayList;
import java.util.List;

/**
 * Drag-to-position for one widget. The editor starts a drag on press, calls {@link #update} while the pointer moves and
 * {@link #end} on release; every update is clamped to the screen and written to the config, so the position persists immediately.
 * Version independent: positions come from whatever pointer coordinates the adapter reports, in GUI units.
 */
public final class HudDrag {
    private HudElement target;
    private int grabX, grabY;
    private int guideX = SnapEngine.NONE, guideY = SnapEngine.NONE;

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
        return update(c, screenWidth, screenHeight, mx, my, null, 0);
    }

    /**
     * Like {@link #update(CirrusConfig, int, int, double, double)}, but snaps to the screen's edges and centre and to the other
     * widgets in {@code all} when within {@code threshold} units (zero or less turns snapping off). {@link #guideX()} and
     * {@link #guideY()} then report the line snapped to, for the editor to draw.
     */
    public boolean update(CirrusConfig c, int screenWidth, int screenHeight, double mx, double my, List<HudElement> all, int threshold) {
        if (target == null) return false;
        int x = HudElement.clamp((int) mx - grabX, 0, Math.max(0, screenWidth - target.width()));
        int y = HudElement.clamp((int) my - grabY, 0, Math.max(0, screenHeight - target.height()));
        List<int[]> others = null;
        if (threshold > 0 && all != null) {
            others = new ArrayList<int[]>();
            for (int i = 0; i < all.size(); i++) {
                HudElement e = all.get(i);
                if (e == target || !e.enabled(c)) continue;
                others.add(new int[] {e.x(c, screenWidth), e.y(c, screenHeight), e.width(), e.height()});
            }
        }
        SnapEngine.Result r = SnapEngine.snap(x, y, target.width(), target.height(), screenWidth, screenHeight, others, threshold);
        guideX = r.guideX;
        guideY = r.guideY;
        target.setPosition(c, r.x, r.y, screenWidth, screenHeight);
        return true;
    }

    /** The vertical guide line (an x coordinate) the drag is snapped to, or {@link SnapEngine#NONE}. */
    public int guideX() { return guideX; }

    /** The horizontal guide line (a y coordinate) the drag is snapped to, or {@link SnapEngine#NONE}. */
    public int guideY() { return guideY; }

    public void end() { target = null; guideX = SnapEngine.NONE; guideY = SnapEngine.NONE; }
}
