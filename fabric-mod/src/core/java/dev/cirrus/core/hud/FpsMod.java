package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.module.ModCategory;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.render.Canvas;
import dev.cirrus.core.render.Icons;
import dev.cirrus.core.settings.Setting;
import dev.cirrus.core.text.TextStyle;
import dev.cirrus.core.theme.CirrusTheme;

import java.util.List;

/** Frames per second as plain text, with an optional background. */
public final class FpsMod extends HudMod {
    private final FormatTemplate.Cache text = new FormatTemplate.Cache();

    public String id() { return "fps"; }
    public String name() { return "FPS"; }
    public String description() { return "Shows your frames per second as plain text."; }
    public ModCategory category() { return ModCategory.HUD; }
    @Override public int icon() { return Icons.GAUGE; }
    private static final List<Setting> OWN = java.util.Collections.unmodifiableList(java.util.Arrays.asList(FormatTemplate.setting(FormatTemplate.MAPLE), HudColors.setting()));
    @Override protected List<Setting> featureSettings() { return OWN; }
    @Override protected List<Setting> appearance() { return SIMPLE; }
    @Override protected int baseWidth(ModContext m) { return m.text().width(FormatTemplate.apply(FormatTemplate.template(opt(m.config(), "format"), "FPS", ""), "000"), TextStyle.BODY) + 10; }
    @Override protected int baseHeight(ModContext m) { return 16; }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return 8; }

    @Override protected void draw(Canvas canvas, int x, int y, float tick, ModContext m) {
        CirrusConfig c = m.config();
        surface(canvas, x, y, baseWidth(m), 16, 6, c, CirrusTheme.current(c));
        drawInfo(canvas, x + 5, y + 3, c, m, "FPS", "", Integer.toString(m.fps()), textColor(c));
    }
}
