package dev.cirrus.client;

import dev.cirrus.client.ui.CirrusButton;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.config.CirrusConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.network.chat.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Cirrus main menu. It extends the vanilla TitleScreen so other mods and the game still see a title screen,
 * but it owns its whole layout and draws every element exactly once, back to front.
 */
public final class CirrusTitleScreen extends TitleScreen {
    private final List<AbstractWidget> buttons = new ArrayList<>();
    private int panelX, panelY, panelW, panelH, brandY, brandSize, tagY;
    private boolean showTagline;

    public CirrusTitleScreen() { super(false); }

    @Override protected void init() {
        buttons.clear();
        final int rowH = 22, gap = 5, rows = rowH * 4 + gap * 3;
        int avail = height - 16;
        brandSize = 34; showTagline = true; int pad = 14, g1 = 8, g2 = 10, tagH = 11;
        int needed = pad + brandSize + g1 + tagH + g2 + rows + pad;
        if (needed > avail) { showTagline = false; needed = pad + brandSize + g2 + rows + pad; }
        if (needed > avail) { brandSize = 26; pad = 10; needed = pad + brandSize + 8 + rows + pad; g2 = 8; }
        if (needed > avail) { brandSize = 20; pad = 7; g2 = 6; needed = pad + brandSize + g2 + rows + pad; }
        panelW = Math.min(250, width - 16);
        panelH = Math.min(avail, needed);
        panelX = (width - panelW) / 2;
        panelY = (height - panelH) / 2;
        brandY = panelY + pad;
        tagY = brandY + brandSize + g1;
        int y = panelY + panelH - pad - rows, bw = panelW - 32, x = (width - bw) / 2;
        add(CirrusButton.nav(x, y, bw, rowH, Component.literal("Singleplayer"), CirrusUi.ICON_SINGLEPLAYER, b -> minecraft.setScreen(new SelectWorldScreen(this))));
        add(CirrusButton.nav(x, y + rowH + gap, bw, rowH, Component.literal("Multiplayer"), CirrusUi.ICON_MULTIPLAYER, b -> minecraft.setScreen(new JoinMultiplayerScreen(this))));
        add(CirrusButton.nav(x, y + (rowH + gap) * 2, bw, rowH, Component.literal("Cirrus Client"), CirrusUi.ICON_DASHBOARD, b -> minecraft.setScreen(new CirrusDashboardScreen(this))));
        int half = (bw - gap) / 2, y4 = y + (rowH + gap) * 3;
        add(CirrusButton.nav(x, y4, half, rowH, Component.literal("Options"), CirrusUi.ICON_SETTINGS, b -> minecraft.setScreen(new OptionsScreen(this, minecraft.options))));
        add(CirrusButton.nav(x + half + gap, y4, half, rowH, Component.literal("Quit"), CirrusUi.ICON_CLOSE, b -> minecraft.stop()));
    }

    private void add(AbstractWidget widget) { buttons.add(widget); addRenderableWidget(widget); }

    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) {
        CirrusUi.backdrop(g, width, height, theme());
    }

    @Override public void render(GuiGraphics g, int mx, int my, float delta) {
        var t = theme();
        CirrusUi.panel(g, panelX, panelY, panelW, panelH, 16, t);
        CirrusUi.brand(g, (width - CirrusUi.brandWidth(font, brandSize)) / 2, brandY, brandSize, t);
        if (showTagline) CirrusUi.centeredSmall(g, font, "Fabric 1.21.11  ·  Your next session starts here", width / 2, tagY, t.muted);
        for (AbstractWidget b : buttons) b.render(g, mx, my, delta);
    }

    @Override public void tick() { }
    @Override public void added() { }
    @Override public void removed() { }

    private CirrusTheme theme() { return CirrusTheme.current(CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath())); }
}
