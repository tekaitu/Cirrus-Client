package dev.cirrus.client.ui;

import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.network.chat.Component;

/**
 * Text input that keeps the game's {@link EditBox} behaviour (typing, selection, clipboard, cursor keys, narration) but draws
 * itself in the Cirrus typeface: the Inter font, a hint when empty, a blinking cursor and a selection highlight. The frame
 * around the field is drawn by the screen, so it is created unbordered.
 */
public final class CirrusTextField extends EditBox {
    private final String hint;

    public CirrusTextField(Font font, int x, int y, int w, int h, Component narration, String hint) {
        super(font, x, y, w, h, narration);
        this.hint = hint;
        setBordered(false);
    }

    @Override public void renderWidget(GuiGraphics g, int mouseX, int mouseY, float delta) {
        Font font = net.minecraft.client.Minecraft.getInstance().font;
        String value = getValue();
        int x = getX(), y = getY() + (getHeight() - CirrusUi.LINE) / 2, w = getWidth();
        CirrusTheme t = CirrusTheme.DARK;
        if (value.isEmpty()) {
            if (!isFocused()) CirrusUi.text(g, font, hint, x, y, Gfx.scaleAlpha(t.muted, 0.65f), false);
        }
        int cursor = Math.max(0, Math.min(value.length(), getCursorPosition()));
        // keep the cursor inside the visible width by dropping characters from the left
        int start = 0;
        while (start < cursor && CirrusUi.bodyWidth(font, value.substring(start, cursor)) > w - 6) start++;
        int end = value.length();
        while (end > cursor && CirrusUi.bodyWidth(font, value.substring(start, end)) > w - 2) end--;
        String shown = value.substring(start, end);

        String selected = getHighlighted();
        if (isFocused() && selected != null && !selected.isEmpty()) {
            int from = value.startsWith(selected, cursor) ? cursor : Math.max(0, cursor - selected.length());
            int a = Math.max(start, from), b = Math.min(end, from + selected.length());
            if (b > a) {
                int hx0 = x + CirrusUi.bodyWidth(font, value.substring(start, a)), hx1 = x + CirrusUi.bodyWidth(font, value.substring(start, b));
                g.fill(hx0, y - 1, hx1, y + CirrusUi.LINE, Gfx.withAlpha(t.cyan, 90));
            }
        }
        CirrusUi.text(g, font, shown, x, y, t.text, false);
        if (isFocused() && (System.currentTimeMillis() / 530) % 2 == 0) {
            int cx = x + CirrusUi.bodyWidth(font, value.substring(start, cursor));
            g.fill(cx, y - 1, cx + 1, y + CirrusUi.LINE, t.cyan);
        }
    }
}
