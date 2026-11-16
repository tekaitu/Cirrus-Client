package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
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
        g.fill(x, y, x + width(), y + height(), 0xD8101724); g.renderOutline(x, y, width(), height(), 0x805B98DE);
        g.drawString(mc.font, Component.literal("CIRRUS"), x + 8, y + 6, 0xFFF2F6FC, false);
        g.drawString(mc.font, Component.literal("LOCAL HUD"), x + 8, y + 18, 0xFF9CAABD, false);
    }
    public void openSettings(net.minecraft.client.gui.screens.Screen parent) {
        Minecraft.getInstance().setScreen(new net.minecraft.client.gui.screens.Screen(Component.literal("Cirrus Status Settings")) {
            protected void init() {
                var cfg = CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());
                var button = net.minecraft.client.gui.components.Button.builder(Component.literal("Position: " + cfg.getString("hud.anchor.local_status", "TOP_LEFT").replace('_',' ')), b -> {
                    String next = cfg.getString("hud.anchor.local_status", "TOP_LEFT").equals("TOP_LEFT") ? "TOP_RIGHT" : "TOP_LEFT";
                    cfg.put("hud.anchor.local_status", next); b.setMessage(Component.literal("Position: " + next.replace('_',' ')));
                }).bounds(width/2-90,height/2-10,180,20).build(); addRenderableWidget(button);
                addRenderableWidget(net.minecraft.client.gui.components.Button.builder(Component.literal("Back"), b -> Minecraft.getInstance().setScreen(parent)).bounds(width/2-90,height/2+20,180,20).build());
            }
            public void render(GuiGraphics g,int x,int y,float d) { renderBackground(g,x,y,d); g.drawCenteredString(font,title,width/2,height/2-42,0xFFF2F6FC); super.render(g,x,y,d); }
            public void onClose() { Minecraft.getInstance().setScreen(parent); }
        });
    }
}
