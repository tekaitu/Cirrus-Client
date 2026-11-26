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

/** Latency to the current server as plain text, as the game reports it for you. */
public final class PingMod extends HudMod {
    /** Shown in menus and the HUD editor, where there is no world to measure. */
    static final int SAMPLE = 42;
    private final FormatTemplate.Cache text = new FormatTemplate.Cache();

    public String id() { return "ping"; }
    public String name() { return "Ping"; }
    public String description() { return "Shows your latency to the server as plain text."; }
    public ModCategory category() { return ModCategory.HUD; }
    @Override public int icon() { return Icons.SIGNAL; }
    @Override protected List<Setting> featureSettings() { return TEXT; }
    @Override protected List<Setting> appearance() { return SIMPLE; }
    @Override protected int baseWidth(ModContext m) { return m.text().width(FormatTemplate.apply(FormatTemplate.template(opt(m.config(), "format"), "Ping", "ms"), "000"), TextStyle.BODY) + 10; }
    @Override protected int baseHeight(ModContext m) { return 16; }
    @Override public int defaultX() { return 84; }
    @Override public int defaultY(int screenHeight) { return 8; }

    @Override protected void draw(Canvas canvas, int x, int y, float tick, ModContext m) {
        CirrusConfig c = m.config();
        int ping = m.inWorld() ? m.pingMillis() : SAMPLE;
        surface(canvas, x, y, baseWidth(m), 16, 6, c, CirrusTheme.current(c));
        canvas.text(text.get(opt(c, "format"), "Ping", "ms", ping < 0 ? "--" : Integer.toString(ping)), TextStyle.BODY, x + 5, y + 3, textColor(c), shadowOn(c));
    }
}
