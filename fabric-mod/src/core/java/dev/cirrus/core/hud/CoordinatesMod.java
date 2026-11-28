package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.module.ModCategory;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.render.Canvas;
import dev.cirrus.core.render.Icons;
import dev.cirrus.core.settings.Setting;
import dev.cirrus.core.text.TextStyle;
import dev.cirrus.core.theme.CirrusTheme;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Your position and the direction you face. Shown as one line or as stacked X, Y and Z lines. */
public final class CoordinatesMod extends HudMod {
    private static final List<Setting> OWN;
    static {
        List<Setting> l = new ArrayList<Setting>();
        l.add(Setting.choice("layout", "Layout", "One line, or one line per axis.", "One line", "One line", "Stacked").group("Text"));
        l.add(Setting.toggle("direction", "Facing", "Show the compass direction you are facing.", true).group("Text"));
        l.add(Setting.toggle("decimals", "Decimals", "Show one decimal place instead of whole numbers.", false).group("Text"));
        l.add(HudColors.setting());
        OWN = Collections.unmodifiableList(l);
    }

    public String id() { return "coordinates"; }
    public String name() { return "Coordinates"; }
    public String description() { return "Shows your position and the direction you are facing."; }
    public ModCategory category() { return ModCategory.HUD; }
    @Override public int icon() { return Icons.PIN; }
    @Override protected List<Setting> featureSettings() { return OWN; }
    @Override protected List<Setting> appearance() { return SIMPLE; }
    /** New players start with a clean HUD; these are switched on from the Click GUI or the widgets editor. */
    @Override public boolean defaultEnabled() { return false; }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return 48; }

    /** The lines to show: sample numbers in menus (no world), the real position in game. */
    List<String> lines(ModContext m) {
        CirrusConfig c = m.config();
        boolean live = m.inWorld();
        double x = live ? m.playerX() : 128.4, y = live ? m.playerY() : 64, z = live ? m.playerZ() : -32.7;
        float yaw = live ? m.playerYaw() : 180f;
        boolean dec = on(c, "decimals"), dir = on(c, "direction");
        String face = dir ? " " + Facing.of(yaw) : "";
        List<String> out = new ArrayList<String>(3);
        if ("Stacked".equals(opt(c, "layout"))) {
            out.add("X: " + num(x, dec));
            out.add("Y: " + num(y, dec));
            out.add("Z: " + num(z, dec) + face);
        } else out.add(num(x, dec) + ", " + num(y, dec) + ", " + num(z, dec) + face);
        return out;
    }

    static String num(double v, boolean decimals) {
        if (!decimals) return Long.toString((long) Math.floor(v));
        double r = Math.floor(v * 10) / 10;
        return String.format(java.util.Locale.ROOT, "%.1f", r);
    }

    @Override protected int baseWidth(ModContext m) {
        int w = 0;
        for (String s : lines(m)) w = Math.max(w, m.text().width(s, TextStyle.BODY));
        return w + 10;
    }
    @Override protected int baseHeight(ModContext m) { return lines(m).size() * 11 + 5; }

    @Override protected void draw(Canvas canvas, int x, int y, float tick, ModContext m) {
        CirrusConfig c = m.config();
        surface(canvas, x, y, baseWidth(m), baseHeight(m), 6, c, CirrusTheme.current(c));
        int line = y + 3;
        for (String s : lines(m)) { canvas.text(s, TextStyle.BODY, x + 5, line, textColor(c), shadowOn(c)); line += 11; }
    }
}
