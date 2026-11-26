package dev.cirrus.client.ui;

import dev.cirrus.core.theme.CirrusTheme;
import dev.cirrus.core.anim.Anim;
import dev.cirrus.core.config.CirrusConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;

/** Theme-aware button with animated hover/press, optional icon, measured and clipped label. */
public final class CirrusButton extends Button {
    public enum Style { SECONDARY, PRIMARY, NAV, ICON, TAB }

    private final Style style;
    private final int iconKind;
    private float hover, press, selectedBlend;
    private boolean selected;
    private final Anim.Clock clock = new Anim.Clock();

    private CirrusButton(int x, int y, int w, int h, Component text, OnPress action, int iconKind, Style style) {
        super(x, y, w, h, text, action, DEFAULT_NARRATION);
        this.iconKind = iconKind;
        this.style = style;
    }

    public static CirrusButton of(int x, int y, int w, int h, Component text, OnPress action) { return new CirrusButton(x, y, w, h, text, action, -1, Style.SECONDARY); }
    public static CirrusButton primary(int x, int y, int w, int h, Component text, OnPress action) { return new CirrusButton(x, y, w, h, text, action, -1, Style.PRIMARY); }
    public static CirrusButton nav(int x, int y, int w, int h, Component text, int iconKind, OnPress action) { return new CirrusButton(x, y, w, h, text, action, iconKind, Style.NAV); }
    /** Top navigation tab. Pass an empty label for an icon-only tab. */
    public static CirrusButton tab(int x, int y, int w, int h, Component text, int iconKind, boolean selected, OnPress action) {
        CirrusButton b = new CirrusButton(x, y, w, h, text, action, iconKind, Style.TAB);
        b.selected = selected;
        b.selectedBlend = selected ? 1f : 0f;
        return b;
    }
    public static CirrusButton icon(int x, int y, int size, int iconKind, OnPress action) { return new CirrusButton(x, y, size, size, Component.empty(), action, iconKind, Style.ICON); }

    @Override protected void renderContents(GuiGraphics g, int mouseX, int mouseY, float delta) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(CirrusConfig.get(mc.gameDirectory.toPath()));
        float dt = clock.tick();
        hover = Anim.approach(hover, isHoveredOrFocused() && active ? 1f : 0f, dt, 18f);
        press = Anim.approach(press, isHovered() && active && mc.mouseHandler.isLeftPressed() ? 1f : 0f, dt, 30f);

        int x = getX(), y = getY(), w = getWidth(), h = getHeight();
        float radius = Math.min(6f, h / 2f);
        selectedBlend = Anim.approach(selectedBlend, selected ? 1f : 0f, dt, 16f);
        boolean primary = style == Style.PRIMARY || selectedBlend > 0.5f;
        // Flat black. Hover lifts the fill slightly and turns the outline light orange; primary and selected buttons get an orange outline.
        int fill = Gfx.mix(Gfx.mix(0xFF000000, 0xFF1C1C1C, hover), 0xFF2C2C2C, press);
        int edge = Gfx.mix(primary ? t.accent : t.border, t.accentLight, hover);
        if (!active) { fill = 0xFF000000; edge = Gfx.scaleAlpha(t.border, 0.6f); }

        Gfx.fillRound(g, x, y, w, h, radius, fill);
        Gfx.strokeRound(g, x, y, w, h, radius, primary ? 1f : 0.5f, edge);
        if (isFocused()) Gfx.strokeRound(g, x - 1, y - 1, w + 2, h + 2, radius + 1, 1f, t.accentLight);

        Font font = mc.font;
        int textColor = active ? 0xFFFFFFFF : 0xFF7A7A7A;
        int iconColor = active ? 0xFFFFFFFF : 0xFF7A7A7A;
        int ty = y + (h - CirrusUi.LINE) / 2;
        String label = getMessage().getString();
        int pad = w < 90 ? 6 : 8;
        if (style == Style.ICON || (iconKind >= 0 && label.isEmpty())) {
            int is = Math.min(16, h - 4);
            CirrusUi.icon(g, x + (w - is) / 2, y + (h - is) / 2, is, iconKind, iconColor);
        } else if ((style == Style.NAV || style == Style.TAB) && iconKind >= 0) {
            int is = w < 90 ? 12 : Math.min(14, h - 6);
            CirrusUi.icon(g, x + pad, y + (h - is) / 2, is, iconKind, iconColor);
            String fitted = CirrusUi.fitBody(font, label, w - pad * 2 - is - 6);
            CirrusUi.text(g, font, fitted, x + pad + is + 6, ty, textColor, false);
        } else {
            String fitted = CirrusUi.fitBody(font, label, w - pad * 2);
            int tw = CirrusUi.bodyWidth(font, fitted);
            CirrusUi.text(g, font, fitted, x + (w - tw) / 2, ty, textColor, false);
        }
    }
}
