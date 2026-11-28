package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.input.GameAction;
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

/** Your own clicks per second, left and optionally right, as plain text. It only counts the keys you press. */
public final class CpsMod extends HudMod {
    private static final List<Setting> OWN;
    static {
        List<Setting> l = new ArrayList<Setting>(TEXT);
        l.add(Setting.toggle("right", "Show right click", "Show the right button too, for example 8 | 3.", false).group("Text"));
        OWN = Collections.unmodifiableList(l);
    }

    private final FormatTemplate.Cache text = new FormatTemplate.Cache();
    private final ClickCounter left = new ClickCounter(), right = new ClickCounter();

    public String id() { return "cps"; }
    public String name() { return "CPS"; }
    public String description() { return "Shows how many times per second you click."; }
    public ModCategory category() { return ModCategory.HUD; }
    @Override public int icon() { return Icons.CURSOR; }
    @Override protected List<Setting> featureSettings() { return OWN; }
    @Override protected List<Setting> appearance() { return SIMPLE; }
    @Override protected int baseWidth(ModContext m) {
        String widest = on(m.config(), "right") ? "00 | 00" : "00";
        return m.text().width(FormatTemplate.apply(FormatTemplate.template(opt(m.config(), "format"), "CPS", ""), widest), TextStyle.BODY) + 10;
    }
    @Override protected int baseHeight(ModContext m) { return 16; }
    /** New players start with a clean HUD; these are switched on from the Click GUI or the widgets editor. */
    @Override public boolean defaultEnabled() { return false; }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return 28; }

    /** The text for the current counts; separated so tests can check it without drawing. */
    String value(ModContext m, long now) {
        boolean both = on(m.config(), "right");
        if (m.inWorld()) {
            left.sample(m.isActionDown(GameAction.ATTACK), now);
            right.sample(m.isActionDown(GameAction.USE), now);
        } else { left.reset(); right.reset(); }
        int l = left.count(now), r = right.count(now);
        return both ? l + " | " + r : Integer.toString(l);
    }

    @Override protected void draw(Canvas canvas, int x, int y, float tick, ModContext m) {
        CirrusConfig c = m.config();
        surface(canvas, x, y, baseWidth(m), 16, 6, c, CirrusTheme.current(c));
        canvas.text(text.get(opt(c, "format"), "CPS", "", value(m, System.currentTimeMillis())), TextStyle.BODY, x + 5, y + 3, textColor(c), shadowOn(c));
    }
}
