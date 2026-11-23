package dev.cirrus.client;


import dev.cirrus.core.input.Keys;
import dev.cirrus.core.module.CirrusMod;
import dev.cirrus.core.hud.HudElement;
import dev.cirrus.core.settings.ModSettings;
import dev.cirrus.core.settings.Setting;
import dev.cirrus.client.ui.CirrusButton;
import dev.cirrus.client.ui.CirrusScreen;
import dev.cirrus.core.theme.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Gfx;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * The settings page of one feature: its own options (toggles, choices, sliders), a live preview for HUD elements, and
 * Edit position / Reset. Options whose dependency is not met are shown disabled. Fully usable with the keyboard
 * (Up/Down select, Left/Right or Enter change).
 */
public final class ModSettingsScreen extends CirrusScreen {
    private static final int HEADER_H = 16, ROW_H = 24, PREVIEW_W = 150;

    private record Row(String header, Setting setting) { }

    private final CirrusMod mod;
    private final List<Setting> settings;
    private final List<Row> rows = new ArrayList<>();
    private int px, py, pw, ph, listX, listTop, listBottom, listRight, previewX, previewY, previewH;
    private boolean wide;
    private int scroll, selected = -1;
    private Setting dragging;

    public ModSettingsScreen(Screen parent, CirrusMod mod) {
        super(Component.literal(mod.name() + " settings"), parent);
        this.mod = mod;
        this.settings = mod.settings();
        String group = null;
        for (Setting s : settings) {
            if (!s.group().equals(group)) { group = s.group(); rows.add(new Row(group, null)); }
            rows.add(new Row(null, s));
        }
        for (int i = 0; i < rows.size(); i++) if (rows.get(i).setting() != null) { selected = i; break; }
    }

    @Override protected void init() {
        pw = Math.min(width - 16, 500);
        ph = Math.min(height - 16, 320);
        px = (width - pw) / 2;
        py = (height - ph) / 2;
        listX = px + 18;
        previewX = px + pw - 18 - PREVIEW_W;
        previewY = py + 56;
        int buttonsTop = py + ph - 18 - 20 * 3 - 8;
        previewH = Math.min(120, buttonsTop - 16 - previewY);
        wide = pw >= 400 && mod instanceof HudElement && previewH >= 40;
        listRight = wide ? previewX - 14 : px + pw - 18;
        listTop = py + 56;
        int btnH = 20;
        if (wide) {
            int bx = previewX;
            int y = py + ph - 18 - btnH;
            addRenderableWidget(CirrusButton.primary(bx, y, PREVIEW_W, btnH, Component.literal("Back"), b -> onClose()));
            addRenderableWidget(CirrusButton.of(bx, y - btnH - 4, PREVIEW_W, btnH, Component.literal("Reset to defaults"), b -> reset()));
            addRenderableWidget(CirrusButton.of(bx, y - (btnH + 4) * 2, PREVIEW_W, btnH, Component.literal("Edit position"), b -> minecraft.setScreen(new HudEditorScreen(this, mod.id()))));
            listBottom = py + ph - 18;
        } else {
            int y = py + ph - 14 - btnH;
            boolean hud = mod instanceof HudElement;
            int n = hud ? 3 : 2, gap = 4, w = (pw - 36 - gap * (n - 1)) / n, x = px + 18;
            if (hud) { addRenderableWidget(CirrusButton.of(x, y, w, btnH, Component.literal("Position"), b -> minecraft.setScreen(new HudEditorScreen(this, mod.id())))); x += w + gap; }
            addRenderableWidget(CirrusButton.of(x, y, w, btnH, Component.literal("Reset"), b -> reset())); x += w + gap;
            addRenderableWidget(CirrusButton.primary(x, y, w, btnH, Component.literal("Back"), b -> onClose()));
            listBottom = y - 8;
        }
        scroll = Math.max(0, Math.min(scroll, maxScroll()));
    }

    private void reset() { ModSettings.reset(config(), mod.id(), settings); }

    private int rowHeight(Row r) { return r.setting() == null ? HEADER_H : ROW_H; }
    private int contentHeight() { int h = 0; for (Row r : rows) h += rowHeight(r); return h; }
    private int maxScroll() { return Math.max(0, contentHeight() - (listBottom - 14 - listTop)); }
    private int rowTop(int index) { int y = listTop - scroll; for (int i = 0; i < index; i++) y += rowHeight(rows.get(i)); return y; }
    private int viewBottom() { return listBottom - 14; }

    private String value(Setting s) { return ModSettings.get(config(), mod.id(), settings, s.key()); }
    private boolean active(Setting s) { return ModSettings.active(config(), mod.id(), settings, s); }
    private void set(Setting s, String v) { ModSettings.set(config(), mod.id(), s, v); }

    // ---- drawing -----------------------------------------------------------------------------------------------------

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        CirrusUi.panel(g, px, py, pw, ph, 16, t);
        CirrusUi.headingText(g, font, mod.name().toUpperCase(java.util.Locale.ROOT), px + 18, py + 16, t.cyan);
        CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, mod.description(), pw - 36), px + 18, py + 32, t.muted, false);
        g.fill(px + 18, py + 46, px + pw - 18, py + 47, t.border);

        g.enableScissor(listX - 4, listTop, listRight + 4, viewBottom());
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            int y = rowTop(i);
            if (y + rowHeight(r) < listTop || y > viewBottom()) continue;
            if (r.setting() == null) {
                CirrusUi.smallText(g, font, r.header().toUpperCase(java.util.Locale.ROOT), listX, y + 5, t.cyan, false);
            } else {
                drawRow(g, r.setting(), y, i == selected, mx, my, t);
            }
        }
        g.disableScissor();
        if (maxScroll() > 0) CirrusUi.scrollbar(g, listRight + 6, listTop, viewBottom() - listTop, scroll / (float) maxScroll(), (viewBottom() - listTop) / (float) contentHeight(), t);

        Setting hintFor = hoveredSetting(mx, my);
        if (hintFor == null && selected >= 0) hintFor = rows.get(selected).setting();
        if (hintFor != null) CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, hintFor.hint(), listRight - listX), listX, listBottom - 10, t.muted, false);
        if (wide) drawPreview(g, t);
    }

    private void drawRow(GuiGraphics g, Setting s, int y, boolean sel, int mx, int my, CirrusTheme t) {
        boolean active = active(s);
        boolean hover = mx >= listX - 4 && mx < listRight + 4 && my >= y && my < y + ROW_H && my >= listTop && my < viewBottom();
        int w = listRight - listX + 8;
        if (sel || hover) Gfx.fillRound(g, listX - 4, y + 1, w, ROW_H - 2, 6, Gfx.scaleAlpha(t.surface, sel ? 1f : 0.6f));
        if (sel) Gfx.strokeRound(g, listX - 4, y + 1, w, ROW_H - 2, 6, 0.5f, t.cyan);
        int textColor = active ? t.text : Gfx.scaleAlpha(t.muted, 0.6f);
        CirrusUi.text(g, font, CirrusUi.fitBody(font, s.label(), listRight - listX - 110), listX + 2, y + (ROW_H - CirrusUi.LINE) / 2, textColor, false);
        String v = value(s);
        int cy = y + ROW_H / 2;
        switch (s.kind()) {
            case TOGGLE -> {
                boolean on = v.equals("true");
                CirrusUi.toggle(g, listRight - 24 - 2, cy - 6, on, on ? 1f : 0f, t);
                if (!active) Gfx.fillRound(g, listRight - 26, cy - 6, 24, 12, 6, Gfx.withAlpha(t.panel, 150));
            }
            case CHOICE -> {
                int pillW = 92, x = listRight - pillW - 2;
                Gfx.fillRound(g, x, cy - 9, pillW, 18, 5, active ? t.surface : Gfx.scaleAlpha(t.surface, 0.5f));
                Gfx.strokeRound(g, x, cy - 9, pillW, 18, 5, 0.5f, t.border);
                CirrusUi.centered(g, font, CirrusUi.fitBody(font, s.display(v), pillW - 8), x + pillW / 2, cy - CirrusUi.LINE / 2, textColor);
            }
            case SLIDER -> {
                int track = 70, label = 34, x = listRight - label - track - 8;
                double f = s.fraction(v);
                Gfx.fillRound(g, x, cy - 2, track, 4, 2, active ? Gfx.scaleAlpha(t.border, 0.9f) : Gfx.scaleAlpha(t.border, 0.4f));
                Gfx.fillRound(g, x, cy - 2, Math.max(3, (float) (track * f)), 4, 2, active ? t.accent : Gfx.scaleAlpha(t.accent, 0.4f));
                Gfx.fillRound(g, x + (float) (track * f) - 4, cy - 5, 8, 10, 4, active ? 0xFFFFFFFF : Gfx.scaleAlpha(0xFFFFFFFF, 0.4f));
                CirrusUi.smallText(g, font, s.display(v), listRight - CirrusUi.smallWidth(font, s.display(v)) - 2, cy - 4, textColor, false);
            }
        }
    }

    private void drawPreview(GuiGraphics g, CirrusTheme t) {
        Gfx.fillRound(g, previewX, previewY, PREVIEW_W, previewH, 8, 0xFF050505);
        g.enableScissor(previewX + 1, previewY + 1, previewX + PREVIEW_W - 1, previewY + previewH - 1);
        // A checker backdrop so a transparent or low-opacity background is visible as such.
        for (int cy = 0; cy < previewH; cy += 10) for (int cx = 0; cx < PREVIEW_W; cx += 10) {
            if (((cx / 10) + (cy / 10)) % 2 == 0) g.fill(previewX + cx, previewY + cy, previewX + cx + 10, previewY + cy + 10, 0xFF141414);
        }
        HudElement e = (HudElement) mod;
        // Shrink the preview (never the real element) when a large scale would not fit the card.
        float fit = Math.min(1f, Math.min((PREVIEW_W - 12f) / e.width(), (previewH - 12f) / e.height()));
        float cx = previewX + PREVIEW_W / 2f, cy = previewY + previewH / 2f;
        dev.cirrus.core.render.Canvas canvas = dev.cirrus.client.render.McCanvas.of(g);
        canvas.pushTransform(cx, cy, fit);
        e.render(canvas, -e.width() / 2, -e.height() / 2, 0, dev.cirrus.client.mod.ClientModContext.INSTANCE);
        canvas.popTransform();
        g.disableScissor();
        Gfx.strokeRound(g, previewX, previewY, PREVIEW_W, previewH, 8, 0.5f, t.border);
        CirrusUi.centeredSmall(g, font, "Preview", previewX + PREVIEW_W / 2, previewY + previewH + 4, t.muted);
    }

    // ---- input -------------------------------------------------------------------------------------------------------

    private int rowAt(double mx, double my) {
        if (mx < listX - 4 || mx >= listRight + 4 || my < listTop || my >= viewBottom()) return -1;
        for (int i = 0; i < rows.size(); i++) { int y = rowTop(i); if (my >= y && my < y + rowHeight(rows.get(i))) return i; }
        return -1;
    }

    private Setting hoveredSetting(int mx, int my) { int i = rowAt(mx, my); return i < 0 ? null : rows.get(i).setting(); }

    @Override protected boolean onMouseClicked(MouseButtonEvent event, boolean doubleClick) {
        if (super.onMouseClicked(event, doubleClick)) return true;
        int i = rowAt(event.x(), event.y());
        if (i < 0 || rows.get(i).setting() == null) return false;
        Setting s = rows.get(i).setting();
        selected = i;
        if (!active(s)) return true;
        if (s.kind() == Setting.Kind.SLIDER) {
            dragging = s;
            slideTo(s, event.x());
        } else {
            set(s, s.step(value(s), event.button() == 1 ? -1 : 1));
        }
        return true;
    }

    private void slideTo(Setting s, double mouseX) {
        int track = 70, label = 34, x = listRight - label - track - 8;
        set(s, s.fromFraction((mouseX - x) / track));
    }

    @Override protected boolean onMouseDragged(MouseButtonEvent event, double dx, double dy) {
        if (dragging != null) { slideTo(dragging, event.x()); return true; }
        return super.onMouseDragged(event, dx, dy);
    }

    @Override protected boolean onMouseReleased(MouseButtonEvent event) { dragging = null; return super.onMouseReleased(event); }

    @Override protected boolean onMouseScrolled(double x, double y, double h, double v) {
        if (x < listRight + 8) { scroll = Math.max(0, Math.min(maxScroll(), scroll - (int) (v * ROW_H))); return true; }
        return super.onMouseScrolled(x, y, h, v);
    }

    @Override protected boolean onKeyPressed(KeyEvent event) {
        int key = event.key();
        if (key == Keys.UP || key == Keys.DOWN) { moveSelection(key == Keys.UP ? -1 : 1); return true; }
        if (selected >= 0 && rows.get(selected).setting() != null) {
            Setting s = rows.get(selected).setting();
            if (active(s) && (key == Keys.LEFT || key == Keys.RIGHT || key == Keys.ENTER || key == Keys.SPACE)) {
                set(s, s.step(value(s), key == Keys.LEFT ? -1 : 1));
                return true;
            }
        }
        return super.onKeyPressed(event);
    }

    private void moveSelection(int dir) {
        int i = selected;
        do { i += dir; } while (i >= 0 && i < rows.size() && rows.get(i).setting() == null);
        if (i < 0 || i >= rows.size()) return;
        selected = i;
        int top = rowTop(i);
        if (top < listTop) scroll = Math.max(0, scroll - (listTop - top));
        else if (top + ROW_H > viewBottom()) scroll = Math.min(maxScroll(), scroll + (top + ROW_H - viewBottom()));
    }
}
