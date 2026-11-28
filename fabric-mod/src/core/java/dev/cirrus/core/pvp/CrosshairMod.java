package dev.cirrus.core.pvp;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.hud.HudColors;
import dev.cirrus.core.module.CirrusMod;
import dev.cirrus.core.module.ModCategory;
import dev.cirrus.core.render.Canvas;
import dev.cirrus.core.render.Colors;
import dev.cirrus.core.render.Icons;
import dev.cirrus.core.render.Shapes;
import dev.cirrus.core.settings.ModSettings;
import dev.cirrus.core.settings.Setting;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** Replaces the vanilla crosshair with one you style: shape, colour, size, thickness, centre gap, outline and opacity. */
public final class CrosshairMod implements CirrusMod {
    public static final String CROSS = "Cross", DOT = "Dot", CIRCLE = "Circle", CROSS_DOT = "Cross and dot";
    private static final List<Setting> SETTINGS = Collections.unmodifiableList(Arrays.asList(
        Setting.choice("style", "Shape", "The shape of the crosshair.", CROSS, CROSS, DOT, CIRCLE, CROSS_DOT).group("Style"),
        HudColors.setting().group("Style"),
        Setting.slider("size", "Size", "Length of each arm, or the radius of the circle.", 5, 1, 20, 1, "").group("Style"),
        Setting.slider("thickness", "Thickness", "Width of the lines.", 1, 1, 5, 1, "").group("Style"),
        Setting.slider("gap", "Centre gap", "Empty space in the middle of a cross.", 2, 0, 10, 1, "").group("Style"),
        Setting.slider("opacity", "Opacity", "How solid the crosshair is.", 100, 20, 100, 5, "%").group("Style"),
        Setting.toggle("outline", "Outline", "Thin dark outline so it stays visible on bright backgrounds.", true).group("Style")));

    public String id() { return "crosshair"; }
    public String name() { return "Custom Crosshair"; }
    public String description() { return "Style, colour and size of the crosshair."; }
    public ModCategory category() { return ModCategory.HUD; }
    @Override public int icon() { return Icons.CROSSHAIR; }
    @Override public List<Setting> settings() { return SETTINGS; }

    private static String opt(CirrusConfig c, String k) { return ModSettings.get(c, "crosshair", SETTINGS, k); }
    private static int num(CirrusConfig c, String k) { return ModSettings.number(c, "crosshair", SETTINGS, k); }

    /** Draws the crosshair centred on (cx, cy) in GUI units. */
    public static void draw(Canvas g, int cx, int cy, CirrusConfig c) {
        String style = opt(c, "style");
        int size = num(c, "size"), t = num(c, "thickness"), gap = num(c, "gap");
        int color = Colors.withAlpha(HudColors.argb(opt(c, "color")), Math.round(255 * num(c, "opacity") / 100f));
        boolean outline = "true".equals(opt(c, "outline"));
        int half = t / 2;
        int left = cx - half, top = cy - half;
        if (CIRCLE.equals(style)) {
            float r = size + 1f;
            if (outline) Shapes.strokeRound(g, cx - r - 1, cy - r - 1, 2 * r + 2, 2 * r + 2, r + 1, t + 2, Colors.withAlpha(0xFF000000, Colors.alpha(color) / 2));
            Shapes.strokeRound(g, cx - r, cy - r, 2 * r, 2 * r, r, t, color);
            return;
        }
        if (DOT.equals(style) || CROSS_DOT.equals(style)) rect(g, left, top, t, t, color, outline);
        if (CROSS.equals(style) || CROSS_DOT.equals(style)) {
            rect(g, left, top - gap - size, t, size, color, outline);
            rect(g, left, top + t + gap, t, size, color, outline);
            rect(g, left - gap - size, top, size, t, color, outline);
            rect(g, left + t + gap, top, size, t, color, outline);
        }
    }

    private static void rect(Canvas g, int x, int y, int w, int h, int color, boolean outline) {
        if (outline) g.fill(x - 1, y - 1, x + w + 1, y + h + 1, Colors.withAlpha(0xFF000000, Colors.alpha(color) / 2));
        g.fill(x, y, x + w, y + h, color);
    }
}
