package dev.cirrus.client;

import dev.cirrus.client.mod.ClientModContext;
import dev.cirrus.client.render.McCanvas;
import dev.cirrus.client.render.McInput;
import dev.cirrus.client.ui.*;
import dev.cirrus.core.hud.HudDrag;
import dev.cirrus.core.hud.HudElement;
import dev.cirrus.core.hud.HudElementRegistry;
import dev.cirrus.core.hud.HudLayout;
import dev.cirrus.core.hud.SnapEngine;
import dev.cirrus.core.input.Keys;
import dev.cirrus.core.module.CirrusMod;
import dev.cirrus.core.render.Icons;
import dev.cirrus.core.theme.CirrusTheme;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * The HUD widgets editor. The world (or the menu backdrop) stays visible behind a live preview of every widget on the HUD.
 * Widgets are selected and dragged directly on screen, snap to the screen's edges and centre and to each other (guide lines show
 * what they snapped to), and can be nudged with the arrow keys. The rail on the right has two views: a searchable list of all
 * widgets with Remove/Add, and, once a widget is selected, that widget's style options (scale, colour, format, background...).
 * A floating "Mods" tab returns to the Click GUI. All position and layout logic lives in Core ({@link HudLayout}, {@link HudDrag},
 * {@link SnapEngine}); this class only draws and forwards input.
 */
public final class HudEditorScreen extends CirrusScreen {
    private static final int ROW_H = 25, SNAP_UNITS = 4, NUDGE = 1, NUDGE_BIG = 10;

    private String selected;
    private String query = "";
    private final HudDrag drag = new HudDrag();
    private int railW, railX;

    // list view
    private final List<AbstractWidget[]> rowWidgets = new ArrayList<>();
    private int[] rowY = new int[0];
    private int listTop, listBottom, scroll, matches;
    private EditBox search;

    // style view
    private SettingsPanel style;
    private int styleX, styleY, styleW, styleH;

    private boolean rebuild;

    public HudEditorScreen(Screen parent) { this(parent, ""); }

    public HudEditorScreen(Screen parent, String selectedId) {
        super(Component.literal("Maple HUD Editor"), parent);
        this.selected = selectedId == null ? "" : selectedId;
    }

    private HudElement selectedElement() { return selected.isEmpty() ? null : HudElementRegistry.find(selected).orElse(null); }

    private void select(String id) {
        if (!id.equals(selected)) { selected = id; rebuild = true; }
    }

    private void deselect() { if (!selected.isEmpty()) { selected = ""; rebuild = true; } }

    // ---- layout ---------------------------------------------------------------------------------------------------------

    @Override protected void init() {
        rowWidgets.clear();
        style = null;
        search = null;
        railW = Math.max(compact() ? 140 : 160, Math.min(200, width / 3));
        railX = width - 14 - railW;
        int x = railX + 8, w = railW - 16;
        int backY = height - 14 - 8 - 22;

        int tabW = 70;
        addRenderableWidget(CirrusButton.tab((railX - 8) / 2 - tabW / 2, 8, tabW, 24, Component.literal("Mods"), CirrusUi.ICON_MODS, false,
            b -> minecraft.setScreen(parent instanceof CirrusMenuScreen ? parent : new CirrusMenuScreen(parent))));
        addRenderableWidget(CirrusButton.primary(x, backY, w, 22, Component.literal("Back"), b -> minecraft.setScreen(parent)));

        HudElement sel = selectedElement();
        if (sel == null) { selected = ""; initList(x, w); } else initStyle(sel, x, w, backY);
    }

    private void initList(int x, int w) {
        var cfg = config();
        int searchY = 14 + 44;
        search = new EditBox(font, x + 18, searchY + 2, w - 18 - 14, 12, Component.literal("Search widgets"));
        search.setBordered(false);
        search.setTextShadow(false);
        search.addFormatter((value, cursor) -> CirrusUi.formatSearch(value));
        search.setHint(CirrusUi.small("Search widgets..."));
        search.setValue(query);
        search.setResponder(v -> { query = v; scroll = 0; layoutRows(); });
        addRenderableWidget(search);

        listTop = searchY + 22;
        listBottom = height - 14 - 8 - 22 - 6;
        int toggleW = 60;
        for (HudElement e : HudElementRegistry.all()) {
            int nameW = w - toggleW - 4;
            var name = CirrusButton.nav(x, listTop, nameW, 22, Component.literal(e.label()), CirrusUi.ICON_HUD, b -> select(e.id()));
            var toggle = CirrusButton.of(x + nameW + 4, listTop, toggleW, 22, Component.literal(HudLayout.isActive(e, cfg) ? "Remove" : "Add"), b -> {
                if (HudLayout.isActive(e, cfg)) HudLayout.remove(e, cfg); else HudLayout.restore(e, cfg);
                b.setMessage(Component.literal(HudLayout.isActive(e, cfg) ? "Remove" : "Add"));
            });
            addRenderableWidget(name);
            addRenderableWidget(toggle);
            rowWidgets.add(new AbstractWidget[] {name, toggle});
        }
        rowY = new int[rowWidgets.size()];
        scroll = 0;
        layoutRows();
    }

    private void initStyle(HudElement sel, int x, int w, int backY) {
        var cfg = config();
        int toggleW = 60;
        int rowTop = 14 + 44;
        addRenderableWidget(CirrusButton.nav(x, rowTop, w - toggleW - 4, 22, Component.literal("All widgets"), CirrusUi.ICON_BACK, b -> deselect()));
        addRenderableWidget(CirrusButton.of(x + w - toggleW, rowTop, toggleW, 22, Component.literal(HudLayout.isActive(sel, cfg) ? "Remove" : "Add"), b -> {
            if (HudLayout.isActive(sel, cfg)) HudLayout.remove(sel, cfg); else HudLayout.restore(sel, cfg);
            rebuild = true;
        }));
        int resetY = backY - 4 - 22;
        addRenderableWidget(CirrusButton.of(x, resetY, w, 22, Component.literal("Reset position"),
            b -> HudLayout.resetPosition(sel, cfg, width, height)));
        if (sel instanceof CirrusMod mod && !mod.settings().isEmpty()) {
            style = new SettingsPanel(mod);
            styleX = x; styleY = rowTop + 22 + 22; styleW = w; styleH = Math.max(20, resetY - 6 - styleY);
            style.layout(styleX, styleY, styleW, styleH, true);
        }
    }

    /** Positions the list rows: only widgets matching the search are shown, one after another, scrolled. */
    private void layoutRows() {
        List<HudElement> all = HudElementRegistry.all();
        List<HudElement> match = HudLayout.filter(all, query);
        matches = match.size();
        scroll = Math.max(0, Math.min(scroll, maxScroll()));
        int slot = 0;
        for (int i = 0; i < all.size() && i < rowWidgets.size(); i++) {
            boolean m = match.contains(all.get(i));
            int y = listTop + slot * ROW_H - scroll;
            if (m) slot++;
            boolean visible = m && y >= listTop - 1 && y + 22 <= listBottom + 1;
            rowY[i] = y;
            for (var widget : rowWidgets.get(i)) { widget.setY(y); widget.visible = visible; widget.active = visible; }
        }
    }

    private int maxScroll() { return Math.max(0, matches * ROW_H - (listBottom - listTop)); }

    // ---- drawing ----------------------------------------------------------------------------------------------------------

    /** The world stays visible (lightly dimmed) so widgets can be placed against the real picture; the menu backdrop otherwise. */
    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) {
        if (minecraft.level != null) McCanvas.of(g).fill(0, 0, width, height, 0x66000000);
        else CirrusUi.backdrop(g, width, height, theme());
    }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        if (rebuild) { rebuild = false; rebuildWidgets(); }
        HudElement sel = selectedElement();
        CirrusUi.panel(g, railX - 8, 6, railW + 16, height - 12, 16, t);
        CirrusUi.mark(g, railX + 8, 14 + 8, compact() ? 14 : 18, t);
        String heading = sel == null ? "HUD WIDGETS" : CirrusUi.fitSmall(font, sel.label().toUpperCase(java.util.Locale.ROOT), railW - 16);
        CirrusUi.headingText(g, font, heading, railX + 8, 14 + 32, t.cyan);
        if (sel == null) drawListChrome(g, t); else drawStyleChrome(g, mx, my, t, sel);
        drawCanvas(g, t);
    }

    private void drawListChrome(GuiGraphics g, CirrusTheme t) {
        int x = railX + 8, w = railW - 16, searchY = 14 + 44;
        boolean focus = search != null && search.isFocused();
        CirrusUi.card(g, x, searchY, w, 18, 9, 0xFF000000, focus ? 0xFFFFFFFF : t.border);
        Glyphs.draw(g, Icons.SEARCH, x + 6, searchY + 4, 10, focus ? 0xFFFFFFFF : t.muted);
        if (matches == 0) CirrusUi.centeredSmall(g, font, "No widgets match.", railX + railW / 2, listTop + 8, t.muted);
    }

    private void drawStyleChrome(GuiGraphics g, int mx, int my, CirrusTheme t, HudElement sel) {
        if (style != null) style.render(g, mx, my, t, true);
        else CirrusUi.centeredSmall(g, font, "This widget has no options.", railX + railW / 2, styleY + 8, t.muted);
        if (!HudLayout.isActive(sel, config())) CirrusUi.centeredSmall(g, font, "Removed from the HUD. Add it to show it again.", railX + railW / 2, 14 + 44 + 22 + 6, t.muted);
    }

    /** The live HUD: every active widget, the selection frame, the snap guides and a hint line. */
    private void drawCanvas(GuiGraphics g, CirrusTheme t) {
        var cfg = config();
        var canvas = McCanvas.of(g);
        boolean any = false;
        for (HudElement e : HudElementRegistry.all()) {
            if (!e.enabled(cfg)) continue;
            any = true;
            int x = e.x(cfg, width), y = e.y(cfg, height);
            e.render(canvas, x, y, 0, ClientModContext.INSTANCE);
            boolean sel = e.id().equals(selected);
            Gfx.strokeRound(g, x - 3, y - 3, e.width() + 6, e.height() + 6, 6, sel ? 1f : 0.5f, sel ? t.cyan : t.border);
        }
        if (drag.active()) {
            int guide = Gfx.withAlpha(t.accent, 200);
            if (drag.guideX() != SnapEngine.NONE) canvas.fill(Math.min(drag.guideX(), width - 1), 0, Math.min(drag.guideX(), width - 1) + 1, height, guide);
            if (drag.guideY() != SnapEngine.NONE) canvas.fill(0, Math.min(drag.guideY(), height - 1), width, Math.min(drag.guideY(), height - 1) + 1, guide);
        }
        if (!any) CirrusUi.centeredSmall(g, font, "Every widget is removed. Add one from the list to place it here.", (railX - 8) / 2, height / 2 - 4, t.muted);
        String hint = selected.isEmpty()
            ? "Click a widget to select it, then drag it into place."
            : "Drag to move. Arrow keys nudge (Shift: 10). Alt turns snapping off. Delete removes.";
        CirrusUi.centeredSmall(g, font, CirrusUi.fitSmall(font, hint, railX - 24), (railX - 8) / 2, height - 18, t.muted);
    }

    // ---- input ------------------------------------------------------------------------------------------------------------

    private boolean snapping() { return (McInput.INSTANCE.modifiers() & Keys.MOD_ALT) == 0; }

    @Override protected boolean onMouseClicked(MouseButtonEvent event, boolean doubleClick) {
        if (super.onMouseClicked(event, doubleClick)) return true;
        if (search != null && search.isFocused() && !(event.x() >= search.getX() && event.x() < search.getX() + search.getWidth())) search.setFocused(false);
        if (style != null && style.contains(event.x(), event.y())) { style.mouseClicked(event.x(), event.y(), event.button()); return true; }
        if (event.button() != 0 || event.x() >= railX - 10) return false;
        var cfg = config();
        HudElement hit = HudLayout.hit(HudElementRegistry.all(), cfg, width, height, event.x(), event.y(), 3);
        if (hit != null) {
            select(hit.id());
            drag.begin(hit, cfg, width, height, event.x(), event.y());
            return true;
        }
        HudElement chosen = selectedElement();
        if (chosen != null && chosen.enabled(cfg)) {
            drag.beginCentered(chosen);
            moveDragged(event);
            return true;
        }
        return false;
    }

    private void moveDragged(MouseButtonEvent event) {
        drag.update(config(), width, height, event.x(), event.y(), HudElementRegistry.all(), snapping() ? SNAP_UNITS : 0);
    }

    @Override protected boolean onMouseDragged(MouseButtonEvent event, double dx, double dy) {
        if (drag.active()) { moveDragged(event); return true; }
        if (style != null && style.mouseDragged(event.x())) return true;
        return super.onMouseDragged(event, dx, dy);
    }

    @Override protected boolean onMouseReleased(MouseButtonEvent event) {
        drag.end();
        if (style != null) style.mouseReleased();
        return super.onMouseReleased(event);
    }

    @Override protected boolean onMouseScrolled(double x, double y, double h, double v) {
        if (style != null && style.mouseScrolled(x, y, v)) return true;
        if (selected.isEmpty() && x >= railX) { scroll = Math.max(0, Math.min(maxScroll(), scroll - (int) (v * ROW_H))); layoutRows(); return true; }
        return super.onMouseScrolled(x, y, h, v);
    }

    @Override protected boolean onKeyPressed(KeyEvent event) {
        int key = event.key();
        boolean typing = search != null && search.isFocused();
        if (typing) {
            if (key == Keys.ESCAPE) { if (!query.isEmpty()) search.setValue(""); else search.setFocused(false); return true; }
            return super.onKeyPressed(event);
        }
        if (key == Keys.F && (event.modifiers() & Keys.MOD_CONTROL) != 0 && search != null) { setFocused(search); search.setFocused(true); return true; }
        HudElement sel = selectedElement();
        if (sel != null) {
            boolean overPanel = style != null && style.contains(McInput.INSTANCE.mouseX(), McInput.INSTANCE.mouseY());
            if (overPanel && style.keyPressed(key)) return true;
            if (key == Keys.ESCAPE) { deselect(); return true; }
            if (key == Keys.DELETE) { HudLayout.remove(sel, config()); rebuild = true; return true; }
            int step = (event.modifiers() & Keys.MOD_SHIFT) != 0 ? NUDGE_BIG : NUDGE;
            int dx = key == Keys.LEFT ? -step : key == Keys.RIGHT ? step : 0, dy = key == Keys.UP ? -step : key == Keys.DOWN ? step : 0;
            if ((dx != 0 || dy != 0) && sel.enabled(config())) { HudLayout.nudge(sel, config(), dx, dy, width, height); return true; }
        }
        return super.onKeyPressed(event);
    }
}
