package dev.cirrus.client;

import dev.cirrus.client.mod.ClientModContext;
import dev.cirrus.client.render.McCanvas;
import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.hud.HudElement;
import dev.cirrus.core.hud.HudElementRegistry;
import dev.cirrus.core.perf.PerfMeter;
import dev.cirrus.core.render.Canvas;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

import java.util.List;

/** Draws every widget that is on the HUD each frame. Allocation-free: registry snapshot, cached config, shared canvas. */
final class CirrusHudSettings {
    private CirrusHudSettings() {}

    static void render(GuiGraphics g) {
        // The HUD editor draws the widgets itself (with selection frames); drawing them here too would double every one.
        if (Minecraft.getInstance().screen instanceof HudEditorScreen) return;
        ClientModContext ctx = ClientModContext.INSTANCE;
        CirrusConfig cfg = ctx.config();
        int w = ctx.screenWidth(), h = ctx.screenHeight();
        Canvas canvas = McCanvas.of(g);
        PerfMeter.HUD.begin();
        List<HudElement> all = HudElementRegistry.all();
        for (int i = 0; i < all.size(); i++) {
            HudElement e = all.get(i);
            if (e.visible(cfg)) e.render(canvas, e.x(cfg, w), e.y(cfg, h), 0, ctx);
        }
        PerfMeter.HUD.end();
    }
}
