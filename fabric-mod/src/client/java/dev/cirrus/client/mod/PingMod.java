package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

import java.util.List;

/** Latency to the current server as plain text, read from the tab-list entry the server reports for you. */
public final class PingMod extends HudMod {
    public String id() { return "ping"; }
    public String name() { return "Ping"; }
    public String description() { return "Shows your latency to the server as plain text."; }
    public ModCategory category() { return ModCategory.HUD; }
    @Override public int icon() { return dev.cirrus.client.ui.Glyphs.SIGNAL; }
    @Override protected List<Setting> appearance() { return SIMPLE; }
    @Override protected int baseWidth(CirrusConfig c) { return CirrusUi.bodyWidth(Minecraft.getInstance().font, "Ping: 000 ms") + 10; }
    @Override protected int baseHeight(CirrusConfig c) { return 16; }
    @Override public int defaultX() { return 84; }
    @Override public int defaultY(int screenHeight) { return 8; }

    @Override protected void draw(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(c);
        int ping = mc.player == null ? 42 : latency(mc); // sample value in the editor
        surface(g, x, y, baseWidth(c), 16, 6, c, t);
        CirrusUi.text(g, mc.font, "Ping: " + (ping < 0 ? "--" : ping + " ms"), x + 5, y + 3, 0xFFFFFFFF, shadowOn(c));
    }

    /** -1 when there is nothing to measure (no connection, or a local singleplayer world). */
    private static int latency(Minecraft mc) {
        if (mc.player == null || mc.getConnection() == null || mc.hasSingleplayerServer()) return -1;
        var info = mc.getConnection().getPlayerInfo(mc.player.getUUID());
        return info == null ? -1 : info.getLatency();
    }
}
