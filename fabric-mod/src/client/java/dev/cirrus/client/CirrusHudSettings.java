package dev.cirrus.client;
import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.client.mod.HudElement;
import dev.cirrus.client.mod.HudElementRegistry;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

/** Draws every enabled HUD element each frame. */
final class CirrusHudSettings {
    private CirrusHudSettings() {}
    private static CirrusConfig config() { return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath()); }
    static void render(GuiGraphics g) {
        int w = Minecraft.getInstance().getWindow().getGuiScaledWidth(), h = Minecraft.getInstance().getWindow().getGuiScaledHeight();
        dev.cirrus.core.perf.PerfMeter.HUD.begin();
        for (HudElement e : HudElementRegistry.all()) if (e.enabled(config())) e.render(g, e.x(config(), w), e.y(config(), h), 0, config());
        dev.cirrus.core.perf.PerfMeter.HUD.end();
    }
}
