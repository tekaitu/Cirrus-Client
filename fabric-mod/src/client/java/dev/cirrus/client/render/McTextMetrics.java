package dev.cirrus.client.render;

import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.core.text.TextFit;
import dev.cirrus.core.text.TextMetrics;
import dev.cirrus.core.text.TextStyle;
import net.minecraft.client.Minecraft;

/** {@link TextMetrics} for Minecraft 1.21.11, measuring with the game's font renderer and the Cirrus Inter font styles. */
public final class McTextMetrics implements TextMetrics {
    public static final McTextMetrics INSTANCE = new McTextMetrics();
    private McTextMetrics() { }

    @Override public int width(String text, TextStyle style) {
        var font = Minecraft.getInstance().font;
        switch (style) {
            case SMALL: return CirrusUi.smallWidth(font, text);
            case HEADING: return CirrusUi.headingWidth(font, text);
            default: return CirrusUi.bodyWidth(font, text);
        }
    }

    @Override public int lineHeight(TextStyle style) { return TextFit.LINE; }
}
