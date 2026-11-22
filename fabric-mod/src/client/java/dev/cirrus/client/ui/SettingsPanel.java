package dev.cirrus.client.ui;


import dev.cirrus.core.input.Keys;
import dev.cirrus.core.theme.CirrusTheme;
import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.client.mod.CirrusMod;
import dev.cirrus.core.settings.ModSettings;
import dev.cirrus.core.settings.Setting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;

import java.util.ArrayList;
import java.util.List;

/**
 * The scrollable list of one module's settings (toggles, choices, sliders), grouped under headers. It is a component, not a screen:
 * the Click GUI pane and the standalone settings screen both place it in a rectangle. In narrow rectangles each row stacks its
 * label above its control. Options whose dependency is not met are shown disabled.
 */
public final class SettingsPanel {
    private static final int HEADER_H = 16, ROW_WIDE = 24, ROW_STACKED = 34;

    private record Row(String header, Setting setting) { }

    private final CirrusMod mod;
    private final List<Setting> settings;
    private final List<Row> rows = new ArrayList<>();
    private int x, y, w, h, scroll, selected = -1;
    private boolean stacked;
    private Setting dragging;

    public SettingsPanel(CirrusMod mod) {
        this.mod = mod;
        this.settings = mod.settings();
        String group = null;
        for (Setting s : settings) {
            if (!s.group().equals(group)) { group = s.group(); rows.add(new Row(group, null)); }
            rows.add(new Row(null, s));
        }
        for (int i = 0; i < rows.size(); i++) if (rows.get(i).setting() != null) { selected = i; break; }
    }

    public boolean isEmpty() { return settings.isEmpty(); }
    private static Font font() { return Minecraft.getInstance().font; }
    private static CirrusConfig config() { return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath()); }

    public void layout(int x, int y, int w, int h, boolean stacked) {
        this.x = x; this.y = y; this.w = w; this.h = h; this.stacked = stacked;
        scroll = Math.max(0, Math.min(scroll, maxScroll()));
    }

    public boolean contains(double mx, double my) { return mx >= x && mx < x + w && my >= y && my < y + h; }
    private int rowH() { return stacked ? ROW_STACKED : ROW_WIDE; }
    private int rowHeight(Row r) { return r.setting() == null ? HEADER_H : rowH(); }
    private int contentHeight() { int t = 0; for (Row r : rows) t += rowHeight(r); return t; }
    private int maxScroll() { return Math.max(0, contentHeight() - h); }
    private int rowTop(int index) { int top = y - scroll; for (int i = 0; i < index; i++) top += rowHeight(rows.get(i)); return top; }
    private int right() { return x + w - (maxScroll() > 0 ? 8 : 0); }

    private String value(Setting s) { return ModSettings.get(config(), mod.id(), settings, s.key()); }
    private boolean active(Setting s) { return ModSettings.active(config(), mod.id(), settings, s); }
    private void set(Setting s, String v) { ModSettings.set(config(), mod.id(), s, v); }
    public void reset() { ModSettings.reset(config(), mod.id(), settings); }

    // ---- slider geometry (shared by drawing and input) --------------------------------------------------------------

    private int trackX() { return stacked ? x : right() - 34 - 8 - 70; }
    private int trackW() { return stacked ? Math.max(20, right() - x - 40) : 70; }

    // ---- drawing -----------------------------------------------------------------------------------------------------

    public void render(GuiGraphics g, int mx, int my, CirrusTheme t, boolean focused) {
        Font font = font();
        g.enableScissor(x - 2, y, x + w + 2, y + h);
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            int top = rowTop(i);
            if (top + rowHeight(r) < y || top > y + h) continue;
            if (r.setting() == null) CirrusUi.smallText(g, font, r.header().toUpperCase(java.util.Locale.ROOT), x + 2, top + 5, t.muted, false);
            else drawRow(g, font, r.setting(), top, focused && i == selected, mx, my, t);
        }
        g.disableScissor();
        if (maxScroll() > 0) CirrusUi.scrollbar(g, x + w - 3, y, h, scroll / (float) maxScroll(), h / (float) contentHeight(), t);
    }

    private void drawRow(GuiGraphics g, Font font, Setting s, int top, boolean sel, int mx, int my, CirrusTheme t) {
        boolean active = active(s);
        int rh = rowH(), r = right();
        boolean hover = mx >= x && mx < r && my >= top && my < top + rh && my >= y && my < y + h;
        if (sel || hover) Gfx.fillRound(g, x, top + 1, r - x, rh - 2, 6, sel ? 0xFF0D0D0D : 0xFF080808);
        if (sel) Gfx.strokeRound(g, x, top + 1, r - x, rh - 2, 6, 0.5f, 0xFFFFFFFF);
        int textColor = active ? t.text : Gfx.scaleAlpha(t.muted, 0.6f);
        String v = value(s);
        int cy = stacked ? top + rh - 10 : top + rh / 2;
        int labelY = stacked ? top + 4 : top + (rh - CirrusUi.LINE) / 2;
        int labelMax = stacked ? r - x - 8 : r - x - 126;
        CirrusUi.text(g, font, CirrusUi.fitBody(font, s.label(), labelMax), x + 4, labelY, textColor, false);
        switch (s.kind()) {
            case TOGGLE -> {
                boolean on = v.equals("true");
                CirrusUi.toggle(g, r - 28, cy - 6, on, on ? 1f : 0f, t);
                if (!active) Gfx.fillRound(g, r - 28, cy - 6, 24, 12, 6, Gfx.withAlpha(0xFF000000, 150));
            }
            case CHOICE -> {
                int pillW = stacked ? r - x - 8 : 92, px = r - pillW - 4;
                Gfx.fillRound(g, px, cy - 9, pillW, 18, 5, active ? t.surface : Gfx.scaleAlpha(t.surface, 0.5f));
                Gfx.strokeRound(g, px, cy - 9, pillW, 18, 5, 0.5f, t.border);
                CirrusUi.centered(g, font, CirrusUi.fitBody(font, s.display(v), pillW - 8), px + pillW / 2, cy - CirrusUi.LINE / 2, textColor);
            }
            case SLIDER -> {
                int tx = trackX() + (stacked ? 4 : 0), tw = trackW();
                double f = s.fraction(v);
                Gfx.fillRound(g, tx, cy - 2, tw, 4, 2, active ? Gfx.scaleAlpha(t.border, 0.9f) : Gfx.scaleAlpha(t.border, 0.4f));
                Gfx.fillRound(g, tx, cy - 2, Math.max(3, (float) (tw * f)), 4, 2, active ? 0xFFFFFFFF : Gfx.scaleAlpha(0xFFFFFFFF, 0.4f));
                Gfx.fillRound(g, tx + (float) (tw * f) - 4, cy - 5, 8, 10, 4, active ? 0xFFFFFFFF : Gfx.scaleAlpha(0xFFFFFFFF, 0.4f));
                String shown = s.display(v);
                CirrusUi.smallText(g, font, shown, r - CirrusUi.smallWidth(font, shown) - 4, cy - 4, textColor, false);
            }
        }
    }

    // ---- input -------------------------------------------------------------------------------------------------------

    private int rowAt(double mx, double my) {
        if (mx < x || mx >= x + w || my < y || my >= y + h) return -1;
        for (int i = 0; i < rows.size(); i++) { int top = rowTop(i); if (my >= top && my < top + rowHeight(rows.get(i))) return i; }
        return -1;
    }

    /** The setting under the pointer, or null. */
    public Setting hovered(double mx, double my) { int i = rowAt(mx, my); return i < 0 ? null : rows.get(i).setting(); }
    /** The keyboard-selected setting, or null. */
    public Setting selectedSetting() { return selected >= 0 ? rows.get(selected).setting() : null; }

    public boolean mouseClicked(double mx, double my, int button) {
        int i = rowAt(mx, my);
        if (i < 0 || rows.get(i).setting() == null) return false;
        Setting s = rows.get(i).setting();
        selected = i;
        if (!active(s)) return true;
        if (s.kind() == Setting.Kind.SLIDER) { dragging = s; slideTo(s, mx); }
        else set(s, s.step(value(s), button == 1 ? -1 : 1));
        return true;
    }

    private void slideTo(Setting s, double mouseX) { set(s, s.fromFraction((mouseX - (trackX() + (stacked ? 4 : 0))) / trackW())); }

    public boolean mouseDragged(double mx) { if (dragging == null) return false; slideTo(dragging, mx); return true; }
    public void mouseReleased() { dragging = null; }

    public boolean mouseScrolled(double mx, double my, double v) {
        if (!contains(mx, my) || maxScroll() == 0) return false;
        scroll = Math.max(0, Math.min(maxScroll(), scroll - (int) (v * rowH())));
        return true;
    }

    public boolean keyPressed(int key) {
        if (key == Keys.UP || key == Keys.DOWN) { moveSelection(key == Keys.UP ? -1 : 1); return true; }
        Setting s = selectedSetting();
        if (s != null && active(s) && (key == Keys.LEFT || key == Keys.RIGHT || key == Keys.ENTER || key == Keys.SPACE)) {
            set(s, s.step(value(s), key == Keys.LEFT ? -1 : 1));
            return true;
        }
        return false;
    }

    private void moveSelection(int dir) {
        int i = selected;
        do { i += dir; } while (i >= 0 && i < rows.size() && rows.get(i).setting() == null);
        if (i < 0 || i >= rows.size()) return;
        selected = i;
        int top = rowTop(i);
        if (top < y) scroll = Math.max(0, scroll - (y - top));
        else if (top + rowH() > y + h) scroll = Math.min(maxScroll(), scroll + (top + rowH() - (y + h)));
    }
}
