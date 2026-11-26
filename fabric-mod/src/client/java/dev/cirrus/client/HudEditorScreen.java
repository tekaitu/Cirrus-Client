package dev.cirrus.client;

import dev.cirrus.core.theme.CirrusTheme;
import dev.cirrus.core.hud.HudElement;
import dev.cirrus.client.mod.ClientModContext;
import dev.cirrus.client.render.McCanvas;
import dev.cirrus.core.hud.HudDrag;
import dev.cirrus.core.hud.HudElementRegistry;
import dev.cirrus.core.hud.HudLayout;
import dev.cirrus.client.ui.*;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

import java.util.ArrayList;
import java.util.List;

/** Every registered HUD widget can be selected and dragged on a live preview of the screen; widgets can be removed from the HUD and added back from the list. */
public final class HudEditorScreen extends CirrusScreen {
    private String selected = "";
    private final HudDrag drag = new HudDrag();
    private int railW, railX;
    private final List<int[]> rows = new ArrayList<>();
    private final List<net.minecraft.client.gui.components.AbstractWidget[]> rowWidgets = new ArrayList<>();
    private int listTop, listBottom, scroll;
    private static final int ROW_H = 25;

    public HudEditorScreen(Screen parent) { this(parent, ""); }

    public HudEditorScreen(Screen parent, String selectedId) {
        super(Component.literal("Maple HUD Editor"), parent);
        this.selected = selectedId;
    }

    @Override protected void init() {
        rows.clear();
        rowWidgets.clear();
        railW = Math.max(compact() ? 140 : 160, Math.min(200, width / 3));
        railX = width - 14 - railW;
        var cfg = config();
        int w = railW - 16, toggleW = 60;
        listTop = 14 + 50;
        listBottom = height - 14 - 8 - 22 - 6;
        for (HudElement e : HudElementRegistry.all()) {
            int nameW = w - toggleW - 4;
            var name = CirrusButton.nav(railX + 8, listTop, nameW, 22, Component.literal(e.label()), CirrusUi.ICON_HUD, b -> selected = e.id());
            var toggle = CirrusButton.of(railX + 8 + nameW + 4, listTop, toggleW, 22, Component.literal(HudLayout.isActive(e, cfg) ? "Remove" : "Add"), b -> {
                if (HudLayout.isActive(e, cfg)) HudLayout.remove(e, cfg); else HudLayout.restore(e, cfg);
                b.setMessage(Component.literal(HudLayout.isActive(e, cfg) ? "Remove" : "Add"));
            });
            addRenderableWidget(name);
            addRenderableWidget(toggle);
            rowWidgets.add(new net.minecraft.client.gui.components.AbstractWidget[] {name, toggle});
            rows.add(new int[] {0, 0});
        }
        scroll = Math.min(scroll, maxScroll());
        layoutRows();
        addRenderableWidget(CirrusButton.primary(railX + 8, height - 14 - 8 - 22, w, 22, Component.literal("Back"), b -> minecraft.setScreen(parent)));
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

    @Override protected boolean onMouseScrolled(double x, double y, double h, double v) {
        if (x >= railX) { scroll = Math.max(0, Math.min(maxScroll(), scroll - (int) (v * ROW_H))); layoutRows(); return true; }
        return super.onMouseScrolled(x, y, h, v);
    }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        CirrusUi.panel(g, railX - 8, 6, railW + 16, height - 12, 16, t);
        CirrusUi.mark(g, railX + 8, 14 + 8, compact() ? 14 : 18, t);
        CirrusUi.headingText(g, font, "HUD ELEMENTS", railX + 8, 14 + 32, t.cyan);
        int i = 0;
        for (HudElement e : HudElementRegistry.all()) {
            if (e.id().equals(selected) && i < rows.size() && rowWidgets.get(i)[0].visible) Gfx.fillRound(g, railX + 3, rows.get(i)[0] + 3, 2, 16, 1, t.cyan);
            i++;
        }
        var cfg = config();
        var canvas = McCanvas.of(g);
        int sw = minecraft.getWindow().getGuiScaledWidth(), sh = minecraft.getWindow().getGuiScaledHeight();
        for (HudElement e : HudElementRegistry.all()) {
            if (!e.enabled(cfg)) continue;
            int x = e.x(cfg, sw), y = e.y(cfg, sh);
            e.render(canvas, x, y, 0, ClientModContext.INSTANCE);
            Gfx.strokeRound(g, x - 3, y - 3, e.width() + 6, e.height() + 6, 6, e.id().equals(selected) ? 1f : 0.5f, e.id().equals(selected) ? t.cyan : t.border);
        }
        boolean any = false;
        for (HudElement e : HudElementRegistry.all()) any |= e.enabled(cfg);
        if (!any) CirrusUi.centeredSmall(g, font, "Every widget is removed. Add one from the list to place it here.", (railX - 8) / 2, height / 2 - 4, t.muted);
        String hint = selected.isEmpty() ? "Click an element to select it, then drag it into place." : "Drag to move. Click the canvas to place the selected element.";
        int avail = railX - 24;
        CirrusUi.centeredSmall(g, font, CirrusUi.fitSmall(font, hint, avail), (railX - 8) / 2, height - 18, t.muted);
    }

    @Override protected boolean onMouseClicked(MouseButtonEvent event, boolean doubleClick) {
        if (super.onMouseClicked(event, doubleClick)) return true;
        if (event.button() != 0) return false;
        var cfg = config();
        int sw = minecraft.getWindow().getGuiScaledWidth(), sh = minecraft.getWindow().getGuiScaledHeight();
        HudElement hit = HudLayout.hit(HudElementRegistry.all(), cfg, sw, sh, event.x(), event.y(), 3);
        if (hit != null) {
            selected = hit.id();
            drag.begin(hit, cfg, sw, sh, event.x(), event.y());
            return true;
        }
        if (!selected.isEmpty() && event.x() < railX - 10) {
            var chosen = HudElementRegistry.find(selected);
            if (chosen.isPresent() && chosen.get().enabled(cfg)) {
                drag.beginCentered(chosen.get());
                drag.update(cfg, sw, sh, event.x(), event.y());
                return true;
            }
        }
        return false;
    }

    @Override protected boolean onMouseDragged(MouseButtonEvent event, double dx, double dy) {
        if (!drag.active()) return super.onMouseDragged(event, dx, dy);
        drag.update(config(), minecraft.getWindow().getGuiScaledWidth(), minecraft.getWindow().getGuiScaledHeight(), event.x(), event.y());
        return true;
    }

    @Override protected boolean onMouseReleased(MouseButtonEvent event) { drag.end(); return super.onMouseReleased(event); }
}
