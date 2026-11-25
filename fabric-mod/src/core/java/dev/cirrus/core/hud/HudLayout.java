package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;

import java.util.ArrayList;
import java.util.Locale;
import java.util.List;

/**
 * The HUD editing model: which widgets are on the HUD, which have been removed and can be restored, and where they are.
 * It only talks to {@link HudElement} and the config, so editing the HUD never involves gameplay code. Removing a widget keeps
 * its saved position; a widget that is also a gameplay module (see {@link HudMod}) follows that module's switch.
 */
public final class HudLayout {
    private HudLayout() { }

    public static boolean isActive(HudElement e, CirrusConfig c) { return e.enabled(c); }

    /** Takes a widget off the HUD. Its position and appearance settings are kept. */
    public static void remove(HudElement e, CirrusConfig c) { e.setEnabled(c, false); }

    /** Puts a removed widget back on the HUD, at the position it had. */
    public static void restore(HudElement e, CirrusConfig c) { e.setEnabled(c, true); }

    /** Widgets currently on the HUD, in registration (draw) order. */
    public static List<HudElement> active(List<HudElement> all, CirrusConfig c) {
        List<HudElement> out = new ArrayList<HudElement>();
        for (int i = 0; i < all.size(); i++) if (all.get(i).enabled(c)) out.add(all.get(i));
        return out;
    }

    /** Widgets that can be restored from the widget list. */
    public static List<HudElement> removed(List<HudElement> all, CirrusConfig c) {
        List<HudElement> out = new ArrayList<HudElement>();
        for (int i = 0; i < all.size(); i++) if (!all.get(i).enabled(c)) out.add(all.get(i));
        return out;
    }

    /** The topmost active widget under the pointer (later widgets draw on top), allowing {@code pad} units around its box; null if none. */
    public static HudElement hit(List<HudElement> all, CirrusConfig c, int screenWidth, int screenHeight, double mx, double my, int pad) {
        for (int i = all.size() - 1; i >= 0; i--) {
            HudElement e = all.get(i);
            if (!e.enabled(c)) continue;
            int x = e.x(c, screenWidth), y = e.y(c, screenHeight);
            if (mx >= x - pad && mx <= x + e.width() + pad && my >= y - pad && my <= y + e.height() + pad) return e;
        }
        return null;
    }

    /** Moves a widget back to its default place. */
    public static void resetPosition(HudElement e, CirrusConfig c, int screenWidth, int screenHeight) {
        c.put("hud.anchor." + e.id(), "TOP_LEFT");
        e.setPosition(c, e.defaultX(), e.defaultY(screenHeight), screenWidth, screenHeight);
    }

    /** Moves a widget by a whole number of GUI units, clamped to the screen; used by the arrow keys in the editor. */
    public static void nudge(HudElement e, CirrusConfig c, int dx, int dy, int screenWidth, int screenHeight) {
        e.setPosition(c, e.x(c, screenWidth) + dx, e.y(c, screenHeight) + dy, screenWidth, screenHeight);
    }

    /** The widgets whose name contains {@code query} (ignoring case and surrounding spaces); everything for an empty query. */
    public static List<HudElement> filter(List<HudElement> all, String query) {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        List<HudElement> out = new ArrayList<HudElement>();
        for (int i = 0; i < all.size(); i++) {
            HudElement e = all.get(i);
            if (q.isEmpty() || e.label().toLowerCase(Locale.ROOT).contains(q) || e.id().toLowerCase(Locale.ROOT).contains(q)) out.add(e);
        }
        return out;
    }
}
