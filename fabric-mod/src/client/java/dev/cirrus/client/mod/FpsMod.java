package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

/** Frames per second, coloured by how healthy the number is. */
public final class FpsMod extends HudMod {
    public String id() { return "fps"; }
    public String name() { return "FPS Counter"; }
    public String description() { return "Shows your current frames per second."; }
    public ModCategory category() { return ModCategory.HUD; }
    public int width() { return 70; }
    public int height() { return 20; }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return 8; }

    public void render(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(c);
        int fps = mc.getFps();
        CirrusUi.hudPanel(g, x, y, width(), height(), 7, t);
        CirrusUi.smallText(g, mc.font, "FPS", x + 8, y + 6, t.muted, false);
        String value = Integer.toString(fps);
        CirrusUi.text(g, mc.font, value, x + width() - 8 - CirrusUi.bodyWidth(mc.font, value), y + 5, level(fps, 60, 30, t), false);
    }

    static int level(int value, int good, int ok, CirrusTheme t) { return value >= good ? t.good : value >= ok ? 0xFFF5B942 : 0xFFF0605D; }
}
