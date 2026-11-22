package dev.cirrus.client.render;

import dev.cirrus.core.input.InputState;
import dev.cirrus.core.input.MouseButtons;
import net.minecraft.client.Minecraft;

/**
 * {@link InputState} for Minecraft 1.21.11. Only the left button is polled for now (the one API verified to exist in this
 * version); other buttons report not-pressed until the adapter grows a verified source for them.
 */
public final class McInput implements InputState {
    public static final McInput INSTANCE = new McInput();
    private McInput() { }

    @Override public boolean isMouseDown(int button) {
        return button == MouseButtons.LEFT && Minecraft.getInstance().mouseHandler.isLeftPressed();
    }
}
