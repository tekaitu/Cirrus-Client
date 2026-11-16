package dev.cirrus.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.network.chat.Component;

public final class CirrusMenuScreen extends Screen {
    private static final int PANEL_WIDTH = 360;
    private final Screen parent;

    public CirrusMenuScreen(Screen parent) {
        super(Component.literal("Cirrus Client"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        int buttonWidth = 160;
        int buttonX = this.width / 2 - buttonWidth / 2;

        this.addRenderableWidget(Button.builder(
                Component.literal("Minecraft Settings"),
                button -> this.minecraft.setScreen(new OptionsScreen(this, this.minecraft.options)))
            .bounds(buttonX, this.height / 2 + 18, buttonWidth, 20)
            .build());
        this.addRenderableWidget(Button.builder(
                Component.literal("HUD Editor"), button -> this.minecraft.setScreen(new HudEditorScreen(this)))
            .bounds(buttonX, this.height / 2 + 44, buttonWidth, 20)
            .build());
        this.addRenderableWidget(Button.builder(
                Component.literal("Back"), button -> this.minecraft.setScreen(this.parent))
            .bounds(buttonX, this.height / 2 + 70, buttonWidth, 20)
            .build());
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
        this.renderBackground(graphics, mouseX, mouseY, delta);

        int left = (this.width - PANEL_WIDTH) / 2;
        int top = this.height / 2 - 100;
        graphics.fill(left, top, left + PANEL_WIDTH, top + 202, 0xE6101724);
        graphics.renderOutline(left, top, PANEL_WIDTH, 202, 0x804F83C2);
        graphics.drawCenteredString(this.font, this.title, this.width / 2, top + 18, 0xFFF2F6FC);
        graphics.drawCenteredString(this.font, "IN-GAME COMPANION", this.width / 2, top + 43, 0xFF8FB8E8);
        graphics.drawCenteredString(this.font, "This build keeps your Minecraft profile and worlds unchanged.", this.width / 2, top + 72, 0xFFD2DBE8);
        graphics.drawCenteredString(this.font, "Account sync and cosmetics are not connected yet.", this.width / 2, top + 88, 0xFF9CAABD);

        super.render(graphics, mouseX, mouseY, delta);
    }

    @Override
    public void onClose() {
        this.minecraft.setScreen(this.parent);
    }
}
