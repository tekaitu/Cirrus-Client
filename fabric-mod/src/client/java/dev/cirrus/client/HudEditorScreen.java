package dev.cirrus.client;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class HudEditorScreen extends Screen {
    private static final int PANEL_WIDTH = 360;
    private final Screen parent;

    public HudEditorScreen(Screen parent) {
        super(Component.literal("Cirrus HUD Editor"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        int buttonWidth = 220;
        int buttonX = this.width / 2 - buttonWidth / 2;

        this.addRenderableWidget(Button.builder(enabledLabel(), button -> {
                CirrusHudSettings.toggleEnabled();
                button.setMessage(enabledLabel());
            })
            .bounds(buttonX, this.height / 2 + 8, buttonWidth, 20)
            .build());
        this.addRenderableWidget(Button.builder(alignmentLabel(), button -> {
                CirrusHudSettings.toggleAlignment();
                button.setMessage(alignmentLabel());
            })
            .bounds(buttonX, this.height / 2 + 34, buttonWidth, 20)
            .build());
        this.addRenderableWidget(Button.builder(Component.literal("Back"), button -> this.minecraft.setScreen(this.parent))
            .bounds(buttonX, this.height / 2 + 66, buttonWidth, 20)
            .build());
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
        this.renderBackground(graphics, mouseX, mouseY, delta);

        int left = (this.width - PANEL_WIDTH) / 2;
        int top = this.height / 2 - 82;
        graphics.fill(left, top, left + PANEL_WIDTH, top + 178, 0xE6101724);
        graphics.renderOutline(left, top, PANEL_WIDTH, 178, 0x805B98DE);
        graphics.drawCenteredString(this.font, this.title, this.width / 2, top + 18, 0xFFF2F6FC);
        graphics.drawCenteredString(this.font, "Local to this Minecraft installation", this.width / 2, top + 48, 0xFF9CAABD);
        graphics.drawCenteredString(this.font, "Settings save automatically and do not change your account.", this.width / 2, top + 64, 0xFFD2DBE8);

        super.render(graphics, mouseX, mouseY, delta);
    }

    @Override
    public void onClose() {
        this.minecraft.setScreen(this.parent);
    }

    private static Component enabledLabel() {
        return Component.literal("Companion status: " + (CirrusHudSettings.isEnabled() ? "ON" : "OFF"));
    }

    private static Component alignmentLabel() {
        return Component.literal("Position: " + (CirrusHudSettings.isRightAligned() ? "Top-right" : "Top-left"));
    }
}
