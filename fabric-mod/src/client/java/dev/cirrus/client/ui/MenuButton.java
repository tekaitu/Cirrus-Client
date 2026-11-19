package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.network.chat.Component;

/**
 * Main-menu button family: wide list buttons (icon + centred label), the accent-filled primary button, the quiet quit
 * button and square icon tiles. Hover and press are animated; the layout owner decides every rectangle.
 */
public final class MenuButton extends Button {
    public enum Kind { LIST, PRIMARY, QUIT, SQUARE }

    private final Kind kind;
    private final int glyph;
    private float hover, press;
    private final Anim.Clock clock = new Anim.Clock();

    private MenuButton(int x, int y, int w, int h, Component label, int glyph, Kind kind, OnPress action) {
        super(x, y, w, h, label, action, DEFAULT_NARRATION);
        this.glyph = glyph;
        this.kind = kind;
    }

    public static MenuButton list(int x, int y, int w, int h, String label, int glyph, OnPress action) { return new MenuButton(x, y, w, h, Component.literal(label), glyph, Kind.LIST, action); }
    public static MenuButton primary(int x, int y, int w, int h, String label, int glyph, OnPress action) { return new MenuButton(x, y, w, h, Component.literal(label), glyph, Kind.PRIMARY, action); }
    public static MenuButton quit(int x, int y, int w, int h, String label, OnPress action) { return new MenuButton(x, y, w, h, Component.literal(label), -1, Kind.QUIT, action); }
    public static MenuButton square(int x, int y, int size, int glyph, String tooltip, OnPress action) {
        MenuButton b = new MenuButton(x, y, size, size, Component.literal(tooltip), glyph, Kind.SQUARE, action);
        b.setTooltip(Tooltip.create(Component.literal(tooltip)));
        return b;
    }

    @Override protected void renderContents(GuiGraphics g, int mouseX, int mouseY, float delta) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(CirrusConfig.get(mc.gameDirectory.toPath()));
        float dt = clock.tick();
        hover = Anim.approach(hover, isHoveredOrFocused() && active ? 1f : 0f, dt, 16f);
        press = Anim.approach(press, isHovered() && active && mc.mouseHandler.isLeftPressed() ? 1f : 0f, dt, 30f);

        int x = getX(), y = getY(), w = getWidth(), h = getHeight();
        float radius = Math.min(h * 0.24f, 8f);
        int fill, edge, text, icon;
        switch (kind) {
            case PRIMARY -> {
                fill = Gfx.mix(Gfx.mix(t.accent, t.cyan, 0.22f + 0.4f * hover), 0xFF000000, press * 0.2f);
                edge = Gfx.mix(t.cyan, 0xFFFFFFFF, 0.25f + 0.3f * hover);
                text = 0xFFFFFFFF; icon = 0xFFFFFFFF;
            }
            case QUIT -> {
                fill = Gfx.scaleAlpha(t.surface, 0.35f * hover);
                edge = Gfx.scaleAlpha(t.border, 0.5f * hover);
                text = Gfx.mix(t.muted, t.cyan, 0.45f + 0.55f * hover); icon = text;
            }
            default -> {
                int base = Gfx.mix(0xE60A0F1A, t.accent, 0.1f * hover);
                fill = Gfx.mix(base, 0xFF000000, press * 0.25f);
                edge = Gfx.mix(Gfx.scaleAlpha(t.border, 0.7f), t.cyan, hover * 0.85f);
                text = Gfx.mix(t.text, 0xFFFFFFFF, hover * 0.5f); icon = Gfx.mix(t.muted, t.cyan, hover);
            }
        }
        if (!active) { fill = Gfx.scaleAlpha(fill, 0.55f); edge = Gfx.scaleAlpha(edge, 0.55f); text = Gfx.scaleAlpha(text, 0.6f); icon = Gfx.scaleAlpha(icon, 0.6f); }

        if (kind != Kind.QUIT || hover > 0.01f) {
            Gfx.fillRound(g, x, y, w, h, radius, fill);
            if (kind != Kind.QUIT && w > radius * 2) Gfx.hairline(g, x + radius, y + 1, w - radius * 2, Gfx.scaleAlpha(t.highlight, kind == Kind.PRIMARY ? 3f : 1.6f));
            Gfx.strokeRound(g, x, y, w, h, radius, 0.5f, edge);
        }
        if (isFocused()) Gfx.strokeRound(g, x - 1, y - 1, w + 2, h + 2, radius + 1, 1f, t.cyan);

        Font font = mc.font;
        if (kind == Kind.SQUARE) {
            int s = Math.max(9, Math.round(h * 0.52f));
            Glyphs.draw(g, glyph, x + (w - s) / 2, y + (h - s) / 2, s, icon);
            return;
        }
        String label = getMessage().getString();
        int ty = y + (h - CirrusUi.LINE) / 2 + (kind == Kind.PRIMARY ? 1 : 0);
        int gs = Math.max(9, Math.round(h * 0.5f));
        int pad = Math.max(6, Math.round(h * 0.5f));
        int maxText = w - (glyph >= 0 ? pad * 2 + gs + 4 : pad * 2);
        boolean bold = kind == Kind.PRIMARY;
        String fitted = bold ? CirrusUi.fit(font, label, maxText, CirrusUi::heading) : CirrusUi.fitBody(font, label, maxText);
        int cx = x + w / 2;
        if (glyph >= 0) {
            Glyphs.draw(g, glyph, x + pad, y + (h - gs) / 2, gs, icon);
            cx = x + (w + pad + gs) / 2;
        }
        if (bold) CirrusUi.centeredHeading(g, font, fitted, cx, ty, text);
        else CirrusUi.centered(g, font, fitted, cx, ty, text);
    }
}
