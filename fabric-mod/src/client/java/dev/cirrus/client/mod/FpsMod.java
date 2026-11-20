package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

import java.util.List;

/** Frames per second, optionally coloured by how healthy the number is. */
public final class FpsMod extends HudMod {
    private static final List<Setting> OWN = List.of(
        Setting.toggle("label", "Show label", "Show the word FPS next to the number.", true),
        Setting.toggle("colorize", "Color by value", "Green when smooth, amber when borderline, red when low.", true));

    public String id() { return "fps"; }
    public String name() { return "FPS Counter"; }
    public String description() { return "Shows your current frames per second."; }
    public ModCategory category() { return ModCategory.HUD; }
    @Override public int icon() { return dev.cirrus.client.ui.CirrusUi.ICON_PERFORMANCE; }
    @Override protected List<Setting> featureSettings() { return OWN; }
    @Override protected int baseWidth(CirrusConfig c) { return on(c, "label") ? 70 : 44; }
    @Override protected int baseHeight(CirrusConfig c) { return 20; }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return 8; }

    @Override protected void draw(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(c);
        int fps = mc.getFps();
        int w = baseWidth(c);
        surface(g, x, y, w, 20, 7, c, t);
        boolean label = on(c, "label");
        if (label) CirrusUi.smallText(g, mc.font, "FPS", x + 8, y + 6, t.muted, shadowOn(c));
        String value = Integer.toString(fps);
        int color = on(c, "colorize") ? level(fps, 60, 30, t) : t.text;
        int vx = label ? x + w - 8 - CirrusUi.bodyWidth(mc.font, value) : x + (w - CirrusUi.bodyWidth(mc.font, value)) / 2;
        CirrusUi.text(g, mc.font, value, vx, y + 5, color, shadowOn(c));
    }

    static int level(int value, int good, int ok, CirrusTheme t) { return value >= good ? t.good : value >= ok ? 0xFFF5B942 : 0xFFF0605D; }
}
