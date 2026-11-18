package dev.cirrus.client.ui;

import dev.cirrus.client.asset.CirrusAssetTextures;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.locale.Language;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.FontDescription;
import net.minecraft.resources.Identifier;
import net.minecraft.util.FormattedCharSequence;

/** Shared Cirrus surfaces, typography and brand drawing. Everything is drawn once, back to front, by the owning screen. */
public final class CirrusUi {
    private static final Identifier UI_FONT = Identifier.fromNamespaceAndPath("cirrus_fabric", "ui");
    private static final Identifier UI_SMALL = Identifier.fromNamespaceAndPath("cirrus_fabric", "ui_small");
    private static final Identifier UI_DISPLAY = Identifier.fromNamespaceAndPath("cirrus_fabric", "ui_display");
    private static final FontDescription UI_FONT_DESC = new FontDescription.Resource(UI_FONT);
    private static final FontDescription UI_SMALL_DESC = new FontDescription.Resource(UI_SMALL);
    private static final FontDescription UI_DISPLAY_DESC = new FontDescription.Resource(UI_DISPLAY);
    public static final int ICON_DASHBOARD = 0, ICON_LIBRARY = 1, ICON_MODS = 2, ICON_THEMES = 3, ICON_SEARCH = 4, ICON_FAVORITE = 5,
        ICON_HUD = 6, ICON_PVP = 7, ICON_VISUALS = 8, ICON_PERFORMANCE = 9, ICON_UTILITY = 10, ICON_SETTINGS = 11,
        ICON_SINGLEPLAYER = 12, ICON_MULTIPLAYER = 13, ICON_BACK = 14, ICON_CLOSE = 15;
    /** Nominal line box of the UI fonts in GUI units. */
    public static final int LINE = 9;
    /** The Inter glyphs sit about one GUI pixel high in the 9px line box; body and small text are nudged down to centre optically. */
    private static final int NUDGE = 1;
    private CirrusUi() { }

    // ---- surfaces -------------------------------------------------------------------------------------------------

    public static void backdrop(GuiGraphics g, int width, int height, CirrusTheme t) {
        CirrusAssetTextures.drawBackdrop(g, width, height);
        g.fill(0, 0, width, height, t.overlay);
        g.fillGradient(0, 0, width, Math.max(1, height / 3), t.highlight, 0x00000000);
        g.fillGradient(0, height * 2 / 3, width, height, 0x00000000, t.shadow);
    }

    public static void dashboardBackdrop(GuiGraphics g, int width, int height, CirrusTheme t) {
        backdrop(g, width, height, t);
        CirrusAssetTextures.drawDashboardAmbient(g, width, height);
    }

    /** Glass panel: soft shadow, translucent body, top sheen and a hairline border. */
    public static void panel(GuiGraphics g, int x, int y, int w, int h, int radius, CirrusTheme t) {
        if (w <= 0 || h <= 0) return;
        Gfx.shadow(g, x, y, w, h, radius, 6, t.shadow);
        Gfx.fillRound(g, x, y, w, h, radius, t.panel);
        int sheen = Math.max(0, Math.min(h / 3, 26));
        if (sheen > 2 && w > radius * 2) g.fillGradient(x + radius, y + 1, x + w - radius, y + 1 + sheen, t.highlight, 0x00000000);
        Gfx.strokeRound(g, x, y, w, h, radius, 0.5f, t.border);
    }

    /** A flatter inset surface used inside panels (cards, fields, chips). */
    public static void card(GuiGraphics g, float x, float y, float w, float h, float radius, int fill, int border) {
        Gfx.fillRound(g, x, y, w, h, radius, fill);
        if (border != 0) Gfx.strokeRound(g, x, y, w, h, radius, 0.5f, border);
    }

    public static void section(GuiGraphics g, int x, int y, int w, String label, CirrusTheme t) {
        headingText(g, Minecraft.getInstance().font, label, x, y, t.text);
        g.fill(x, y + 13, x + w, y + 14, t.border);
    }

    /** Toggle switch with an animated knob (progress 0..1). */
    public static void toggle(GuiGraphics g, int x, int y, boolean on, float progress, CirrusTheme t) {
        int w = 24, h = 12;
        Gfx.fillRound(g, x, y, w, h, h / 2f, Gfx.mix(t.surface, t.accent, progress));
        Gfx.strokeRound(g, x, y, w, h, h / 2f, 0.5f, Gfx.mix(t.border, t.cyan, progress));
        float kx = x + 2 + (w - h) * progress;
        Gfx.fillRound(g, kx, y + 2, h - 4, h - 4, (h - 4) / 2f, Gfx.mix(t.muted, 0xFFFFFFFF, progress));
    }

    public static void scrollbar(GuiGraphics g, int x, int y, int h, float offset, float visible, CirrusTheme t) {
        if (visible >= 1f) return;
        Gfx.fillRound(g, x, y, 3, h, 1.5f, Gfx.scaleAlpha(t.border, 0.6f));
        float thumb = Math.max(14f, h * visible);
        Gfx.fillRound(g, x, y + (h - thumb) * offset, 3, thumb, 1.5f, t.accent);
    }

    // ---- typography -----------------------------------------------------------------------------------------------

    public static Component body(String value) { return Component.literal(value).withStyle(s -> s.withFont(UI_FONT_DESC)); }
    public static Component small(String value) { return Component.literal(value).withStyle(s -> s.withFont(UI_SMALL_DESC)); }
    public static Component heading(String value) { return Component.literal(value).withStyle(s -> s.withFont(UI_DISPLAY_DESC)); }
    public static FormattedCharSequence formatSearch(String value) { return Language.getInstance().getVisualOrder(body(value)); }

    public static int bodyWidth(Font f, String v) { return f.width(body(v)); }
    public static int smallWidth(Font f, String v) { return f.width(small(v)); }
    public static int headingWidth(Font f, String v) { return f.width(heading(v)); }

    /** Trims a string with an ellipsis so it never exceeds maxWidth in the given style. */
    public static String fit(Font f, String value, int maxWidth, java.util.function.Function<String, Component> style) {
        if (maxWidth <= 0) return "";
        if (f.width(style.apply(value)) <= maxWidth) return value;
        String s = value;
        while (s.length() > 1 && f.width(style.apply(s + "…")) > maxWidth) s = s.substring(0, s.length() - 1);
        return s + "…";
    }
    public static String fitBody(Font f, String v, int w) { return fit(f, v, w, CirrusUi::body); }
    public static String fitSmall(Font f, String v, int w) { return fit(f, v, w, CirrusUi::small); }

    public static void text(GuiGraphics g, Font f, String value, int x, int y, int color, boolean shadow) { g.drawString(f, body(value), x, y + NUDGE, color, shadow); }
    public static void smallText(GuiGraphics g, Font f, String value, int x, int y, int color, boolean shadow) { g.drawString(f, small(value), x, y + NUDGE, color, shadow); }
    public static void headingText(GuiGraphics g, Font f, String value, int x, int y, int color) { g.drawString(f, heading(value), x, y, color, false); }
    public static void centered(GuiGraphics g, Font f, String value, int x, int y, int color) { g.drawCenteredString(f, body(value), x, y + NUDGE, color); }
    public static void centeredSmall(GuiGraphics g, Font f, String value, int x, int y, int color) { g.drawCenteredString(f, small(value), x, y + NUDGE, color); }
    public static void centeredHeading(GuiGraphics g, Font f, String value, int x, int y, int color) { g.drawCenteredString(f, heading(value), x, y, color); }
    public static void rightSmall(GuiGraphics g, Font f, String value, int right, int y, int color) { g.drawString(f, small(value), right - smallWidth(f, value), y + NUDGE, color, false); }

    // ---- icons and brand ------------------------------------------------------------------------------------------

    public static void icon(GuiGraphics g, int x, int y, int size, int kind, int color) { CirrusAssetTextures.drawIcon(g, x, y, Math.max(8, size), kind, color); }
    public static void emptyLibrary(GuiGraphics g, int x, int y, int width, int height) { CirrusAssetTextures.drawEmptyLibrary(g, x, y, width, height); }
    public static void loadingFrame(GuiGraphics g, int x, int y, int size, long frame) { CirrusAssetTextures.drawLoadingFrame(g, x, y, size, frame); }

    /** Width of the brand lockup (mark plus wordmark). */
    public static int brandWidth(Font f, int markSize) {
        int markWidth = Math.max(1, (markSize * 640 + 236) / 473);
        return markWidth + 8 + headingWidth(f, "Cirrus Client");
    }

    /** Just the cloud mark, for narrow rails. */
    public static void mark(GuiGraphics g, int x, int y, int size) {
        CirrusAssetTextures.drawMark(g, x, y, Math.max(1, (size * 640 + 236) / 473), size);
    }

    public static void brand(GuiGraphics g, int x, int y, int markSize, CirrusTheme t) {
        int markWidth = Math.max(1, (markSize * 640 + 236) / 473);
        CirrusAssetTextures.drawMark(g, x, y, markWidth, markSize);
        headingText(g, Minecraft.getInstance().font, "Cirrus Client", x + markWidth + 8, y + (markSize - LINE) / 2, t.text);
    }

    // ---- compatibility wrappers (older call sites) ----------------------------------------------------------------

    public static void rounded(GuiGraphics g, int x, int y, int w, int h, int radius, int color) { Gfx.fillRound(g, x, y, w, h, radius, color); }
    public static void outline(GuiGraphics g, int x, int y, int w, int h, int radius, int color) { Gfx.strokeRound(g, x, y, w, h, radius, 0.5f, color); }
}
