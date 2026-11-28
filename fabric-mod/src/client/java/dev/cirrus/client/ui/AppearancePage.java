package dev.cirrus.client.ui;

import dev.cirrus.core.layout.ClickGuiLayout;
import dev.cirrus.core.settings.Setting;
import dev.cirrus.core.theme.Appearance;
import dev.cirrus.core.theme.CirrusTheme;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;

/**
 * The Appearance page of the Click GUI: how the menus and widgets look (theme, accent, text colour, font, transparency, blur). Every
 * option is a setting of {@link Appearance}, so changes apply to the whole client the moment they are made, and a small live
 * preview shows the result without leaving the page.
 */
public final class AppearancePage {
    private final SettingsPanel settings = new SettingsPanel(Appearance.ID, Appearance.settings());
    private int x, y, w, h;
    private ClickGuiLayout.Rect previewRect, settingsRect, resetBtn;

    public void layout(Font font, int x, int y, int w, int h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        int pad = 8, cy = y + pad + 30;
        previewRect = null;
        boolean room = h >= 230 && w >= 240;
        if (room) { previewRect = new ClickGuiLayout.Rect(x + pad, cy, w - pad * 2, 56); cy += 62; }
        int by = y + h - pad - 20;
        resetBtn = new ClickGuiLayout.Rect(x + pad, by, w - pad * 2, 20);
        settingsRect = new ClickGuiLayout.Rect(x + pad, cy, w - pad * 2, Math.max(0, by - 6 - cy));
        settings.layout(settingsRect.x(), settingsRect.y(), settingsRect.w(), settingsRect.h(), settingsRect.w() < 230);
    }

    public boolean contains(double mx, double my) { return mx >= x && mx < x + w && my >= y && my < y + h; }

    public void render(GuiGraphics g, int mx, int my, CirrusTheme t) {
        Font font = Minecraft.getInstance().font;
        CirrusUi.card(g, x, y, w, h, 10, Look.FIELD, t.border);
        int pad = 8;
        CirrusUi.icon(g, x + pad, y + pad + 2, 16, CirrusUi.ICON_THEMES, t.accentLight);
        CirrusUi.text(g, font, "Appearance", x + pad + 24, y + pad, 0xFFFFFFFF, false);
        CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, "How the menus and widgets look. Changes apply right away.", w - pad * 2 - 24), x + pad + 24, y + pad + 12, t.muted, false);
        if (previewRect != null) drawPreview(g, font, t);
        settings.render(g, mx, my, t, true);
        boolean hover = resetBtn.contains(mx, my);
        Gfx.fillRound(g, resetBtn.x(), resetBtn.y(), resetBtn.w(), resetBtn.h(), 6, hover ? Look.SURFACE_HOVER : Look.SURFACE);
        CirrusUi.centered(g, font, "Reset appearance", resetBtn.x() + resetBtn.w() / 2, resetBtn.y() + (resetBtn.h() - CirrusUi.LINE) / 2, 0xFFFFFFFF);
    }

    /** A miniature of what the settings change: a panel with a row, a switch, a button, an accent bar and a widget. */
    private void drawPreview(GuiGraphics g, Font font, CirrusTheme t) {
        var r = previewRect;
        Gfx.fillRound(g, r.x(), r.y(), r.w(), r.h(), 8, 0xFF4F6B86);       // stands in for the game behind the menu
        Gfx.fillRound(g, r.x(), r.y(), r.w(), r.h(), 8, t.overlay);
        int px = r.x() + 6, py = r.y() + 6, pw = Math.min(190, r.w() * 60 / 100), ph = r.h() - 12;
        Gfx.fillRound(g, px, py, pw, ph, 6, t.panel);
        Gfx.fillRound(g, px + 5, py + 5, pw - 10, 16, 5, t.surface);
        CirrusUi.smallText(g, font, "Fly speed", px + 10, py + 9, 0xFFFFFFFF, false);
        CirrusUi.toggle(g, px + pw - 31, py + 7, true, 1f, t);
        Gfx.fillRound(g, px + 5, py + ph - 20, 52, 15, 5, t.accent);
        CirrusUi.centeredSmall(g, font, "Apply", px + 31, py + ph - 17, 0xFFFFFFFF);
        Gfx.fillRound(g, px + 62, py + ph - 20, pw - 67, 15, 5, t.surfaceHover);
        CirrusUi.smallText(g, font, "Cancel", px + 68, py + ph - 17, t.muted, false);
        int wx = px + pw + 12, wy = r.y() + (r.h() - 18) / 2;
        Gfx.fillRound(g, wx, wy, 52, 18, 5, Gfx.withAlpha(0xFF000000, 0xB0));
        CirrusUi.text(g, font, "(144)", wx + 8, wy + 4, 0xFFFFFFFF, true);
    }

    public String tooltip(double mx, double my) {
        if (resetBtn != null && resetBtn.contains(mx, my)) return "Put every appearance option back to the Maple defaults.";
        Setting s = settings.hovered(mx, my);
        return s == null ? null : s.hint();
    }

    public boolean mouseClicked(double mx, double my, int button) {
        if (!contains(mx, my)) return false;
        if (resetBtn.contains(mx, my)) { settings.reset(); return true; }
        if (settingsRect.contains(mx, my)) settings.mouseClicked(mx, my, button);
        return true;
    }

    public boolean mouseDragged(double mx) { return settings.mouseDragged(mx); }
    public void mouseReleased() { settings.mouseReleased(); }
    public boolean mouseScrolled(double mx, double my, double v) { return settings.mouseScrolled(mx, my, v); }
    public boolean keyPressed(int key) { return settings.keyPressed(key); }
}
