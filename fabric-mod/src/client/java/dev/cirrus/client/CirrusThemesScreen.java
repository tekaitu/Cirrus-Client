package dev.cirrus.client;

import dev.cirrus.client.ui.*;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Built-in themes. Palette tokens in CirrusTheme keep additional themes cheap to add. */
public final class CirrusThemesScreen extends CirrusScreen {
    private int shellX, shellY, shellW, shellH, cardY, cardW, cardH, leftX, rightX;

    public CirrusThemesScreen(Screen parent) { super(Component.literal("Cirrus Themes"), parent); }

    @Override protected void init() {
        shellW = Math.min(440, width - 16);
        shellH = Math.min(height - 16, 214);
        shellX = (width - shellW) / 2;
        shellY = (height - shellH) / 2;
        cardW = (shellW - 36 - 10) / 2;
        cardH = Math.max(50, shellH - 28 - 22 - 34 - 28);
        cardY = shellY + 28 + 18;
        leftX = shellX + 18;
        rightX = leftX + cardW + 10;
        int by = cardY + cardH + 8;
        addRenderableWidget(CirrusButton.nav(leftX, by, cardW, 20, Component.literal(theme() == CirrusTheme.DARK ? "Midnight  ·  selected" : "Use Midnight"), CirrusUi.ICON_THEMES, b -> { CirrusTheme.set(config(), CirrusTheme.DARK); rebuildWidgets(); }));
        addRenderableWidget(CirrusButton.nav(rightX, by, cardW, 20, Component.literal(theme() == CirrusTheme.LIGHT ? "Frost  ·  selected" : "Use Frost"), CirrusUi.ICON_THEMES, b -> { CirrusTheme.set(config(), CirrusTheme.LIGHT); rebuildWidgets(); }));
        addRenderableWidget(CirrusButton.primary(shellX + shellW - 18 - 72, shellY + shellH - 14 - 22, 72, 22, Component.literal("Back"), b -> minecraft.setScreen(parent)));
    }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        CirrusUi.panel(g, shellX, shellY, shellW, shellH, 18, t);
        CirrusUi.headingText(g, font, "APPEARANCE", shellX + 18, shellY + 14, t.cyan);
        preview(g, leftX, cardY, cardW, cardH, CirrusTheme.DARK, "Midnight glass", t == CirrusTheme.DARK, t);
        preview(g, rightX, cardY, cardW, cardH, CirrusTheme.LIGHT, "Frost glass", t == CirrusTheme.LIGHT, t);
    }

    private void preview(GuiGraphics g, int x, int y, int w, int h, CirrusTheme sample, String name, boolean selected, CirrusTheme current) {
        Gfx.fillRound(g, x, y, w, h, 12, Gfx.mix(sample == CirrusTheme.DARK ? 0xFF0B1220 : 0xFFDDE8F6, sample.panel, 0.55f));
        Gfx.strokeRound(g, x, y, w, h, 12, selected ? 1.5f : 0.5f, selected ? current.cyan : current.border);
        CirrusUi.headingText(g, font, "Aa", x + 12, y + 10, sample.text);
        CirrusUi.smallText(g, font, name, x + 12, y + 24, sample.muted, false);
        int bx = x + 12, by = y + h - 24, bw = Math.max(20, w - 24);
        Gfx.fillRound(g, bx, by, bw, 14, 7, Gfx.mix(sample.surface, sample.accent, 0.3f));
        Gfx.fillRound(g, bx + 4, by + 5, Math.max(8, bw / 3), 4, 2, sample.cyan);
    }
}
