package dev.cirrus.client;

import dev.cirrus.client.render.McCanvas;
import dev.cirrus.core.profile.Profiles;
import dev.cirrus.core.module.ModRegistry;
import dev.cirrus.core.module.CirrusMod;


import dev.cirrus.core.theme.CirrusTheme;
import dev.cirrus.core.anim.Anim;
import dev.cirrus.core.layout.ClickGuiLayout;
import dev.cirrus.core.module.ModCategory;
import dev.cirrus.core.input.Keys;
import dev.cirrus.core.render.Icons;
import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.client.mod.*;
import dev.cirrus.client.ui.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

import java.util.*;

/**
 * The Cirrus Click GUI: one window with a category sidebar and a content area. The content area shows a two-column grid of
 * modules (with search, profile and HUD editor buttons above it), or the settings of one module, or the Profiles page.
 * Everything is generated from {@link ModRegistry}, so a new module shows up in its category automatically.
 */
public final class CirrusMenuScreen extends CirrusScreen {
    private static final int GRAY = 0xFF8C8C8C, WHITE = 0xFFFFFFFF, GAP = 4;

    private record Cell(String header, CirrusMod mod, int col, int y) { }
    private record Side(ModCategory category, boolean favorites, boolean profiles, boolean appearance, String label, int glyph, int count) { }

    private ModCategory category;          // null = all modules
    private boolean favoritesOnly, profilesPage, appearancePage, dirty = true, cellsDirty = true, resizing;
    private String query = "";
    private EditBox search;
    private ClickGuiLayout layout;
    private int prefW, prefH, sideScroll, contentH;
    private float scroll, scrollTarget;
    private final Anim.Clock clock = new Anim.Clock();
    private final Map<String, Float> switches = new HashMap<>();
    private List<CirrusMod> mods = List.of();
    private List<Cell> cells = List.of();
    private CirrusMod selected;
    private ModPane pane;
    private final ProfilesPage profiles;
    private final AppearancePage appearance = new AppearancePage();
    private String tooltip, pendingModule = "";
    private boolean profileMenu;
    private String toast = "";
    private long toastUntil;

    public CirrusMenuScreen(Screen parent) { this(parent, false); }

    public CirrusMenuScreen(Screen parent, boolean openProfiles) {
        super(Component.literal("Maple Mod Menu"), parent);
        CirrusConfig cfg = config();
        String view = cfg.getString("ui.menu.view", "ALL");
        if (view.equals("FAVORITES")) favoritesOnly = true;
        else for (ModCategory c : ModCategory.values()) if (c.name().equals(view)) category = c;
        prefW = cfg.getInt("ui.menu.w", 0);
        prefH = cfg.getInt("ui.menu.h", 0);
        profiles = new ProfilesPage(Minecraft.getInstance());
        profilesPage = openProfiles;
    }

    /** Opens with the profile drop-down showing (used by the in-game screenshot test). */
    public CirrusMenuScreen withProfileMenu() { profileMenu = true; return this; }

    private void toast(String text) { toast = text; toastUntil = Anim.now() + 3200; }

    /** Opens straight onto one module's settings (used by the in-game screenshot test). */
    public CirrusMenuScreen withModule(String id) { pendingModule = id; return this; }

    @Override protected Tab activeTab() { return null; }

    // ---- layout ------------------------------------------------------------------------------------------------------

    @Override protected void init() {
        search = new EditBox(font, 0, 0, 100, 12, Component.literal("Search modules"));
        search.setBordered(false);
        search.setTextShadow(false);
        search.addFormatter((value, cursor) -> CirrusUi.formatSearch(value));
        search.setHint(CirrusUi.small("Search for module..."));
        search.setValue(query);
        search.setResponder(v -> { query = v; dirty = true; cellsDirty = true; scrollTarget = 0; });
        addRenderableWidget(search);
        addRenderableWidget(profiles.nameBox());
        applyLayout();
        if (!pendingModule.isEmpty()) { var id = pendingModule; pendingModule = ""; ModRegistry.find(id).ifPresent(this::select); }
        else if (pane != null) select(pane.mod());
        syncWidgets();
    }

    private void applyLayout() {
        ClickGuiLayout l = new ClickGuiLayout(width, height, prefW, prefH, 0);
        if (!l.rail) l = new ClickGuiLayout(width, height, prefW, prefH, CirrusUi.brandWidth(font, 14));
        layout = l;
        var s = l.search;
        search.setX(s.x() + 20);
        search.setY(s.y() + (s.h() - 12) / 2);
        search.setWidth(Math.max(10, s.w() - 20 - 16));
        if (pane != null) layoutPane();
        profiles.layout(font, l.content.x(), l.content.y(), l.content.w(), l.content.h());
        appearance.layout(font, l.content.x(), l.content.y(), l.content.w(), l.content.h());
        sideScroll = Math.max(0, Math.min(sideScroll, maxSideScroll()));
        cellsDirty = true;
    }

    private void layoutPane() { pane.layout(font, layout.pane.x(), layout.pane.y(), layout.pane.w(), layout.pane.h(), true); }

    private void syncWidgets() {
        boolean list = !profilesPage && !appearancePage && pane == null;
        search.visible = list; search.active = list;
        var box = profiles.nameBox();
        box.visible = profilesPage; box.active = profilesPage;
        if (!list && search.isFocused()) search.setFocused(false);
        if (!profilesPage && box.isFocused()) box.setFocused(false);
    }

    private void select(CirrusMod mod) {
        selected = mod;
        profilesPage = false;
        appearancePage = false;
        pane = new ModPane(mod, () -> minecraft.setScreen(new HudEditorScreen(this, mod.id())), this::closePane);
        layoutPane();
        syncWidgets();
    }

    /** Opens the Appearance page (used by the in-game check). */
    public void showAppearance() {
        pane = null; selected = null; profilesPage = false; appearancePage = true;
        appearance.layout(font, layout.content.x(), layout.content.y(), layout.content.w(), layout.content.h());
        syncWidgets();
    }

    private void closePane() { pane = null; syncWidgets(); }

    private void openProfiles() { pane = null; selected = null; appearancePage = false; profilesPage = true; profiles.refresh(); profiles.layout(font, layout.content.x(), layout.content.y(), layout.content.w(), layout.content.h()); syncWidgets(); }

    private boolean listVisible() { return !profilesPage && !appearancePage && pane == null; }

    // ---- data --------------------------------------------------------------------------------------------------------

    private boolean searching() { return !query.isBlank(); }

    private void rebuild() {
        if (dirty) {
            CirrusConfig cfg = config();
            String q = query.toLowerCase(Locale.ROOT).trim();
            List<CirrusMod> out = new ArrayList<>();
            for (CirrusMod m : ModRegistry.all()) {
                if (searching()) {
                    if ((m.name() + " " + m.description() + " " + m.category().label).toLowerCase(Locale.ROOT).contains(q)) out.add(m);
                } else if (favoritesOnly ? m.favorite(cfg) : (category == null || m.category() == category)) out.add(m);
            }
            mods = out;
            dirty = false;
            cellsDirty = true;
        }
        if (cellsDirty) {
            int cols = layout.columns, step = rowH() + GAP, y = 0, col = 0;
            List<Cell> out = new ArrayList<>();
            List<ModCategory> order = new ArrayList<>(List.of(ModCategory.values()));
            order.sort(Comparator.comparingInt(c -> -workingIn(c)));   // categories that have working modules come first
            for (ModCategory c : order) {
                List<CirrusMod> in = new ArrayList<>();
                for (CirrusMod m : mods) if (m.category() == c) in.add(m);
                if (in.isEmpty()) continue;
                in.sort(Comparator.comparingInt(m -> m.available() ? 0 : 1)); // stable: working modules first
                if (col != 0) { y += step; col = 0; }
                out.add(new Cell(c.label, null, 0, y));
                y += headerH();
                for (CirrusMod m : in) {
                    out.add(new Cell(null, m, col, y));
                    if (++col == cols) { col = 0; y += step; }
                }
                if (col != 0) { y += step; col = 0; }
            }
            cells = out;
            contentH = Math.max(0, y - GAP);
            cellsDirty = false;
        }
    }

    private static int workingIn(ModCategory c) { int n = 0; for (CirrusMod m : ModRegistry.all()) if (m.category() == c && m.available()) n++; return n; }

    private List<Side> sides() {
        CirrusConfig cfg = config();
        List<Side> out = new ArrayList<>();
        int fav = 0;
        for (CirrusMod m : ModRegistry.all()) if (m.favorite(cfg)) fav++;
        out.add(new Side(null, false, false, false, "All", Icons.GRID, ModRegistry.all().size()));
        out.add(new Side(null, true, false, false, "Favorites", Icons.STAR, fav));
        out.add(new Side(null, false, true, false, "Profiles", Icons.BOX, -1));
        out.add(new Side(null, false, false, true, "Appearance", Icons.SETTINGS, -1));
        for (ModCategory c : ModCategory.values()) {
            int n = 0;
            for (CirrusMod m : ModRegistry.all()) if (m.category() == c) n++;
            if (n > 0) out.add(new Side(c, false, false, false, c.label, c.glyph, n));
        }
        return out;
    }

    private int sideItemH() { return layout.sidebar.h() >= 200 ? 22 : 18; }
    private int sideContentH() { return sides().size() * (sideItemH() + 2) + 18; }
    private int maxSideScroll() { return Math.max(0, sideContentH() - (layout.sidebar.h() - 8)); }
    private int sideY(int index, int count) { return layout.sidebar.y() + 6 + index * (sideItemH() + 2) + (index >= 2 ? 6 : 0) + (index >= 4 ? 6 : 0) - sideScroll; }

    private boolean sideSelected(Side s) {
        if (s.profiles()) return profilesPage;
        if (s.appearance()) return appearancePage;
        if (profilesPage || appearancePage || searching() || pane != null) return false;
        return s.favorites() ? favoritesOnly : (!favoritesOnly && s.category() == category);
    }

    private void setView(Side s) {
        pane = null; selected = null;
        profilesPage = s.profiles();
        appearancePage = s.appearance();
        if (appearancePage) { appearance.layout(font, layout.content.x(), layout.content.y(), layout.content.w(), layout.content.h()); syncWidgets(); return; }
        if (profilesPage) { profiles.refresh(); profiles.layout(font, layout.content.x(), layout.content.y(), layout.content.w(), layout.content.h()); syncWidgets(); return; }
        category = s.category(); favoritesOnly = s.favorites();
        query = ""; search.setValue("");
        dirty = true; scrollTarget = 0;
        config().put("ui.menu.view", s.favorites() ? "FAVORITES" : s.category() == null ? "ALL" : s.category().name());
        syncWidgets();
    }

    // grid geometry
    private int rowH() { return layout.window.h() < 230 ? 28 : 34; }
    private int headerH() { return 18; }
    private int cellW() { return (layout.list.w() - (maxScroll() > 0 ? 7 : 0) - GAP * (layout.columns - 1)) / layout.columns; }
    private int maxScroll() { return Math.max(0, contentH - layout.list.h()); }
    private int cellX(Cell c) { return layout.list.x() + c.col() * (cellW() + GAP); }
    private int cellY(Cell c) { return layout.list.y() + c.y() - Math.round(scroll); }

    // ---- drawing -----------------------------------------------------------------------------------------------------

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        float dt = clock.tick();
        rebuild();
        syncWidgets();
        scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget));
        scroll = Anim.approach(scroll, scrollTarget, dt, 16f);
        tooltip = null;
        var w = layout.window;
        CirrusUi.panel(g, w.x(), w.y(), w.w(), w.h(), 12, t);
        drawTopBar(g, mx, my, t);
        McCanvas.of(g).fill(w.x() + 1, layout.topBar.bottom(), w.right() - 1, layout.topBar.bottom() + 1, t.border);
        drawSidebar(g, mx, my, t);
        McCanvas.of(g).fill(layout.sidebar.right(), layout.sidebar.y() + 1, layout.sidebar.right() + 1, layout.sidebar.bottom() - 1, t.border);
        if (profilesPage) {
            profiles.render(g, mx, my, t);
            if (layout.content.contains(mx, my)) tooltip = profiles.tooltip(mx, my);
        } else if (appearancePage) {
            appearance.render(g, mx, my, t);
            if (layout.content.contains(mx, my)) tooltip = appearance.tooltip(mx, my);
        } else if (pane != null) {
            pane.render(g, mx, my, dt, t);
            if (pane.contains(mx, my)) tooltip = pane.tooltip(mx, my);
        } else {
            drawHeader(g, mx, my, t);
            drawGrid(g, mx, my, dt, t);
        }
        boolean gripHover = layout.grip.contains(mx, my) || resizing;
        Glyphs.draw(g, Icons.GRIP, layout.grip.x() + 1, layout.grip.y() + 1, 10, gripHover ? WHITE : 0xFF5A5A5A);
        if (gripHover && tooltip == null) tooltip = "Drag to resize the window. Double-click to reset.";
    }

    private void drawTopBar(GuiGraphics g, int mx, int my, CirrusTheme t) {
        var b = layout.brand;
        if (layout.rail) CirrusUi.mark(g, b.x(), b.y() + (b.h() - 14) / 2, 14, t);
        else CirrusUi.brand(g, b.x(), b.y() + (b.h() - 14) / 2, 14, t);
        iconButton(g, layout.homeButton, Icons.GLOBE, mx, my, t, "Home: Maple news and partners.");
        iconButton(g, layout.closeButton, Icons.CLOSE, mx, my, t, "Close (Right Shift)");
    }

    private void iconButton(GuiGraphics g, ClickGuiLayout.Rect r, int glyph, int mx, int my, CirrusTheme t, String tip) {
        boolean hover = r.contains(mx, my);
        Gfx.fillRound(g, r.x(), r.y(), r.w(), r.h(), 6, hover ? dev.cirrus.client.ui.Look.SURFACE_HOVER : dev.cirrus.client.ui.Look.SURFACE);
        Glyphs.draw(g, glyph, r.x() + (r.w() - 12) / 2, r.y() + (r.h() - 12) / 2, 12, WHITE);
        if (hover) tooltip = tip;
    }

    private void drawHeader(GuiGraphics g, int mx, int my, CirrusTheme t) {
        var s = layout.search;
        boolean focus = search != null && search.isFocused();
        CirrusUi.card(g, s.x(), s.y(), s.w(), s.h(), s.h() / 2f, dev.cirrus.client.ui.Look.FIELD, focus ? Gfx.withAlpha(t.accent, 0xB0) : 0);
        Glyphs.draw(g, Icons.SEARCH, s.x() + 6, s.y() + (s.h() - 10) / 2, 10, focus ? WHITE : t.muted);
        if (searching()) {
            boolean hover = clearRect().contains(mx, my);
            Glyphs.draw(g, Icons.CLOSE, clearRect().x() + 2, clearRect().y() + 2, 8, hover ? WHITE : t.muted);
        }
        String active = profiles.activeName();
        String pl = layout.profileLabel ? "Profile: " + (active.isEmpty() ? "None" : CirrusUi.fitSmall(font, active, 54)) : null;
        headerButton(g, layout.profileButton, Icons.BOX, pl, mx, my, t, "Profiles: switch between saved setups, or save the current one.");
        if (layout.profileLabel) {
            var pb = layout.profileButton;
            var pose = g.pose();
            pose.pushMatrix();
            pose.translate(pb.right() - 11, pb.y() + pb.h() / 2f);
            pose.rotate((float) (Math.PI / 2));
            Glyphs.draw(g, Icons.CHEVRON, -4, -4, 8, profileMenu ? WHITE : 0xFFB0B0B0);
            pose.popMatrix();
        }
        headerButton(g, layout.shareButton, Icons.EXTERNAL, null, mx, my, t, "Share: copy a code with all your module settings. A friend pastes it under Profiles > Import.");
        headerButton(g, layout.hudButton, Icons.HUD, layout.hudLabel ? "Edit HUD" : null, mx, my, t, "Edit HUD: move and resize your HUD on screen.");
    }

    private ClickGuiLayout.Rect clearRect() { var s = layout.search; return new ClickGuiLayout.Rect(s.right() - 14, s.y() + (s.h() - 12) / 2, 12, 12); }

    private void headerButton(GuiGraphics g, ClickGuiLayout.Rect r, int glyph, String label, int mx, int my, CirrusTheme t, String tip) {
        boolean hover = r.contains(mx, my);
        Gfx.fillRound(g, r.x(), r.y(), r.w(), r.h(), 6, hover ? dev.cirrus.client.ui.Look.SURFACE_HOVER : dev.cirrus.client.ui.Look.SURFACE);
        if (label == null) Glyphs.draw(g, glyph, r.x() + (r.w() - 12) / 2, r.y() + (r.h() - 12) / 2, 12, WHITE);
        else {
            Glyphs.draw(g, glyph, r.x() + 6, r.y() + (r.h() - 12) / 2, 12, WHITE);
            CirrusUi.smallText(g, font, label, r.x() + 22, r.y() + (r.h() - CirrusUi.LINE) / 2, WHITE, false);
        }
        if (hover) tooltip = tip;
    }

    private void drawSidebar(GuiGraphics g, int mx, int my, CirrusTheme t) {
        var sb = layout.sidebar;
        McCanvas.of(g).pushClip(sb.x(), sb.y(), (sb.right()) - (sb.x()), (sb.bottom() - 1) - (sb.y()));
        List<Side> sides = sides();
        int ih = sideItemH();
        for (int i = 0; i < sides.size(); i++) {
            Side s = sides.get(i);
            int y = sideY(i, sides.size());
            if (i == 2 || i == 4) McCanvas.of(g).fill(sb.x() + 10, y - 5, sb.right() - 10, y - 4, t.border);
            int x = sb.x() + 6, w = sb.w() - 12;
            boolean on = sideSelected(s), hover = mx >= x && mx < x + w && my >= y && my < y + ih && sb.contains(mx, my);
            if (on || hover) Gfx.fillRound(g, x, y, w, ih, 6, on ? dev.cirrus.client.ui.Look.SURFACE_HOVER : dev.cirrus.client.ui.Look.SURFACE);
            if (on) Gfx.fillRound(g, x, y + 5, 2, ih - 10, 1, t.accent);
            int fg = on || hover ? WHITE : t.muted;
            if (layout.rail) {
                Glyphs.draw(g, s.glyph(), x + (w - 12) / 2, y + (ih - 12) / 2, 12, fg);
                if (hover) tooltip = s.label() + (s.count() >= 0 ? " (" + s.count() + ")" : "");
            } else {
                Glyphs.draw(g, s.glyph(), x + 6, y + (ih - 12) / 2, 12, fg);
                CirrusUi.smallText(g, font, s.label(), x + 23, y + (ih - CirrusUi.LINE) / 2, fg, false);
                if (s.count() >= 0) CirrusUi.rightSmall(g, font, Integer.toString(s.count()), x + w - 6, y + (ih - CirrusUi.LINE) / 2, GRAY);
            }
        }
        McCanvas.of(g).popClip();
    }

    private void drawGrid(GuiGraphics g, int mx, int my, float dt, CirrusTheme t) {
        var l = layout.list;
        McCanvas.of(g).pushClip(l.x(), l.y(), (l.right()) - (l.x()), (l.bottom()) - (l.y()));
        int cw = cellW();
        for (Cell c : cells) {
            int y = cellY(c);
            int h = c.mod() == null ? headerH() : rowH();
            if (y + h < l.y() || y > l.bottom()) continue;
            if (c.mod() == null) {
                int tw = CirrusUi.smallWidth(font, c.header());
                CirrusUi.smallText(g, font, c.header(), l.x() + 2, y + 4, WHITE, false);
                McCanvas.of(g).fill(l.x() + 2 + tw + 8, y + 8, l.x() + (cw + GAP) * layout.columns - GAP, y + 9, 0xFF2A2A2A);
            } else drawRow(g, c.mod(), cellX(c), y, cw, mx, my, dt, t);
        }
        McCanvas.of(g).popClip();
        if (maxScroll() > 0) CirrusUi.scrollbar(g, l.right() - 3, l.y(), l.h(), scroll / maxScroll(), (float) l.h() / Math.max(1, contentH), t);
        if (cells.isEmpty()) {
            String msg = searching() ? "No modules match your search." : favoritesOnly ? "No favorites yet. Hover a module and click its star." : "No modules here yet.";
            CirrusUi.centeredSmall(g, font, msg, l.x() + l.w() / 2, l.y() + l.h() / 2 - 4, GRAY);
        }
    }

    private int toggleX(CirrusMod m, int x, int w) { return m.available() ? x + w - 6 - 24 : x + w - 6 - (CirrusUi.smallWidth(font, "Planned") + 12); }

    private void drawRow(GuiGraphics g, CirrusMod m, int x, int y, int w, int mx, int my, float dt, CirrusTheme t) {
        CirrusConfig cfg = config();
        int h = rowH();
        boolean avail = m.available(), on = m.enabled(cfg), sel = selected == m;
        boolean hover = mx >= x && mx < x + w && my >= y && my < y + h && layout.list.contains(mx, my);
        float prog = Anim.approach(switches.getOrDefault(m.id(), on ? 1f : 0f), on ? 1f : 0f, dt, 14f);
        switches.put(m.id(), prog);
        Gfx.fillRound(g, x, y, w, h, 8, sel || hover ? dev.cirrus.client.ui.Look.SURFACE_HOVER : dev.cirrus.client.ui.Look.SURFACE);
        int tile = h >= 34 ? 22 : 18;
        ModTile.draw(g, m, on, x + 6, y + (h - tile) / 2, tile);
        int tx = x + 6 + tile + 8;
        int toggleX = toggleX(m, x, w), starX = toggleX - 8 - 12;
        int textW = starX - 6 - tx;
        boolean twoLine = layout.columns == 1;
        int nameY = twoLine ? (h >= 34 ? y + 6 : y + 4) : y + (h - CirrusUi.LINE) / 2;
        CirrusUi.text(g, font, CirrusUi.fitBody(font, m.name(), textW), tx, nameY, avail ? WHITE : t.muted, false);
        if (twoLine) CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, m.description(), textW), tx, h >= 34 ? y + 18 : y + 15, avail ? t.muted : 0xFF6E6E6E, false);
        boolean fav = m.favorite(cfg);
        boolean starHover = hover && mx >= starX - 2 && mx < starX + 14;
        if (fav || hover) Glyphs.draw(g, Icons.STAR, starX, y + (h - 12) / 2, 12, fav || starHover ? WHITE : 0xFF5A5A5A);
        if (avail) CirrusUi.toggle(g, toggleX, y + (h - 12) / 2, on, prog, t);
        else {
            int tw = CirrusUi.smallWidth(font, "Planned") + 12;
            Gfx.strokeRound(g, toggleX, y + (h - 14) / 2, tw, 14, 7, 0.5f, 0xFF4A4A4A);
            CirrusUi.smallText(g, font, "Planned", toggleX + 6, y + (h - CirrusUi.LINE) / 2, GRAY, false);
        }
        if (hover) {
            if (starHover) tooltip = fav ? "Remove from favorites" : "Add to favorites";
            else if (!avail && mx >= toggleX) tooltip = "Planned: not available yet.";
            else if (avail && mx >= toggleX - 2) tooltip = on ? "Turn off" : "Turn on";
            else if (!twoLine) tooltip = null;
            else tooltip = m.description() + (m.note().isEmpty() ? "" : " " + m.note());
        }
    }

    // ---- profile drop-down and toast ---------------------------------------------------------------------------------

    private record PItem(String label, int glyph, int kind, String arg, boolean active) { }
    private static final int P_LOAD = 0, P_SAVE = 1, P_MANAGE = 2, P_ROW = 20;

    private List<PItem> profileItems() {
        List<PItem> out = new ArrayList<>();
        String active = profiles.activeName();
        int room = Math.max(1, (layout.window.bottom() - layout.profileButton.bottom() - 70) / P_ROW);
        int shown = 0;
        for (String n : profiles.names()) { if (shown++ >= room) break; out.add(new PItem(n, Icons.CHECK, P_LOAD, n, n.equalsIgnoreCase(active))); }
        if (!active.isEmpty()) out.add(new PItem("Save to " + active, Icons.BOX, P_SAVE, active, false));
        out.add(new PItem("Manage profiles...", Icons.SETTINGS, P_MANAGE, "", false));
        return out;
    }

    private ClickGuiLayout.Rect profilePopup(int items) {
        var b = layout.profileButton;
        int w = Math.max(150, b.w()), x = Math.max(layout.window.x() + 4, Math.min(b.right() - w, layout.window.right() - w - 4));
        return new ClickGuiLayout.Rect(x, b.bottom() + 2, w, items * P_ROW + 8);
    }

    private void drawProfileMenu(GuiGraphics g, int mx, int my, CirrusTheme t) {
        List<PItem> items = profileItems();
        var r = profilePopup(items.size());
        CirrusUi.popup(g, r.x(), r.y(), r.w(), r.h(), 8, t);
        for (int i = 0; i < items.size(); i++) {
            PItem it = items.get(i);
            int y = r.y() + 4 + i * P_ROW;
            boolean hover = mx >= r.x() + 4 && mx < r.right() - 4 && my >= y && my < y + P_ROW;
            if (it.kind() != P_LOAD && i > 0 && items.get(i - 1).kind() == P_LOAD) McCanvas.of(g).fill(r.x() + 8, y - 1, r.right() - 8, y, t.border);
            if (hover) Gfx.fillRound(g, r.x() + 4, y, r.w() - 8, P_ROW, 5, dev.cirrus.client.ui.Look.SURFACE_HOVER);
            if (it.kind() == P_LOAD) {
                if (it.active()) Glyphs.draw(g, Icons.CHECK, r.x() + 9, y + (P_ROW - 10) / 2, 10, WHITE);
            } else Glyphs.draw(g, it.glyph(), r.x() + 9, y + (P_ROW - 10) / 2, 10, t.muted);
            CirrusUi.text(g, font, CirrusUi.fitBody(font, it.label(), r.w() - 36), r.x() + 24, y + (P_ROW - CirrusUi.LINE) / 2, it.kind() == P_LOAD ? WHITE : t.muted, false);
        }
    }

    private boolean clickProfileMenu(double mx, double my) {
        List<PItem> items = profileItems();
        var r = profilePopup(items.size());
        profileMenu = false;
        if (!r.contains(mx, my)) return true;
        int i = (int) ((my - r.y() - 4) / P_ROW);
        if (i < 0 || i >= items.size()) return true;
        PItem it = items.get(i);
        switch (it.kind()) {
            case P_LOAD -> { toast(profiles.load(it.arg())); dirty = true; cellsDirty = true; }
            case P_SAVE -> toast(profiles.saveActive());
            default -> openProfiles();
        }
        return true;
    }

    @Override protected void drawOverlay(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        if (profileMenu) { drawProfileMenu(g, mx, my, t); tooltip = null; }
        long left = toastUntil - Anim.now();
        if (left > 0 && !toast.isEmpty()) {
            String text = CirrusUi.fitSmall(font, toast, layout.window.w() - 40);
            int tw = CirrusUi.smallWidth(font, text) + 20, th = 20;
            int tx = layout.window.x() + (layout.window.w() - tw) / 2, ty = layout.window.bottom() - th - 14;
            float a = Math.min(1f, left / 400f);
            Gfx.fillRound(g, tx, ty, tw, th, 10, Gfx.scaleAlpha(t.popup, a));
            CirrusUi.centeredSmall(g, font, text, tx + tw / 2, ty + (th - CirrusUi.LINE) / 2, Gfx.withAlpha(WHITE, Math.round(255 * a)));
        }
        if (tooltip == null || tooltip.isEmpty()) return;
        List<String> lines = CirrusUi.wrapSmall(font, tooltip, 170, 4);
        if (lines.isEmpty()) return;
        int tw = 0;
        for (String s : lines) tw = Math.max(tw, CirrusUi.smallWidth(font, s));
        int bw = tw + 12, bh = lines.size() * 10 + 8;
        int bx = mx + 10, by = my + 12;
        if (bx + bw > width - 2) bx = Math.max(2, mx - bw - 6);
        if (by + bh > height - 2) by = Math.max(2, my - bh - 6);
        CirrusUi.popup(g, bx, by, bw, bh, 5, t);
        for (int i = 0; i < lines.size(); i++) CirrusUi.smallText(g, font, lines.get(i), bx + 6, by + 4 + i * 10, WHITE, false);
    }

    // ---- input -------------------------------------------------------------------------------------------------------

    @Override protected boolean onMouseClicked(MouseButtonEvent event, boolean doubleClick) {
        double mx = event.x(), my = event.y();
        if (pane != null && pane.isListening()) { pane.mouseClicked(mx, my, event.button()); return true; }
        if (profileMenu) { clickProfileMenu(mx, my); return true; }
        if (super.onMouseClicked(event, doubleClick)) return true;
        if (event.button() != 0 && event.button() != 1) return false;
        if (search.isFocused() && !layout.search.contains(mx, my)) search.setFocused(false);
        if (layout.closeButton.contains(mx, my)) { closeAll(); return true; }
        if (layout.homeButton.contains(mx, my)) { minecraft.setScreen(new CirrusDashboardScreen(parent)); return true; }
        if (layout.grip.contains(mx, my)) {
            if (doubleClick) { prefW = 0; prefH = 0; saveSize(); applyLayout(); } else resizing = true;
            return true;
        }
        if (layout.sidebar.contains(mx, my)) {
            List<Side> sides = sides();
            for (int i = 0; i < sides.size(); i++) {
                int y = sideY(i, sides.size());
                if (mx >= layout.sidebar.x() + 6 && mx < layout.sidebar.right() - 6 && my >= y && my < y + sideItemH()) { setView(sides.get(i)); return true; }
            }
            return true;
        }
        if (profilesPage) { profiles.nameBox().setFocused(false); return profiles.mouseClicked(mx, my); }
        if (appearancePage) return appearance.mouseClicked(mx, my, event.button());
        if (pane != null) return pane.mouseClicked(mx, my, event.button());
        if (layout.hudButton.contains(mx, my)) { minecraft.setScreen(new HudEditorScreen(this, "")); return true; }
        if (layout.profileButton.contains(mx, my)) { profiles.refresh(); profileMenu = true; return true; }
        if (layout.shareButton.contains(mx, my)) { toast(profiles.copyShareCode()); return true; }
        if (searching() && clearRect().contains(mx, my)) { query = ""; search.setValue(""); return true; }
        if (layout.list.contains(mx, my)) {
            for (Cell c : cells) {
                if (c.mod() == null) continue;
                int x = cellX(c), y = cellY(c), w = cellW(), h = rowH();
                if (mx < x || mx >= x + w || my < y || my >= y + h) continue;
                CirrusMod m = c.mod();
                CirrusConfig cfg = config();
                int toggleX = toggleX(m, x, w), starX = toggleX - 8 - 12;
                if (mx >= starX - 2 && mx < starX + 14) { m.setFavorite(cfg, !m.favorite(cfg)); dirty = true; }
                else if (m.available() && mx >= toggleX - 2) m.setEnabled(cfg, !m.enabled(cfg));
                else select(m);
                return true;
            }
        }
        return false;
    }

    @Override protected boolean onMouseDragged(MouseButtonEvent event, double dx, double dy) {
        if (resizing) {
            prefW = (int) Math.round((event.x() - width / 2.0 + 6) * 2);
            prefH = (int) Math.round((event.y() - height / 2.0 + 6) * 2);
            applyLayout();
            prefW = layout.window.w(); prefH = layout.window.h();   // keep the stored size equal to what the layout allowed
            return true;
        }
        if (appearancePage && appearance.mouseDragged(event.x())) return true;
        if (pane != null && pane.mouseDragged(event.x())) return true;
        return super.onMouseDragged(event, dx, dy);
    }

    @Override protected boolean onMouseReleased(MouseButtonEvent event) {
        if (resizing) { resizing = false; saveSize(); }
        if (appearancePage) appearance.mouseReleased();
        if (pane != null) pane.mouseReleased();
        return super.onMouseReleased(event);
    }

    private void saveSize() { CirrusConfig cfg = config(); cfg.put("ui.menu.w", Integer.toString(prefW)); cfg.put("ui.menu.h", Integer.toString(prefH)); }

    @Override protected boolean onMouseScrolled(double x, double y, double h, double v) {
        if (layout.sidebar.contains(x, y)) { sideScroll = Math.max(0, Math.min(maxSideScroll(), sideScroll - (int) (v * 20))); return true; }
        if (profilesPage) return profiles.mouseScrolled(x, y, v) || super.onMouseScrolled(x, y, h, v);
        if (appearancePage) return appearance.mouseScrolled(x, y, v) || super.onMouseScrolled(x, y, h, v);
        if (pane != null) { if (pane.mouseScrolled(x, y, v)) return true; }
        else if (layout.list.contains(x, y)) { scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget - (float) (v * (rowH() + GAP) * 1.5))); return true; }
        return super.onMouseScrolled(x, y, h, v);
    }

    @Override protected boolean onKeyPressed(KeyEvent event) {
        int key = event.key();
        if (pane != null && pane.isListening()) { pane.keyPressed(key); return true; }
        var nameBox = profiles.nameBox();
        if (profilesPage && nameBox.isFocused() && (key == Keys.ENTER || key == Keys.KP_ENTER)) { profiles.create(); return true; }
        if (key == Keys.F && (event.modifiers() & Keys.MOD_CONTROL) != 0 && listVisible()) { setFocused(search); search.setFocused(true); return true; }
        boolean typing = search.isFocused() || nameBox.isFocused();
        if (key == Keys.ESCAPE) {
            if (profileMenu) { profileMenu = false; return true; }
            if (search.isFocused() && !query.isEmpty()) { search.setValue(""); return true; }
            if (typing) { search.setFocused(false); nameBox.setFocused(false); return true; }
            if (pane != null) { closePane(); return true; }
            if (profilesPage) { profilesPage = false; syncWidgets(); return true; }
            if (appearancePage) { appearancePage = false; syncWidgets(); return true; }
        }
        if (!typing) {
            if (appearancePage && appearance.keyPressed(key)) return true;
            if (pane != null && pane.focused() && pane.keyPressed(key)) return true;
            if (listVisible() && (key == Keys.UP || key == Keys.DOWN)) { moveSelection(key == Keys.UP ? -1 : 1); return true; }
            if (listVisible() && selected != null && key == Keys.ENTER && selected.available()) {
                selected.setEnabled(config(), !selected.enabled(config()));
                return true;
            }
            if (listVisible() && selected != null && (key == Keys.SPACE || key == Keys.RIGHT)) { select(selected); return true; }
        }
        return super.onKeyPressed(event);
    }

    /** Keyboard browsing of the grid: Up/Down move the highlight, Enter switches the highlighted module, Space or Right opens its settings. */
    private void moveSelection(int dir) {
        List<CirrusMod> flat = new ArrayList<>();
        for (Cell c : cells) if (c.mod() != null) flat.add(c.mod());
        if (flat.isEmpty()) return;
        int idx = flat.indexOf(selected);
        int next = Math.max(0, Math.min(flat.size() - 1, idx < 0 ? 0 : idx + (dir * layout.columns)));
        selected = flat.get(next);
        for (Cell c : cells) if (c.mod() == selected) {
            if (c.y() < scrollTarget) scrollTarget = c.y();
            else if (c.y() + rowH() > scrollTarget + layout.list.h()) scrollTarget = c.y() + rowH() - layout.list.h();
        }
    }
}
