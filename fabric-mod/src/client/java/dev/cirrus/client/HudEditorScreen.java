package dev.cirrus.client;

import dev.cirrus.client.mod.HudElement;
import dev.cirrus.client.mod.HudElementRegistry;
import dev.cirrus.client.ui.*;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

import java.util.ArrayList;
import java.util.List;

/** Every registered HUD element can be selected, toggled and dragged on a live preview of the screen. */
public final class HudEditorScreen extends CirrusScreen {
    private String selected = "";
    private boolean dragging;
    private int dragDx, dragDy, railW;
    private final List<int[]> rows = new ArrayList<>();
    private final List<net.minecraft.client.gui.components.AbstractWidget[]> rowWidgets = new ArrayList<>();
    private int listTop, listBottom, scroll;
    private static final int ROW_H = 25;

    public HudEditorScreen(Screen parent) { super(Component.literal("Cirrus HUD Editor"), parent); }

    @Override protected void init() {
        rows.clear();
        rowWidgets.clear();
        railW = Math.max(compact() ? 110 : 130, Math.min(176, width / 3));
        var cfg = config();
        int w = railW - 16, toggleW = 40;
        listTop = 14 + 50;
        listBottom = height - 14 - 8 - 22 - 6;
        for (HudElement e : HudElementRegistry.all()) {
            int nameW = w - toggleW - 4;
            var name = CirrusButton.nav(14 + 8, listTop, nameW, 22, Component.literal(e.label()), CirrusUi.ICON_HUD, b -> selected = e.id());
            var toggle = CirrusButton.of(14 + 8 + nameW + 4, listTop, toggleW, 22, Component.literal(e.enabled(cfg) ? "ON" : "OFF"), b -> { e.setEnabled(cfg, !e.enabled(cfg)); b.setMessage(Component.literal(e.enabled(cfg) ? "ON" : "OFF")); });
            addRenderableWidget(name);
            addRenderableWidget(toggle);
            rowWidgets.add(new net.minecraft.client.gui.components.AbstractWidget[] {name, toggle});
            rows.add(new int[] {0, 0});
        }
        scroll = Math.min(scroll, maxScroll());
        layoutRows();
        addRenderableWidget(CirrusButton.primary(14 + 8, height - 14 - 8 - 22, w, 22, Component.literal("Back"), b -> minecraft.setScreen(parent)));
    }

    private int maxScroll() { return Math.max(0, rowWidgets.size() * ROW_H - (listBottom - listTop)); }

    private void layoutRows() {
        for (int i = 0; i < rowWidgets.size(); i++) {
            int y = listTop + i * ROW_H - scroll;
            boolean visible = y >= listTop - 1 && y + 22 <= listBottom + 1;
            rows.get(i)[0] = y;
            for (var widget : rowWidgets.get(i)) { widget.setY(y); widget.visible = visible; widget.active = visible; }
        }
    }

    @Override public boolean mouseScrolled(double x, double y, double h, double v) {
        if (x < 14 + railW) { scroll = Math.max(0, Math.min(maxScroll(), scroll - (int) (v * ROW_H))); layoutRows(); return true; }
        return super.mouseScrolled(x, y, h, v);
    }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        CirrusUi.panel(g, 6, 6, width - 12, height - 12, 16, t);
        CirrusUi.card(g, 14, 14, railW, height - 28, 12, t.surface, t.border);
        CirrusUi.mark(g, 24, 14 + 8, compact() ? 14 : 18, t);
        CirrusUi.headingText(g, font, "HUD ELEMENTS", 22, 14 + 32, t.cyan);
        int i = 0;
        for (HudElement e : HudElementRegistry.all()) {
            if (e.id().equals(selected) && i < rows.size() && rowWidgets.get(i)[0].visible) Gfx.fillRound(g, 14 + 3, rows.get(i)[0] + 3, 2, 16, 1, t.cyan);
            i++;
        }
        var cfg = config();
        int sw = minecraft.getWindow().getGuiScaledWidth(), sh = minecraft.getWindow().getGuiScaledHeight();
        for (HudElement e : HudElementRegistry.all()) {
            if (!e.enabled(cfg)) continue;
            int x = e.x(cfg, sw), y = e.y(cfg, sh);
            e.render(g, x, y, 0, cfg);
            Gfx.strokeRound(g, x - 3, y - 3, e.width() + 6, e.height() + 6, 6, e.id().equals(selected) ? 1f : 0.5f, e.id().equals(selected) ? t.cyan : t.border);
        }
        boolean any = false;
        for (HudElement e : HudElementRegistry.all()) any |= e.enabled(cfg);
        if (!any) CirrusUi.centeredSmall(g, font, "Switch an element ON in the list to place it here.", (14 + railW + width) / 2, height / 2 - 4, t.muted);
        String hint = selected.isEmpty() ? "Click an element to select it, then drag it into place." : "Drag to move. Click the canvas to place the selected element.";
        int hx = 14 + railW + 12;
        CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, hint, width - hx - 16), hx, height - 26, t.muted, false);
    }

    @Override public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        if (super.mouseClicked(event, doubleClick)) return true;
        if (event.button() != 0) return false;
        var cfg = config();
        int sw = minecraft.getWindow().getGuiScaledWidth(), sh = minecraft.getWindow().getGuiScaledHeight();
        for (HudElement e : HudElementRegistry.all()) {
            if (!e.enabled(cfg)) continue;
            int x = e.x(cfg, sw), y = e.y(cfg, sh);
            if (event.x() >= x - 3 && event.x() <= x + e.width() + 3 && event.y() >= y - 3 && event.y() <= y + e.height() + 3) {
                selected = e.id(); dragging = true; dragDx = (int) event.x() - x; dragDy = (int) event.y() - y; return true;
            }
        }
        if (!selected.isEmpty() && event.x() >= 14 + railW + 6) {
            var chosen = HudElementRegistry.find(selected);
            if (chosen.isPresent()) {
                HudElement e = chosen.get();
                dragging = true; dragDx = e.width() / 2; dragDy = e.height() / 2;
                e.setPosition(cfg, (int) event.x() - dragDx, (int) event.y() - dragDy, sw, sh);
                return true;
            }
        }
        return false;
    }

    @Override public boolean mouseDragged(MouseButtonEvent event, double dx, double dy) {
        if (!dragging) return super.mouseDragged(event, dx, dy);
        HudElementRegistry.find(selected).ifPresent(e -> e.setPosition(config(), (int) event.x() - dragDx, (int) event.y() - dragDy, minecraft.getWindow().getGuiScaledWidth(), minecraft.getWindow().getGuiScaledHeight()));
        return true;
    }

    @Override public boolean mouseReleased(MouseButtonEvent event) { dragging = false; return super.mouseReleased(event); }
}
