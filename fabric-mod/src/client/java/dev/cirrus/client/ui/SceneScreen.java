package dev.cirrus.client.ui;

import dev.cirrus.client.render.McCanvas;
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
        McCanvas.of(g).fill(0, 0, width, height, 0xFF000000);
    }
}
