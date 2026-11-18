package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

/** Latency to the current server, read from the tab-list entry the server reports for you. */
public final class PingMod extends HudMod {
    public String id() { return "ping"; }
    public String name() { return "Ping"; }
    public String description() { return "Shows your latency to the server in milliseconds."; }
    public ModCategory category() { return ModCategory.HUD; }
    public int width() { return 84; }
    public int height() { return 20; }
    @Override public int defaultX() { return 84; }
    @Override public int defaultY(int screenHeight) { return 8; }

    public void render(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(c);
        int ping = latency(mc);
        CirrusUi.hudPanel(g, x, y, width(), height(), 7, t);
        CirrusUi.smallText(g, mc.font, "PING", x + 8, y + 6, t.muted, false);
        String value = ping < 0 ? "--" : ping + " ms";
        int color = ping < 0 ? t.muted : ping < 80 ? t.good : ping < 160 ? 0xFFF5B942 : 0xFFF0605D;
        CirrusUi.text(g, mc.font, value, x + width() - 8 - CirrusUi.bodyWidth(mc.font, value), y + 5, color, false);
    }

    /** -1 when there is nothing to measure (no connection, or a local singleplayer world). */
    private static int latency(Minecraft mc) {
        if (mc.player == null || mc.getConnection() == null || mc.hasSingleplayerServer()) return -1;
        var info = mc.getConnection().getPlayerInfo(mc.player.getUUID());
        return info == null ? -1 : info.getLatency();
    }
}
