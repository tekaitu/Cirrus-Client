package dev.cirrus.client.ui;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/**
 * Base for Cirrus menu screens that sit on real Minecraft scenery: the game's own panorama (the same cube map the vanilla title
 * screen uses) under a restrained dark-navy overlay, or the live world when a world is loaded. No blur, no glow. The backdrop is
 * drawn only in {@link #renderBackground}, which the game calls exactly once per frame.
 */
public abstract class SceneScreen extends Screen {
    protected SceneScreen(Component title) { super(title); }

    @Override public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float delta) {
        if (minecraft.level == null) renderPanorama(g, delta);
        g.fill(0, 0, width, height, 0x9A050A14);                                           // keeps text readable on any scenery
        g.fillGradient(0, 0, width, Math.max(1, height / 4), 0x66000000, 0x00000000);       // soft vignette top and bottom
        g.fillGradient(0, height * 3 / 5, width, height, 0x00000000, 0x99000000);
    }
}
