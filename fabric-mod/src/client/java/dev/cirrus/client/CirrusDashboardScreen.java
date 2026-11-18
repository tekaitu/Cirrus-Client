package dev.cirrus.client;

import dev.cirrus.client.ui.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.network.chat.Component;

/** Landing page: navigation rail plus live information about this Minecraft instance. */
public final class CirrusDashboardScreen extends CirrusScreen {
    private int railX, railW, cx, cw, infoY, infoH;

    public CirrusDashboardScreen(Screen parent) { super(Component.literal("Cirrus Dashboard"), parent); }

    @Override protected void init() {
        railX = 14;
        railW = Math.max(compact() ? 100 : 112, Math.min(132, width / 4));
        cx = railX + railW + 8;
        cw = width - 14 - cx;
        int y = 14 + (compact() ? 32 : 40), rowH = 20, gap = compact() ? 3 : 5;
        addRenderableWidget(CirrusButton.nav(railX + 6, y, railW - 12, rowH, Component.literal("Mods"), CirrusUi.ICON_MODS, b -> minecraft.setScreen(new CirrusMenuScreen(this))));
        addRenderableWidget(CirrusButton.nav(railX + 6, y += rowH + gap, railW - 12, rowH, Component.literal("HUD Editor"), CirrusUi.ICON_HUD, b -> minecraft.setScreen(new HudEditorScreen(this))));
        addRenderableWidget(CirrusButton.nav(railX + 6, y += rowH + gap, railW - 12, rowH, Component.literal("Themes"), CirrusUi.ICON_THEMES, b -> minecraft.setScreen(new CirrusThemesScreen(this))));
        addRenderableWidget(CirrusButton.nav(railX + 6, y += rowH + gap, railW - 12, rowH, Component.literal("Settings"), CirrusUi.ICON_SETTINGS, b -> minecraft.setScreen(new OptionsScreen(this, minecraft.options))));
        addRenderableWidget(CirrusButton.of(railX + 6, height - 14 - 6 - rowH, railW - 12, rowH, Component.literal("Close"), b -> minecraft.setScreen(parent)));

        infoY = 14 + 34;
        infoH = Math.min(124, height - infoY - 14);
        int by = infoY + infoH - 6 - 22;
        int half = (cw - 24 - 6) / 2;
        addRenderableWidget(CirrusButton.primary(cx + 12, by, half, 22, Component.literal("Open Mods"), b -> minecraft.setScreen(new CirrusMenuScreen(this))));
        addRenderableWidget(CirrusButton.of(cx + 12 + half + 6, by, half, 22, Component.literal("Edit HUD"), b -> minecraft.setScreen(new HudEditorScreen(this))));
    }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        CirrusUi.panel(g, 6, 6, width - 12, height - 12, 16, t);
        CirrusUi.card(g, railX, 14, railW, height - 28, 12, t.surface, t.border);
        CirrusUi.mark(g, railX + 10, 14 + 8, compact() ? 16 : 22, t);
        CirrusUi.headingText(g, font, "DASHBOARD", cx + 2, 14 + 8, t.cyan);
        CirrusUi.smallText(g, font, "Everything about this session at a glance", cx + 2, 14 + 8 + 14, t.muted, false);
        CirrusUi.card(g, cx, infoY, cw, infoH, 12, t.surface, t.border);
        int x = cx + 12, w = cw - 24, y = infoY + 10;
        CirrusUi.headingText(g, font, "YOUR GAME", x, y, t.text);
        g.fill(x, y + 13, x + w, y + 14, t.border);
        y += 20;
        row(g, x, y, w, "Minecraft", "1.21.11  ·  " + Minecraft.getInstance().getLaunchedVersion(), t); y += 14;
        row(g, x, y, w, "Theme", t == CirrusTheme.DARK ? "Midnight (dark)" : "Frost (light)", t); y += 14;
        if (infoH >= 110) row(g, x, y, w, "Instance", Minecraft.getInstance().gameDirectory.toPath().toString(), t);
    }

    private void row(GuiGraphics g, int x, int y, int w, String label, String value, CirrusTheme t) {
        CirrusUi.smallText(g, font, label, x, y, t.muted, false);
        int labelW = 52;
        CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, value, w - labelW), x + labelW, y, t.text, false);
    }

    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) { CirrusUi.dashboardBackdrop(g, width, height, theme()); }
}
