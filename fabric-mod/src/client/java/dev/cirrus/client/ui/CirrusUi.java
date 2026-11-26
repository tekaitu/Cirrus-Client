package dev.cirrus.client.ui;

import dev.cirrus.client.render.McCanvas;
import dev.cirrus.core.theme.Brand;
import dev.cirrus.core.theme.CirrusTheme;
import dev.cirrus.client.asset.CirrusAssetTextures;
import dev.cirrus.client.render.McTextMetrics;
import dev.cirrus.core.text.TextFit;
import dev.cirrus.core.text.TextStyle;
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
    public static final int LINE = dev.cirrus.core.text.TextFit.LINE;
    /** The Inter glyphs sit about one GUI pixel high in the 9px line box; body and small text are nudged down to centre optically. */
    public static final int NUDGE = 1;
    private CirrusUi() { }

    // ---- surfaces -------------------------------------------------------------------------------------------------

    public static void backdrop(GuiGraphics g, int width, int height, CirrusTheme t) {
        McCanvas.of(g).fill(0, 0, width, height, t.overlay);
    }

    public static void dashboardBackdrop(GuiGraphics g, int width, int height, CirrusTheme t) {
        backdrop(g, width, height, t);
    }

    /** Glass panel: soft shadow, translucent body, top sheen and a hairline border. */
    public static void panel(GuiGraphics g, int x, int y, int w, int h, int radius, CirrusTheme t) {
        if (w <= 0 || h <= 0) return;
        Gfx.fillRound(g, x, y, w, h, radius, t.panel);
        Gfx.strokeRound(g, x, y, w, h, radius, 0.5f, t.border);
    }

    /** A small floating surface (context menu, popover, tooltip): near-opaque so text stays readable over the game. */
    public static void popup(GuiGraphics g, int x, int y, int w, int h, int radius, CirrusTheme t) {
        if (w <= 0 || h <= 0) return;
        Gfx.fillRound(g, x, y, w, h, radius, t.popup);
        Gfx.strokeRound(g, x, y, w, h, radius, 0.5f, t.border);
    }

    /** Light-weight surface for always-on HUD elements: no shadow stack, so it stays cheap every frame. */
    public static void hudPanel(GuiGraphics g, int x, int y, int w, int h, int radius, CirrusTheme t) {
        Gfx.fillRound(g, x, y, w, h, radius, Gfx.mix(t.panel, 0xFF000000, 0.15f));
    }

    /** A flatter inset surface used inside panels (cards, fields, chips). */
    public static void card(GuiGraphics g, float x, float y, float w, float h, float radius, int fill, int border) {
        Gfx.fillRound(g, x, y, w, h, radius, fill);
        if (border != 0) Gfx.strokeRound(g, x, y, w, h, radius, 0.5f, border);
    }

    public static void section(GuiGraphics g, int x, int y, int w, String label, CirrusTheme t) {
        headingText(g, Minecraft.getInstance().font, label, x, y, t.text);
        McCanvas.of(g).fill(x, y + 13, x + w, y + 14, t.border);
    }

    /** Toggle switch with an animated knob (progress 0..1). */
    public static void toggle(GuiGraphics g, int x, int y, boolean on, float progress, CirrusTheme t) {
        int w = 24, h = 12;
        Gfx.fillRound(g, x, y, w, h, h / 2f, Gfx.mix(0x45FFFFFF, t.accent, progress));
        float kx = x + 2 + (w - h) * progress;
        Gfx.fillRound(g, kx, y + 2, h - 4, h - 4, (h - 4) / 2f, Gfx.mix(0xFFD0D3D8, 0xFFFFFFFF, progress));
    }

    public static void scrollbar(GuiGraphics g, int x, int y, int h, float offset, float visible, CirrusTheme t) {
        if (visible >= 1f) return;
        Gfx.fillRound(g, x, y, 3, h, 1.5f, Gfx.scaleAlpha(t.border, 0.6f));
        float thumb = Math.max(14f, h * visible);
        Gfx.fillRound(g, x, y + (h - thumb) * offset, 3, thumb, 1.5f, t.accent);
    }

    /** "Tune" glyph (three sliders) used for settings buttons; the icon sheet has no cog. */
    public static void sliders(GuiGraphics g, int x, int y, int size, int color) {
        float lineH = Math.max(1f, size / 10f), knob = Math.max(3f, size / 4f);
        float[] ys = {size * 0.18f, size * 0.5f, size * 0.82f};
        float[] ks = {0.65f, 0.3f, 0.55f};
        for (int i = 0; i < 3; i++) {
            Gfx.fillRound(g, x, y + ys[i] - lineH / 2, size, lineH, lineH / 2, Gfx.scaleAlpha(color, 0.75f));
            Gfx.fillRound(g, x + (size - knob) * ks[i], y + ys[i] - knob / 2, knob, knob, knob / 2, color);
        }
    }

    // ---- typography -----------------------------------------------------------------------------------------------

    // With the Minecraft font chosen on the Appearance page, text is plain (default font); measuring uses the same call, so layouts adapt.
    public static Component body(String value) { return Look.MINECRAFT_FONT ? Component.literal(value) : Component.literal(value).withStyle(s -> s.withFont(UI_FONT_DESC)); }
    public static Component small(String value) { return Look.MINECRAFT_FONT ? Component.literal(value) : Component.literal(value).withStyle(s -> s.withFont(UI_SMALL_DESC)); }
    public static Component heading(String value) { return Look.MINECRAFT_FONT ? Component.literal(value) : Component.literal(value).withStyle(s -> s.withFont(UI_DISPLAY_DESC)); }
    /** Plain white text follows the Appearance text colour; every other colour is left alone. */
    private static int tc(int color) { return color == 0xFFFFFFFF ? Look.TEXT : color; }
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
    /** Word-wraps text to maxWidth in the small style; at most maxLines lines, the last one ellipsised if the text does not fit. */
    public static java.util.List<String> wrapSmall(Font f, String value, int maxWidth, int maxLines) {
        return TextFit.wrap(McTextMetrics.INSTANCE, value, maxWidth, maxLines, TextStyle.SMALL);
    }
    public static String fitBody(Font f, String v, int w) { return TextFit.fit(McTextMetrics.INSTANCE, v, w, TextStyle.BODY); }
    public static String fitSmall(Font f, String v, int w) { return TextFit.fit(McTextMetrics.INSTANCE, v, w, TextStyle.SMALL); }

    // Text is drawn by the Canvas (McCanvas owns the font calls); these keep the original static API for existing screens.
    public static void text(GuiGraphics g, Font f, String value, int x, int y, int color, boolean shadow) { McCanvas.of(g).text(value, TextStyle.BODY, x, y, tc(color), shadow); }
    public static void smallText(GuiGraphics g, Font f, String value, int x, int y, int color, boolean shadow) { McCanvas.of(g).text(value, TextStyle.SMALL, x, y, tc(color), shadow); }
    public static void headingText(GuiGraphics g, Font f, String value, int x, int y, int color) { McCanvas.of(g).text(value, TextStyle.HEADING, x, y, color, false); }
    public static void centered(GuiGraphics g, Font f, String value, int x, int y, int color) { McCanvas.of(g).text(value, TextStyle.BODY, x - bodyWidth(f, value) / 2, y, tc(color), false); }
    public static void centeredSmall(GuiGraphics g, Font f, String value, int x, int y, int color) { McCanvas.of(g).text(value, TextStyle.SMALL, x - smallWidth(f, value) / 2, y, tc(color), false); }
    public static void centeredHeading(GuiGraphics g, Font f, String value, int x, int y, int color) { McCanvas.of(g).text(value, TextStyle.HEADING, x - headingWidth(f, value) / 2, y, color, false); }
    /** Draws short text centred on (cx, cy) in the largest of heading/body/small that fits maxW (monograms in small tiles). */
    public static void centeredFit(GuiGraphics g, Font f, String value, int cx, int cy, int maxW, int color) {
        if (headingWidth(f, value) <= maxW) centeredHeading(g, f, value, cx, cy - LINE / 2, color);
        else if (bodyWidth(f, value) <= maxW) centered(g, f, value, cx, cy - LINE / 2, color);
        else centeredSmall(g, f, value, cx, cy - LINE / 2, color);
    }
    public static void rightSmall(GuiGraphics g, Font f, String value, int right, int y, int color) { McCanvas.of(g).text(value, TextStyle.SMALL, right - smallWidth(f, value), y, tc(color), false); }

    // ---- icons and brand ------------------------------------------------------------------------------------------

    public static void icon(GuiGraphics g, int x, int y, int size, int kind, int color) { CirrusAssetTextures.drawIcon(g, x, y, Math.max(8, size), kind, color); }
    public static void emptyLibrary(GuiGraphics g, int x, int y, int width, int height) { CirrusAssetTextures.drawEmptyLibrary(g, x, y, width, height); }
    public static void loadingFrame(GuiGraphics g, int x, int y, int size, long frame) { CirrusAssetTextures.drawLoadingFrame(g, x, y, size, frame); }

    /** Width of the brand lockup (mark plus wordmark). */
    public static int brandWidth(Font f, int markSize) {
        int markWidth = Brand.markWidth(markSize);
        return markWidth + 8 + headingWidth(f, Brand.NAME);
    }

    /** Just the leaf mark, for narrow rails. */
    public static void mark(GuiGraphics g, int x, int y, int size, CirrusTheme t) {
        CirrusAssetTextures.drawMark(g, x, y, Brand.markWidth(size), size, markColor(t));
    }

    /** The mark art is white; on light themes it is tinted with the accent so it stays visible. */
    private static int markColor(CirrusTheme t) { return 0xFFFFFFFF; }

    public static void brand(GuiGraphics g, int x, int y, int markSize, CirrusTheme t) {
        int markWidth = Brand.markWidth(markSize);
        CirrusAssetTextures.drawMark(g, x, y, markWidth, markSize, markColor(t));
        headingText(g, Minecraft.getInstance().font, Brand.NAME, x + markWidth + 8, y + (markSize - LINE) / 2, t.text);
    }

    // ---- compatibility wrappers (older call sites) ----------------------------------------------------------------

    public static void rounded(GuiGraphics g, int x, int y, int w, int h, int radius, int color) { Gfx.fillRound(g, x, y, w, h, radius, color); }
    public static void outline(GuiGraphics g, int x, int y, int w, int h, int radius, int color) { Gfx.strokeRound(g, x, y, w, h, radius, 0.5f, color); }
}
