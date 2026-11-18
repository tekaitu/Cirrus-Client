package dev.cirrus.client;

import dev.cirrus.client.ui.*;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Settings for the Cirrus Status HUD element. */
public final class CirrusStatusSettingsScreen extends CirrusScreen {
    private int px, py, pw, ph;

    public CirrusStatusSettingsScreen(Screen parent) { super(Component.literal("Cirrus Status Settings"), parent); }

    @Override protected void init() {
        pw = Math.min(300, width - 16);
        ph = Math.min(height - 16, 130);
        px = (width - pw) / 2;
        py = (height - ph) / 2;
        int bw = pw - 48, x = px + 24;
        var cfg = config();
        addRenderableWidget(CirrusButton.nav(x, py + 52, bw, 22, Component.literal("Position: " + cfg.getString("hud.anchor.local_status", "TOP_LEFT").replace('_', ' ')), CirrusUi.ICON_HUD, b -> {
            String next = cfg.getString("hud.anchor.local_status", "TOP_LEFT").equals("TOP_LEFT") ? "TOP_RIGHT" : "TOP_LEFT";
            cfg.put("hud.anchor.local_status", next);
            b.setMessage(Component.literal("Position: " + next.replace('_', ' ')));
        }));
        addRenderableWidget(CirrusButton.primary(x, py + ph - 14 - 22, bw, 22, Component.literal("Back"), b -> minecraft.setScreen(parent)));
    }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        CirrusUi.panel(g, px, py, pw, ph, 16, t);
        CirrusUi.headingText(g, font, "STATUS HUD", px + 24, py + 16, t.cyan);
        CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, "Choose which side of the screen anchors this element.", pw - 48), px + 24, py + 31, t.muted, false);
    }
}
