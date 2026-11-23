package dev.cirrus.client;

import dev.cirrus.core.theme.CirrusTheme;
import dev.cirrus.core.module.ModRegistry;
import dev.cirrus.client.ui.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.network.chat.Component;

/** Home: a short summary of this session and quick actions. */
public final class CirrusDashboardScreen extends CirrusScreen {
    private int px, py, pw, ph;

    public CirrusDashboardScreen(Screen parent) { super(Component.literal("Cirrus Home"), parent); }

    @Override protected Tab activeTab() { return Tab.HOME; }

    @Override protected void init() {
        buildHeader();
        px = contentX; py = contentY; pw = contentW; ph = contentBottom - contentY;
        int pad = compact() ? 8 : 14, bh = 22, gap = 6;
        int by = py + ph - pad - bh;
        int bw = (pw - pad * 2 - gap * 2) / 3;
        addRenderableWidget(CirrusButton.primary(px + pad, by, bw, bh, Component.literal("Open mods"), b -> minecraft.setScreen(new CirrusMenuScreen(parent))));
        addRenderableWidget(CirrusButton.of(px + pad + bw + gap, by, bw, bh, Component.literal("Edit HUD"), b -> minecraft.setScreen(new HudEditorScreen(this))));
        addRenderableWidget(CirrusButton.of(px + pad + (bw + gap) * 2, by, bw, bh, Component.literal("Minecraft settings"), b -> minecraft.setScreen(new OptionsScreen(this, minecraft.options))));
    }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        CirrusUi.panel(g, px, py, pw, ph, 14, t);
        int pad = compact() ? 8 : 14, x = px + pad, w = pw - pad * 2, y = py + pad;
        CirrusUi.headingText(g, font, "YOUR SESSION", x, y, t.cyan);
        g.fill(x, y + 14, x + w, y + 15, t.border);
        y += 22;
        long on = ModRegistry.all().stream().filter(m -> m.enabled(config())).count();
        row(g, x, y, w, "Minecraft", "1.21.11  ·  " + Minecraft.getInstance().getLaunchedVersion(), t); y += 14;
        row(g, x, y, w, "Mods", on + " of " + ModRegistry.all().size() + " enabled", t); y += 14;
        if (ph >= 130) row(g, x, y, w, "Instance", Minecraft.getInstance().gameDirectory.toPath().toString(), t);
    }

    private void row(GuiGraphics g, int x, int y, int w, String label, String value, CirrusTheme t) {
        CirrusUi.smallText(g, font, label, x, y, t.muted, false);
        CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, value, w - 56), x + 56, y, t.text, false);
    }

    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) {
        if (minecraft.level != null) super.renderBackground(g, mx, my, delta);
        else CirrusUi.dashboardBackdrop(g, width, height, theme());
    }
}
