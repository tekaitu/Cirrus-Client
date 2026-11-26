package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;

import java.util.ArrayList;
import java.util.Locale;
import java.util.List;

/**
 * The HUD editing model: which widgets are in the layout, which are switched off, which have been removed and can be restored,
 * and where they are. It only talks to {@link HudElement} and the config, so editing the HUD never involves gameplay code.
 * <ul>
 * <li><b>Disable</b> switches a widget off but leaves it in the layout, still configured and shown dimmed in the editor.</li>
 * <li><b>Remove</b> takes it out of the layout; it can be restored from the widget list.</li>
 * </ul>
 * Both keep the saved position and settings. A widget that is also a gameplay module (see {@link HudMod}) follows that module's
 * switch for enabled/disabled.
 */
public final class HudLayout {
    private HudLayout() { }

    /** Drawn on the HUD: switched on and not removed. */
    public static boolean isActive(HudElement e, CirrusConfig c) { return e.visible(c); }
    /** Part of the layout (shown in the editor, possibly dimmed): not removed. */
    public static boolean isPresent(HudElement e, CirrusConfig c) { return !e.removed(c); }
    /** In the layout but switched off. */
    public static boolean isDisabled(HudElement e, CirrusConfig c) { return !e.removed(c) && !e.enabled(c); }
    public static boolean isRemoved(HudElement e, CirrusConfig c) { return e.removed(c); }

    /** Switches a widget off; it stays in the layout, configured, and can be enabled again where it is. */
    public static void disable(HudElement e, CirrusConfig c) { e.setEnabled(c, false); }
    public static void enable(HudElement e, CirrusConfig c) { e.setEnabled(c, true); }
    /** Takes a widget out of the layout. Its position and settings are kept. */
    public static void remove(HudElement e, CirrusConfig c) { e.setRemoved(c, true); }
    /** Puts a removed widget back in the layout, switched on, at the position it had. */
    public static void restore(HudElement e, CirrusConfig c) { e.setRemoved(c, false); e.setEnabled(c, true); }

    /** Widgets drawn on the HUD, in registration (draw) order. */
    public static List<HudElement> active(List<HudElement> all, CirrusConfig c) {
        List<HudElement> out = new ArrayList<HudElement>();
        for (int i = 0; i < all.size(); i++) if (all.get(i).visible(c)) out.add(all.get(i));
        return out;
    }
    /** Widgets in the layout (what the editor shows, including disabled ones), in draw order. */
    public static List<HudElement> present(List<HudElement> all, CirrusConfig c) {
        List<HudElement> out = new ArrayList<HudElement>();
        for (int i = 0; i < all.size(); i++) if (!all.get(i).removed(c)) out.add(all.get(i));
        return out;
    }
    /** Widgets that can be restored from the widget list. */
    public static List<HudElement> removed(List<HudElement> all, CirrusConfig c) {
        List<HudElement> out = new ArrayList<HudElement>();
        for (int i = 0; i < all.size(); i++) if (all.get(i).removed(c)) out.add(all.get(i));
        return out;
    }
    /** The topmost widget in the layout under the pointer (later widgets draw on top), allowing {@code pad} units around its box; null if none. */
    public static HudElement hit(List<HudElement> all, CirrusConfig c, int screenWidth, int screenHeight, double mx, double my, int pad) {
        for (int i = all.size() - 1; i >= 0; i--) {
            HudElement e = all.get(i);
            if (e.removed(c)) continue;
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
