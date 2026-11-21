package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

import java.util.List;

/** Frames per second as plain text, with an optional background. */
public final class FpsMod extends HudMod {
    public String id() { return "fps"; }
    public String name() { return "FPS"; }
    public String description() { return "Shows your frames per second as plain text."; }
    public ModCategory category() { return ModCategory.HUD; }
    @Override public int icon() { return dev.cirrus.client.ui.Glyphs.GAUGE; }
    @Override protected List<Setting> appearance() { return SIMPLE; }
    @Override protected int baseWidth(CirrusConfig c) { return CirrusUi.bodyWidth(Minecraft.getInstance().font, "FPS: 000") + 10; }
    @Override protected int baseHeight(CirrusConfig c) { return 16; }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return 8; }

    @Override protected void draw(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(c);
        surface(g, x, y, baseWidth(c), 16, 6, c, t);
        CirrusUi.text(g, mc.font, "FPS: " + mc.getFps(), x + 5, y + 3, 0xFFFFFFFF, shadowOn(c));
    }
}
