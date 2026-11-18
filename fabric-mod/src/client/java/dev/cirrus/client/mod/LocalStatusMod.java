package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

public final class LocalStatusMod implements CirrusMod, HudElement {
    @Override public boolean enabled(CirrusConfig c) { return CirrusMod.super.enabled(c); }
    @Override public void setEnabled(CirrusConfig c, boolean value) { CirrusMod.super.setEnabled(c, value); }
    public String id() { return "local_status"; }
    public String name() { return "Cirrus Status"; }
    public String description() { return "A compact in-game status badge with configurable screen position."; }
    public ModCategory category() { return ModCategory.HUD; }
    public boolean defaultEnabled() { return false; }
    public boolean hasSettings() { return true; }
    public String label() { return name(); }
    public int width() { return 132; }
    public int height() { return 30; }
    public void render(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance(); if ((mc.player == null || mc.level == null) && !(mc.screen instanceof dev.cirrus.client.HudEditorScreen)) return;
        var theme = CirrusTheme.current(c);
        CirrusUi.panel(g,x,y,width(),height(),8,theme);
        CirrusUi.headingText(g,mc.font,"CIRRUS",x+8,y+4,theme.text);
        CirrusUi.smallText(g,mc.font,"LOCAL HUD",x+8,y+18,theme.muted,false);
    }
    public void openSettings(net.minecraft.client.gui.screens.Screen parent) {
        Minecraft.getInstance().setScreen(new dev.cirrus.client.CirrusStatusSettingsScreen(parent));
    }
}
