package dev.cirrus.client;

import dev.cirrus.core.theme.CirrusTheme;
import dev.cirrus.client.ui.*;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** First-run choices are persisted per game directory; skipping completes onboarding with defaults. */
public final class CirrusWelcomeScreen extends CirrusScreen {
    private int px, py, pw, ph, brandSize;
    private boolean roomy;

    public CirrusWelcomeScreen(Screen parent) { super(Component.literal("Welcome to Cirrus"), parent); }

    @Override protected void init() {
        pw = Math.min(300, width - 16);
        roomy = height >= 230;
        brandSize = roomy ? 32 : 22;
        ph = Math.min(height - 16, roomy ? 170 : 120);
        px = (width - pw) / 2;
        py = (height - ph) / 2;
        int bw = pw - 48, x = px + 24, rowH = 22;
        int y = py + ph - 14 - rowH;
        int half = (bw - 6) / 2;
        addRenderableWidget(CirrusButton.primary(x, y, half, rowH, Component.literal("Continue"), b -> finish()));
        addRenderableWidget(CirrusButton.of(x + half + 6, y, half, rowH, Component.literal("Skip"), b -> finish()));
    }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        CirrusUi.panel(g, px, py, pw, ph, 18, t);
        int y = py + 14;
        CirrusUi.brand(g, (width - CirrusUi.brandWidth(font, brandSize)) / 2, y, brandSize, t);
        y += brandSize + 10;
        CirrusUi.centeredHeading(g, font, "WELCOME TO CIRRUS", width / 2, y, t.text);
        y += 14;
        CirrusUi.centered(g, font, "Press Right Shift in game to open the menu.", width / 2, y, t.text);
        if (roomy) {
            y += 16;
            CirrusUi.centeredSmall(g, font, "Turn features on, move them, and tune each one in its settings.", width / 2, y, t.muted);
        }
    }

    private void finish() { config().put("onboarding.complete", "true"); minecraft.setScreen(parent); }
    @Override public void onClose() { finish(); }
}
