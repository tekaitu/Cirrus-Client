package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;

/** Theme-aware button with animated hover/press, optional icon, measured and clipped label. */
public final class CirrusButton extends Button {
    public enum Style { SECONDARY, PRIMARY, NAV, ICON }

    private final Style style;
    private final int iconKind;
    private float hover, press;
    private final Anim.Clock clock = new Anim.Clock();

    private CirrusButton(int x, int y, int w, int h, Component text, OnPress action, int iconKind, Style style) {
        super(x, y, w, h, text, action, DEFAULT_NARRATION);
        this.iconKind = iconKind;
        this.style = style;
    }

    public static CirrusButton of(int x, int y, int w, int h, Component text, OnPress action) { return new CirrusButton(x, y, w, h, text, action, -1, Style.SECONDARY); }
    public static CirrusButton primary(int x, int y, int w, int h, Component text, OnPress action) { return new CirrusButton(x, y, w, h, text, action, -1, Style.PRIMARY); }
    public static CirrusButton nav(int x, int y, int w, int h, Component text, int iconKind, OnPress action) { return new CirrusButton(x, y, w, h, text, action, iconKind, Style.NAV); }
    public static CirrusButton icon(int x, int y, int size, int iconKind, OnPress action) { return new CirrusButton(x, y, size, size, Component.empty(), action, iconKind, Style.ICON); }

    @Override protected void renderContents(GuiGraphics g, int mouseX, int mouseY, float delta) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(CirrusConfig.get(mc.gameDirectory.toPath()));
        float dt = clock.tick();
        hover = Anim.approach(hover, isHoveredOrFocused() && active ? 1f : 0f, dt, 18f);
        press = Anim.approach(press, isHovered() && active && mc.mouseHandler.isLeftPressed() ? 1f : 0f, dt, 30f);

        int x = getX(), y = getY(), w = getWidth(), h = getHeight();
        float radius = Math.min(8f, h / 2f);
        boolean primary = style == Style.PRIMARY;
        int base = primary ? Gfx.mix(t.accent, t.panel, 0.15f) : Gfx.mix(t.surface, t.panel, 0.4f);
        int lit = primary ? Gfx.mix(t.accent, t.cyan, 0.35f) : Gfx.mix(t.surface, t.accent, 0.45f);
        int fill = Gfx.mix(Gfx.mix(base, lit, hover), 0xFF000000, press * 0.18f);
        int edge = Gfx.mix(t.border, t.cyan, hover);
        if (!active) { fill = Gfx.scaleAlpha(fill, 0.55f); edge = Gfx.scaleAlpha(edge, 0.55f); }

        Gfx.fillRound(g, x, y + 1, w, h, radius, Gfx.scaleAlpha(t.shadow, 0.35f + 0.3f * hover));
        Gfx.fillRound(g, x, y, w, h, radius, fill);
        if (w > radius * 2) Gfx.hairline(g, x + radius, y + 1, w - radius * 2, Gfx.scaleAlpha(t.highlight, 2.2f));
        Gfx.strokeRound(g, x, y, w, h, radius, 0.5f, edge);
        if (isFocused()) Gfx.strokeRound(g, x - 1, y - 1, w + 2, h + 2, radius + 1, 1f, t.cyan);

        Font font = mc.font;
        int textColor = !active ? t.muted : Gfx.mix(t.text, 0xFFFFFFFF, hover * 0.4f);
        int iconColor = !active ? t.muted : (hover > 0.5f || primary ? t.cyan : t.muted);
        int ty = y + (h - CirrusUi.LINE) / 2;
        String label = getMessage().getString();
        int pad = w < 90 ? 6 : 8;
        if (style == Style.ICON || (iconKind >= 0 && label.isEmpty())) {
            int is = Math.min(16, h - 4);
            CirrusUi.icon(g, x + (w - is) / 2, y + (h - is) / 2, is, iconKind, iconColor);
        } else if (style == Style.NAV && iconKind >= 0) {
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
