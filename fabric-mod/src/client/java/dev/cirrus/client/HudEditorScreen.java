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
import dev.cirrus.core.theme.CirrusTheme;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The HUD editor. Everything unrelated to the HUD steps out of the way: the vanilla HUD is hidden, the world stays visible under a
 * very light veil, and the only chrome is a small floating cluster at the top centre (Mods, Widgets, Done).
 * <ul>
 * <li>Left-drag moves a widget; it snaps to the screen and to other widgets (guides show where), arrow keys nudge, Alt turns snapping off.</li>
 * <li>Right-click a widget for a compact menu: Disable/Enable, Remove, and Customize where the widget has options.</li>
 * <li>Customize opens a small popover with the widget's own options (text colour, background colour and opacity, scale, format...).</li>
 * <li>Widgets lists every widget so removed ones can be restored.</li>
 * </ul>
 * Disabled widgets stay in the layout (dimmed here) and can be enabled where they are; removed widgets leave the layout and come
 * back from the list. All position and layout logic lives in Core ({@link HudLayout}, {@link HudDrag}, {@link SnapEngine}); this
 * class draws and forwards input. Opening Mods keeps this screen as the parent, so coming back restores the editor as it was.
 */
public final class HudEditorScreen extends CirrusScreen {
    private static final int SNAP_UNITS = 4, NUDGE = 1, NUDGE_BIG = 10;
    private static final int MENU_W = 136, MENU_ROW = 20, LIST_ROW = 22, POP_PAD = 10;

    private enum Pop { NONE, MENU, CUSTOMIZE, LIST }
    private enum Act { TOGGLE, REMOVE, CUSTOMIZE }

    private String selected;
    private final HudDrag drag = new HudDrag();

    // floating cluster
    private int clusterX, clusterY, clusterW, widgetsBtnCenter;
    private final int[] buttonCentreX = new int[3];
    private boolean closedThisClick;

    // popups: one at a time
    private Pop pop = Pop.NONE;
    private int popX, popY, popW, popH;
    private final List<Act> menuActs = new ArrayList<>();
    private SettingsPanel style;
    private String styleId = "";
    private EditBox search;
    private String query = "";
    private int listScroll, listVisible;

    private Boolean savedHideGui;

    public HudEditorScreen(Screen parent) { this(parent, ""); }

    public HudEditorScreen(Screen parent, String selectedId) {
        super(Component.literal("Maple HUD Editor"), parent);
        this.selected = selectedId == null ? "" : selectedId;
    }

    private HudElement selectedElement() { return selected.isEmpty() ? null : HudElementRegistry.find(selected).orElse(null); }
    private static boolean hasOptions(HudElement e) { return e instanceof CirrusMod m && !m.settings().isEmpty(); }
    private static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(Math.max(lo, hi), v)); }

    // ---- lifecycle ------------------------------------------------------------------------------------------------------

    @Override protected void init() {
        // Hide the vanilla HUD while editing so only the widgets being edited are on screen; restored in removed().
        if (savedHideGui == null) savedHideGui = minecraft.options.hideGui;
        minecraft.options.hideGui = true;

        boolean small = compact() || width < 360;
        int bw = small ? 28 : 64, ww = small ? 28 : 74, dw = small ? 28 : 56, gap = 4;
        clusterW = bw + ww + dw + gap * 2;
        clusterX = (width - clusterW) / 2;
        clusterY = 8;
        addRenderableWidget(CirrusButton.tab(clusterX, clusterY, bw, 24, small ? Component.empty() : Component.literal("Mods"), CirrusUi.ICON_MODS, false,
            b -> minecraft.setScreen(parent instanceof CirrusMenuScreen ? parent : new CirrusMenuScreen(this))));
        addRenderableWidget(CirrusButton.tab(clusterX + bw + gap, clusterY, ww, 24, small ? Component.empty() : Component.literal("Widgets"), CirrusUi.ICON_HUD, false, b -> {
            if (pop == Pop.LIST) closePop(); else if (!closedThisClick) openList();
        }));
        widgetsBtnCenter = clusterX + bw + gap + ww / 2;
        buttonCentreX[0] = clusterX + bw / 2;
        buttonCentreX[1] = widgetsBtnCenter;
        buttonCentreX[2] = clusterX + bw + ww + gap * 2 + dw / 2;
        addRenderableWidget(CirrusButton.primary(clusterX + bw + ww + gap * 2, clusterY, dw, 24, small ? Component.empty() : Component.literal("Done"), b -> minecraft.setScreen(parent)));

        search = new EditBox(font, 0, 0, 100, 12, Component.literal("Search widgets"));
        search.setBordered(false);
        search.setTextShadow(false);
        search.addFormatter((value, cursor) -> CirrusUi.formatSearch(value));
        search.setHint(CirrusUi.small("Search widgets..."));
        search.setValue(query);
        search.setResponder(v -> { query = v; listScroll = 0; layoutList(); });
        search.visible = false;
        search.active = false;
        addRenderableWidget(search);

        if (pop == Pop.MENU) pop = Pop.NONE; // the menu's anchor point is gone after a resize
        if (pop == Pop.LIST) layoutList();
        if (pop == Pop.CUSTOMIZE) { if (selectedElement() == null || !hasOptions(selectedElement())) pop = Pop.NONE; else layoutCustomize(selectedElement()); }
    }

    @Override public void removed() {
        if (savedHideGui != null) { minecraft.options.hideGui = savedHideGui; savedHideGui = null; }
        drag.end();
        super.removed();
    }

    private void select(String id) { selected = id; }
    private void deselect() { selected = ""; }

    // ---- popups ---------------------------------------------------------------------------------------------------------

    private void closePop() {
        pop = Pop.NONE;
        style = null;
        styleId = "";
        if (search != null) { search.setFocused(false); search.visible = false; search.active = false; }
    }

    private boolean inPop(double mx, double my) { return pop != Pop.NONE && mx >= popX && mx < popX + popW && my >= popY && my < popY + popH; }

    private void openMenu(HudElement e, double mx, double my) {
        closePop();
        select(e.id());
        menuActs.clear();
        menuActs.add(Act.TOGGLE);
        menuActs.add(Act.REMOVE);
        if (hasOptions(e)) menuActs.add(Act.CUSTOMIZE);
        popW = MENU_W;
        popH = menuActs.size() * MENU_ROW + 8;
        popX = clamp((int) mx, 4, width - popW - 4);
        popY = clamp((int) my, 4, height - popH - 4);
        pop = Pop.MENU;
    }

    private void openCustomize(HudElement e) {
        if (!(e instanceof CirrusMod mod) || mod.settings().isEmpty()) return;
        closePop();
        select(e.id());
        style = new SettingsPanel(mod);
        styleId = e.id();
        pop = Pop.CUSTOMIZE;
        popW = Math.min(240, width - 16);
        popH = Math.min(height - 16, 300);
        var cfg = config();
        int ex = e.x(cfg, width), ey = e.y(cfg, height);
        int px = ex + e.width() + 12;
        if (px + popW > width - 8) px = ex - popW - 12;
        popX = clamp(px, 8, width - popW - 8);
        popY = clamp(ey - 8, 8, height - popH - 8);
        layoutCustomize(e);
    }

    private void layoutCustomize(HudElement e) {
        if (style == null) style = new SettingsPanel((CirrusMod) e);
        style.layout(popX + POP_PAD, popY + 34, popW - POP_PAD * 2, popH - 34 - 36, true);
    }

    private void openList() {
        closePop();
        pop = Pop.LIST;
        search.visible = true;
        search.active = true;
        listScroll = 0;
        layoutList();
    }

    private List<HudElement> listMatches() { return HudLayout.filter(HudElementRegistry.all(), query); }

    private void layoutList() {
        if (pop != Pop.LIST) return;
        popW = Math.min(224, width - 16);
        int rows = Math.max(1, listMatches().size());
        popY = clusterY + 24 + 6;
        int maxRows = Math.max(1, (height - popY - 12 - 56) / LIST_ROW);
        listVisible = Math.min(rows, maxRows);
        popH = 56 + listVisible * LIST_ROW;
        popX = clamp(widgetsBtnCenter - popW / 2, 8, width - popW - 8);
        listScroll = clamp(listScroll, 0, Math.max(0, rows - listVisible));
        search.setX(popX + POP_PAD + 18);
        search.setY(popY + 31);
        search.setWidth(popW - POP_PAD * 2 - 18 - 8);
    }

    private int listTop() { return popY + 52; }

    // ---- drawing --------------------------------------------------------------------------------------------------------

    /** The world stays visible under a very light veil, so widgets are placed against the real picture. */
    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) {
        if (minecraft.level != null) McCanvas.of(g).fill(0, 0, width, height, 0x1C000000);
        else CirrusUi.backdrop(g, width, height, theme());
    }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        drawCanvas(g, mx, my, t);
        if (pop == Pop.LIST) drawList(g, mx, my, t);
    }

    /** The live HUD: every widget in the layout (disabled ones dimmed), a soft highlight on hover/selection, snap guides and a hint. */
    private void drawCanvas(GuiGraphics g, int mx, int my, CirrusTheme t) {
        var cfg = config();
        var canvas = McCanvas.of(g);
        HudElement hover = inPop(mx, my) || drag.active() ? null : HudLayout.hit(HudElementRegistry.all(), cfg, width, height, mx, my, 2);
        boolean any = false;
        for (HudElement e : HudElementRegistry.all()) {
            if (e.removed(cfg)) continue;
            any = true;
            int x = e.x(cfg, width), y = e.y(cfg, height), w = e.width(), h = e.height();
            boolean sel = e.id().equals(selected);
            if (sel || e == hover) Gfx.fillRound(g, x - 3, y - 3, w + 6, h + 6, 6, sel ? Gfx.withAlpha(t.accent, 0x30) : 0x22FFFFFF);
            e.render(canvas, x, y, 0, ClientModContext.INSTANCE);
            if (!e.enabled(cfg)) {
                Gfx.fillRound(g, x, y, w, h, 5, 0x80000000);
                String off = CirrusUi.fitSmall(font, "Disabled", Math.max(8, w - 4));
                CirrusUi.centeredSmall(g, font, off, x + w / 2, y + (h - 8) / 2, 0xFFE6E6E6);
            }
        }
        if (drag.active()) {
            int guide = Gfx.withAlpha(t.accent, 200);
            if (drag.guideX() != SnapEngine.NONE) canvas.fill(Math.min(drag.guideX(), width - 1), 0, Math.min(drag.guideX(), width - 1) + 1, height, guide);
            if (drag.guideY() != SnapEngine.NONE) canvas.fill(0, Math.min(drag.guideY(), height - 1), width, Math.min(drag.guideY(), height - 1) + 1, guide);
        }
        if (!any) CirrusUi.centeredSmall(g, font, "Every widget is removed. Open Widgets to bring one back.", width / 2, height / 2 - 4, 0xFFE6E6E6);
        if (pop == Pop.NONE && !drag.active() && width >= 300) {
            String hint = CirrusUi.fitSmall(font, "Right-click a widget for options  -  drag to move  -  arrow keys nudge", width - 200);
            int hw = CirrusUi.smallWidth(font, hint) + 16;
            Gfx.fillRound(g, (width - hw) / 2f, height - 24, hw, 16, 8, 0x59000000);
            CirrusUi.centeredSmall(g, font, hint, width / 2, height - 20, 0xFFE0E0E0);
        }
    }

    @Override protected void drawOverlay(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        if (pop == Pop.MENU) drawMenu(g, mx, my, t);
        else if (pop == Pop.CUSTOMIZE) drawCustomize(g, mx, my, t);
    }

    private void drawMenu(GuiGraphics g, int mx, int my, CirrusTheme t) {
        HudElement e = selectedElement();
        if (e == null) return;
        CirrusUi.popup(g, popX, popY, popW, popH, 8, t);
        boolean enabled = e.enabled(config());
        for (int i = 0; i < menuActs.size(); i++) {
            int ry = popY + 4 + i * MENU_ROW;
            boolean hover = mx >= popX + 4 && mx < popX + popW - 4 && my >= ry && my < ry + MENU_ROW;
            if (hover) Gfx.fillRound(g, popX + 4, ry, popW - 8, MENU_ROW, 5, Look.SURFACE_HOVER);
            String label = switch (menuActs.get(i)) {
                case TOGGLE -> enabled ? "Disable widget" : "Enable widget";
                case REMOVE -> "Remove widget";
                case CUSTOMIZE -> "Customize";
            };
            CirrusUi.text(g, font, label, popX + 12, ry + (MENU_ROW - CirrusUi.LINE) / 2, t.text, false);
            if (menuActs.get(i) == Act.CUSTOMIZE) CirrusUi.icon(g, popX + popW - 22, ry + (MENU_ROW - 10) / 2, 10, CirrusUi.ICON_SETTINGS, t.muted);
        }
    }

    // customize popover chips: footer buttons
    private int footY() { return popY + popH - 28; }
    private int chipW() { return (popW - POP_PAD * 2 - 6) / 2; }

    private void drawChip(GuiGraphics g, int x, int y, int w, String label, boolean hover, CirrusTheme t) {
        Gfx.fillRound(g, x, y, w, 20, 6, hover ? Look.SURFACE_HOVER : Look.SURFACE);
        CirrusUi.centered(g, font, CirrusUi.fitBody(font, label, w - 8), x + w / 2, y + (20 - CirrusUi.LINE) / 2, t.text);
    }

    private void drawCustomize(GuiGraphics g, int mx, int my, CirrusTheme t) {
        HudElement e = selectedElement();
        if (e == null || style == null) return;
        CirrusUi.popup(g, popX, popY, popW, popH, 10, t);
        CirrusUi.headingText(g, font, CirrusUi.fitSmall(font, e.label().toUpperCase(Locale.ROOT), popW - POP_PAD * 2 - 26), popX + POP_PAD, popY + 13, t.accent);
        boolean overClose = mx >= popX + popW - 26 && mx < popX + popW - 8 && my >= popY + 8 && my < popY + 26;
        if (overClose) Gfx.fillRound(g, popX + popW - 26, popY + 8, 18, 18, 5, Look.SURFACE_HOVER);
        CirrusUi.icon(g, popX + popW - 22, popY + 12, 10, CirrusUi.ICON_CLOSE, t.muted);
        style.render(g, mx, my, t, true);
        int cw = chipW(), fy = footY();
        drawChip(g, popX + POP_PAD, fy, cw, "Reset options", mx >= popX + POP_PAD && mx < popX + POP_PAD + cw && my >= fy && my < fy + 20, t);
        int rx = popX + POP_PAD + cw + 6;
        drawChip(g, rx, fy, cw, "Reset position", mx >= rx && mx < rx + cw && my >= fy && my < fy + 20, t);
    }

    private void drawList(GuiGraphics g, int mx, int my, CirrusTheme t) {
        var cfg = config();
        CirrusUi.popup(g, popX, popY, popW, popH, 10, t);
        CirrusUi.headingText(g, font, "WIDGETS", popX + POP_PAD, popY + 13, t.accent);
        int sx = popX + POP_PAD, sy = popY + 28, sw = popW - POP_PAD * 2;
        boolean focus = search != null && search.isFocused();
        Gfx.fillRound(g, sx, sy, sw, 18, 9, focus ? Look.FIELD_HOVER : Look.FIELD);
        CirrusUi.icon(g, sx + 6, sy + 4, 10, CirrusUi.ICON_SEARCH, focus ? t.text : t.muted);
        List<HudElement> rows = listMatches();
        if (rows.isEmpty()) { CirrusUi.centeredSmall(g, font, "No widgets match.", popX + popW / 2, listTop() + 7, t.muted); return; }
        for (int i = 0; i < listVisible; i++) {
            int idx = listScroll + i;
            if (idx >= rows.size()) break;
            HudElement e = rows.get(idx);
            int ry = listTop() + i * LIST_ROW;
            boolean hover = mx >= popX + 4 && mx < popX + popW - 4 && my >= ry && my < ry + LIST_ROW;
            if (hover) Gfx.fillRound(g, popX + 4, ry, popW - 8, LIST_ROW, 5, Look.SURFACE_HOVER);
            boolean removed = e.removed(cfg), off = !removed && !e.enabled(cfg);
            int chipW = 52, chipX = popX + popW - POP_PAD - chipW, cy = ry + 2;
            boolean overChip = mx >= chipX && mx < chipX + chipW && my >= cy && my < cy + LIST_ROW - 4;
            Gfx.fillRound(g, chipX, cy, chipW, LIST_ROW - 4, 6, overChip ? Look.SURFACE_HOVER : Look.SURFACE);
            CirrusUi.centeredSmall(g, font, removed ? "Add" : "Remove", chipX + chipW / 2, cy + (LIST_ROW - 4 - 8) / 2, removed ? t.accentLight : t.text);
            int labelMax = chipX - (popX + POP_PAD) - (off ? 34 : 6);
            CirrusUi.text(g, font, CirrusUi.fitBody(font, e.label(), labelMax), popX + POP_PAD, ry + (LIST_ROW - CirrusUi.LINE) / 2, removed || off ? t.muted : t.text, false);
            if (off) CirrusUi.rightSmall(g, font, "Off", chipX - 6, ry + (LIST_ROW - 8) / 2, t.muted);
        }
        int total = rows.size();
        if (total > listVisible) CirrusUi.scrollbar(g, popX + popW - 5, listTop(), listVisible * LIST_ROW, listScroll / (float) (total - listVisible), listVisible / (float) total, t);
    }

    // ---- input ----------------------------------------------------------------------------------------------------------

    private boolean snapping() { return (McInput.INSTANCE.modifiers() & Keys.MOD_ALT) == 0; }

    @Override protected boolean onMouseClicked(MouseButtonEvent event, boolean doubleClick) {
        closedThisClick = false;
        double mx = event.x(), my = event.y();
        int button = event.button();
        if (pop != Pop.NONE && !inPop(mx, my)) { closePop(); closedThisClick = true; }
        else if (pop != Pop.NONE) return clickPopup(event, doubleClick);

        if (button == 0 && super.onMouseClicked(event, doubleClick)) return true;
        var cfg = config();
        HudElement hit = HudLayout.hit(HudElementRegistry.all(), cfg, width, height, mx, my, 3);
        if (button == 1) {
            if (hit != null) openMenu(hit, mx, my); else deselect();
            return true;
        }
        if (button != 0) return false;
        if (hit != null) {
            select(hit.id());
            drag.begin(hit, cfg, width, height, mx, my);
            return true;
        }
        deselect();
        return false;
    }

    private boolean clickPopup(MouseButtonEvent event, boolean doubleClick) {
        double mx = event.x(), my = event.y();
        int button = event.button();
        HudElement e = selectedElement();
        var cfg = config();
        switch (pop) {
            case MENU -> {
                if (button != 0 || e == null) return true;
                int i = (int) ((my - (popY + 4)) / MENU_ROW);
                if (i < 0 || i >= menuActs.size()) return true;
                switch (menuActs.get(i)) {
                    case TOGGLE -> { if (e.enabled(cfg)) HudLayout.disable(e, cfg); else HudLayout.enable(e, cfg); closePop(); }
                    case REMOVE -> { HudLayout.remove(e, cfg); deselect(); closePop(); }
                    case CUSTOMIZE -> openCustomize(e);
                }
            }
            case CUSTOMIZE -> {
                if (e == null || style == null) { closePop(); return true; }
                if (button == 0 && mx >= popX + popW - 26 && mx < popX + popW - 8 && my >= popY + 8 && my < popY + 26) { closePop(); return true; }
                if (style.contains(mx, my)) { style.mouseClicked(mx, my, button); return true; }
                if (button == 0 && my >= footY() && my < footY() + 20) {
                    if (mx >= popX + POP_PAD && mx < popX + POP_PAD + chipW()) style.reset();
                    else if (mx >= popX + POP_PAD + chipW() + 6 && mx < popX + popW - POP_PAD) HudLayout.resetPosition(e, cfg, width, height);
                }
            }
            case LIST -> {
                if (super.onMouseClicked(event, doubleClick)) return true;
                if (search.isFocused() && !(mx >= search.getX() && mx < search.getX() + search.getWidth() && my >= search.getY() - 3 && my < search.getY() + 15)) search.setFocused(false);
                if (button != 0) return true;
                int i = (int) ((my - listTop()) / LIST_ROW);
                List<HudElement> rows = listMatches();
                if (my < listTop() || i < 0 || i >= listVisible || listScroll + i >= rows.size()) return true;
                HudElement row = rows.get(listScroll + i);
                boolean chip = mx >= popX + popW - POP_PAD - 52;
                if (row.removed(cfg)) { HudLayout.restore(row, cfg); select(row.id()); }
                else if (chip) { HudLayout.remove(row, cfg); if (row.id().equals(selected)) deselect(); }
                else { select(row.id()); closePop(); }
                layoutList();
            }
            default -> { }
        }
        return true;
    }

    private void moveDragged(MouseButtonEvent event) {
        drag.update(config(), width, height, event.x(), event.y(), HudElementRegistry.all(), snapping() ? SNAP_UNITS : 0);
    }

    @Override protected boolean onMouseDragged(MouseButtonEvent event, double dx, double dy) {
        if (drag.active()) { moveDragged(event); return true; }
        if (pop == Pop.CUSTOMIZE && style != null && style.mouseDragged(event.x())) return true;
        return super.onMouseDragged(event, dx, dy);
    }

    @Override protected boolean onMouseReleased(MouseButtonEvent event) {
        drag.end();
        if (style != null) style.mouseReleased();
        return super.onMouseReleased(event);
    }

    @Override protected boolean onMouseScrolled(double x, double y, double h, double v) {
        if (pop == Pop.CUSTOMIZE && style != null && style.mouseScrolled(x, y, v)) return true;
        if (pop == Pop.LIST && inPop(x, y)) {
            listScroll = listScroll - (int) Math.signum(v);
            layoutList();
            return true;
        }
        return super.onMouseScrolled(x, y, h, v);
    }

    @Override protected boolean onKeyPressed(KeyEvent event) {
        int key = event.key();
        boolean typing = search != null && search.isFocused();
        if (typing) {
            if (key == Keys.ESCAPE) { if (!query.isEmpty()) search.setValue(""); else search.setFocused(false); return true; }
            return super.onKeyPressed(event);
        }
        if (key == Keys.ESCAPE) {
            if (pop != Pop.NONE) { closePop(); return true; }
            if (!selected.isEmpty()) { deselect(); return true; }
            return super.onKeyPressed(event);
        }
        if (key == Keys.F && (event.modifiers() & Keys.MOD_CONTROL) != 0) { openList(); setFocused(search); search.setFocused(true); return true; }
        HudElement sel = selectedElement();
        if (pop == Pop.CUSTOMIZE && style != null && style.contains(McInput.INSTANCE.mouseX(), McInput.INSTANCE.mouseY()) && style.keyPressed(key)) return true;
        if (sel != null && pop != Pop.CUSTOMIZE && !sel.removed(config())) {
            if (key == Keys.DELETE) { HudLayout.remove(sel, config()); deselect(); closePop(); return true; }
            int step = (event.modifiers() & Keys.MOD_SHIFT) != 0 ? NUDGE_BIG : NUDGE;
            int dx = key == Keys.LEFT ? -step : key == Keys.RIGHT ? step : 0, dy = key == Keys.UP ? -step : key == Keys.DOWN ? step : 0;
            if (dx != 0 || dy != 0) { HudLayout.nudge(sel, config(), dx, dy, width, height); return true; }
        }
        return super.onKeyPressed(event);
    }

    // ---- test hooks -----------------------------------------------------------------------------------------------------
    // The in-game check drives this screen with real mouse input and needs to know where things are (GUI units).

    public String openPopup() { return pop.name(); }
    public int[] widgetCentre(String id) {
        var cfg = config();
        return HudElementRegistry.find(id).map(e -> new int[] {e.x(cfg, width) + e.width() / 2, e.y(cfg, height) + e.height() / 2}).orElse(null);
    }
    /** 0 = Mods, 1 = Widgets, 2 = Done. */
    public int[] clusterButtonCentre(int index) { return new int[] {buttonCentreX[index], clusterY + 12}; }
    public int[] menuRowCentre(int index) { return new int[] {popX + popW / 2, popY + 4 + index * MENU_ROW + MENU_ROW / 2}; }
    public int[] listRowCentre(int index) { return new int[] {popX + POP_PAD + 20, listTop() + (index - listScroll) * LIST_ROW + LIST_ROW / 2}; }
    public int[] listChipCentre(int index) { return new int[] {popX + popW - POP_PAD - 26, listTop() + (index - listScroll) * LIST_ROW + LIST_ROW / 2}; }
    public int[] customizeChipCentre(int index) { return new int[] {popX + POP_PAD + index * (chipW() + 6) + chipW() / 2, footY() + 10}; }
    public java.util.List<String> menuLabels() {
        java.util.List<String> out = new ArrayList<>();
        HudElement e = selectedElement();
        for (Act a : menuActs) out.add(switch (a) {
            case TOGGLE -> e != null && e.enabled(config()) ? "Disable widget" : "Enable widget";
            case REMOVE -> "Remove widget";
            case CUSTOMIZE -> "Customize";
        });
        return out;
    }
}
