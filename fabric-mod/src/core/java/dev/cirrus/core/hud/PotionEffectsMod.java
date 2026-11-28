package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.module.EffectInfo;
import dev.cirrus.core.module.ModCategory;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.render.Canvas;
import dev.cirrus.core.render.Icons;
import dev.cirrus.core.settings.Setting;
import dev.cirrus.core.text.TextStyle;
import dev.cirrus.core.theme.CirrusTheme;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Active potion effects with the time left (this is the one feature behind both "Potion Effects" and "Potion Timer"). Detailed
 * shows name, level and time; Compact shows only a short name and the time.
 */
public final class PotionEffectsMod extends HudMod {
    private static final int MAX_ROWS = 8;
    private static final List<Setting> OWN = Collections.unmodifiableList(Arrays.asList(
        Setting.choice("style", "Style", "Detailed shows name, level and time; Compact is shorter.", "Detailed", "Detailed", "Compact").group("Text"),
        Setting.toggle("warn", "Warn when running out", "Colour an effect when under 10 seconds are left.", true).group("Text"),
        HudColors.setting()));
    private static final List<EffectInfo> SAMPLE = Collections.unmodifiableList(Arrays.asList(
        new EffectInfo("Speed", 1, 20 * 83, true), new EffectInfo("Strength", 0, 20 * 7, true), new EffectInfo("Poison", 0, 20 * 25, false)));
    private static final int WARN = 0xFFFFB347, BAD = 0xFFFF6B6B;

    public String id() { return "potion_effects"; }
    public String name() { return "Potion Effects"; }
    public String description() { return "Shows your active potion effects with the time left."; }
    public ModCategory category() { return ModCategory.HUD; }
    @Override public int icon() { return Icons.FLASK; }
    @Override protected List<Setting> featureSettings() { return OWN; }
    @Override protected List<Setting> appearance() { return SIMPLE; }
    /** New players start with a clean HUD; these are switched on from the Click GUI or the widgets editor. */
    @Override public boolean defaultEnabled() { return false; }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return 72; }

    List<EffectInfo> shown(ModContext m) {
        List<EffectInfo> src = m.inWorld() ? m.effects() : SAMPLE;
        if (src.size() <= MAX_ROWS) return src;
        return new ArrayList<EffectInfo>(src.subList(0, MAX_ROWS));
    }

    String row(EffectInfo e, boolean compact) {
        String time = EffectTime.format(e.ticksLeft());
        return compact ? e.name() + " " + time : e.name() + " " + EffectTime.level(e.amplifier()) + "  " + time;
    }

    @Override protected int baseWidth(ModContext m) {
        boolean compact = "Compact".equals(opt(m.config(), "style"));
        int w = 60;
        for (EffectInfo e : shown(m)) w = Math.max(w, m.text().width(row(e, compact), TextStyle.BODY) + 10);
        return w;
    }
    @Override protected int baseHeight(ModContext m) { return Math.max(1, shown(m).size()) * 11 + 5; }

    @Override protected void draw(Canvas canvas, int x, int y, float tick, ModContext m) {
        CirrusConfig c = m.config();
        surface(canvas, x, y, baseWidth(m), baseHeight(m), 6, c, CirrusTheme.current(c));
        boolean compact = "Compact".equals(opt(c, "style")), warn = on(c, "warn");
        int line = y + 3;
        for (EffectInfo e : shown(m)) {
            int color = textColor(c);
            if (!e.beneficial()) color = BAD;
            else if (warn && !e.infinite() && e.ticksLeft() < 200) color = WARN;
            canvas.text(row(e, compact), TextStyle.BODY, x + 5, line, color, shadowOn(c));
            line += 11;
        }
    }
}
