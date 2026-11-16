package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusButton;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.network.chat.Component;

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
        Minecraft mc = Minecraft.getInstance(); if (mc.player == null || mc.level == null) return;
        var theme = CirrusTheme.current(c);
        CirrusUi.panel(g,x,y,width(),height(),8,theme);
        CirrusUi.headingText(g,mc.font,"CIRRUS",x+8,y+4,theme.text);
        CirrusUi.smallText(g,mc.font,"LOCAL HUD",x+8,y+18,theme.muted,false);
    }
    public void openSettings(net.minecraft.client.gui.screens.Screen parent) {
        Minecraft.getInstance().setScreen(new net.minecraft.client.gui.screens.Screen(Component.literal("Cirrus Status Settings")) {
            protected void init() {
                var cfg = CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());
                int buttonWidth=Math.min(200,width-48);
                var button = CirrusButton.of((width-buttonWidth)/2,height/2-4,buttonWidth,24,Component.literal("Position: " + cfg.getString("hud.anchor.local_status", "TOP_LEFT").replace('_',' ')), b -> {
                    String next = cfg.getString("hud.anchor.local_status", "TOP_LEFT").equals("TOP_LEFT") ? "TOP_RIGHT" : "TOP_LEFT";
                    cfg.put("hud.anchor.local_status", next); b.setMessage(Component.literal("Position: " + next.replace('_',' ')));
                }); addRenderableWidget(button);
                int backWidth=Math.min(140,width-48);
                addRenderableWidget(CirrusButton.of((width-backWidth)/2,height/2+30,backWidth,22,Component.literal("Back"), b -> Minecraft.getInstance().setScreen(parent)));
            }
            public void render(GuiGraphics g,int x,int y,float d) {
                renderBackground(g,x,y,d);var theme=CirrusTheme.current(CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath()));
                int cardW=Math.min(420,width-28),cardH=Math.min(260,height-28),left=(width-cardW)/2,top=(height-cardH)/2;
                CirrusUi.backdrop(g,width,height,theme);CirrusUi.panel(g,left,top,cardW,cardH,18,theme);
                CirrusUi.brand(g,width/2-63,top+18,28,theme);CirrusUi.centeredHeading(g,font,"STATUS HUD",width/2,top+66,theme.cyan);
                CirrusUi.centeredSmall(g,font,"Choose which side of the screen anchors this element.",width/2,top+86,theme.muted);super.render(g,x,y,d);
            }
            public void onClose() { Minecraft.getInstance().setScreen(parent); }
        });
    }
}
