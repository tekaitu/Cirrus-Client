package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

import java.util.List;

/** Latency to the current server, read from the tab-list entry the server reports for you. */
public final class PingMod extends HudMod {
    private static final List<Setting> OWN = List.of(
        Setting.toggle("label", "Show label", "Show the word PING next to the number.", true),
        Setting.toggle("unit", "Show ms", "Append the unit to the number.", true),
        Setting.toggle("colorize", "Color by value", "Green when low, amber when moderate, red when high.", true));

    public String id() { return "ping"; }
    public String name() { return "Ping"; }
    public String description() { return "Shows your latency to the server in milliseconds."; }
    public ModCategory category() { return ModCategory.HUD; }
    @Override public int icon() { return dev.cirrus.client.ui.CirrusUi.ICON_MULTIPLAYER; }
    @Override protected List<Setting> featureSettings() { return OWN; }
    @Override protected int baseWidth(CirrusConfig c) { return (on(c, "label") ? 44 : 16) + (on(c, "unit") ? 40 : 28); }
    @Override protected int baseHeight(CirrusConfig c) { return 20; }
    @Override public int defaultX() { return 84; }
    @Override public int defaultY(int screenHeight) { return 8; }

    @Override protected void draw(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(c);
        int ping = mc.player == null ? 42 : latency(mc); // sample value in the editor
        int w = baseWidth(c);
        surface(g, x, y, w, 20, 7, c, t);
        boolean label = on(c, "label");
        if (label) CirrusUi.smallText(g, mc.font, "PING", x + 8, y + 6, t.muted, shadowOn(c));
        String value = ping < 0 ? "--" : ping + (on(c, "unit") ? " ms" : "");
        int color = !on(c, "colorize") ? t.text : ping < 0 ? t.muted : ping < 80 ? t.good : ping < 160 ? 0xFFF5B942 : 0xFFF0605D;
        int vw = CirrusUi.bodyWidth(mc.font, value);
        CirrusUi.text(g, mc.font, value, label ? x + w - 8 - vw : x + (w - vw) / 2, y + 5, color, shadowOn(c));
    }

    /** -1 when there is nothing to measure (no connection, or a local singleplayer world). */
    private static int latency(Minecraft mc) {
        if (mc.player == null || mc.getConnection() == null || mc.hasSingleplayerServer()) return -1;
        var info = mc.getConnection().getPlayerInfo(mc.player.getUUID());
        return info == null ? -1 : info.getLatency();
    }
}
