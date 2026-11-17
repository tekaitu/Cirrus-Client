package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusButton;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
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
    private int panelX, panelY, panelW, panelH, buttonW;

    public CirrusTitleScreen() { super(false); }

    @Override protected void init() {
        buttons.clear();
        buttonW = Math.min(220, Math.max(150, width / 3));
        panelW = Math.min(buttonW + 34, width - 28);
        panelH = Math.min(height - 24, 204);
        panelX = (width - panelW) / 2;
        panelY = Math.max(12, (height - panelH) / 2);
        int x = (width - buttonW) / 2, y = panelY + 98;
        add(CirrusButton.nav(x, y, buttonW, 22, Component.literal("Singleplayer"), CirrusUi.ICON_SINGLEPLAYER, b -> minecraft.setScreen(new SelectWorldScreen(this))));
        add(CirrusButton.nav(x, y + 27, buttonW, 22, Component.literal("Multiplayer"), CirrusUi.ICON_MULTIPLAYER, b -> minecraft.setScreen(new JoinMultiplayerScreen(this))));
        add(CirrusButton.nav(x, y + 54, buttonW, 22, Component.literal("Cirrus Client"), CirrusUi.ICON_DASHBOARD, b -> minecraft.setScreen(new CirrusDashboardScreen(this))));
        add(CirrusButton.nav(x, y + 81, buttonW / 2 - 3, 22, Component.literal("Options"), CirrusUi.ICON_SETTINGS, b -> minecraft.setScreen(new OptionsScreen(this, minecraft.options))));
        add(CirrusButton.nav(x + buttonW / 2 + 3, y + 81, buttonW / 2 - 3, 22, Component.literal("Quit"), CirrusUi.ICON_CLOSE, b -> minecraft.stop()));
    }

    private void add(AbstractWidget widget) { buttons.add(widget); addRenderableWidget(widget); }

    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) {
        CirrusUi.backdrop(g, width, height, theme());
    }

    @Override public void render(GuiGraphics g, int mx, int my, float delta) {
        var t = theme();
        CirrusUi.panel(g, panelX, panelY, panelW, panelH, 20, t);
        CirrusUi.brand(g, width / 2 - 70, panelY + 14, 42, t);
        CirrusUi.centeredHeading(g, font, "YOUR NEXT SESSION STARTS HERE", width / 2, panelY + 66, t.text);
        CirrusUi.centeredSmall(g, font, "MINECRAFT CLIENT  ·  FABRIC 1.21.11", width / 2, panelY + 82, t.cyan);
        for (AbstractWidget b : buttons) b.render(g, mx, my, delta);
    }

    @Override public void tick() { }
    @Override public void added() { }
    @Override public void removed() { }

    private CirrusTheme theme() { return CirrusTheme.current(CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath())); }
}
