package dev.cirrus.client;

import dev.cirrus.client.mod.*;
import dev.cirrus.client.ui.*;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

import java.util.*;

/** The Cirrus mod menu: filter pills, search and a smooth-scrolling grid of mod cards. */
public final class CirrusMenuScreen extends CirrusScreen {
    private ModCategory category = ModCategory.ALL;
    private String query = "";
    private boolean favoritesOnly, dirty = true;
    private EditBox search;
    private float scroll, scrollTarget;
    private final Anim.Clock clock = new Anim.Clock();
    private final Map<String, Float> toggles = new HashMap<>();
    private List<CirrusMod> entries = List.of();
    private final List<int[]> pillRects = new ArrayList<>(); // x, y, w, h
    private final List<Object> pillTargets = new ArrayList<>();
    // grid layout in GUI units
    private int panelX, panelY, panelW, panelH, gridX, gridY, gridW, gridH, cols, cardW, cardH, gap = 8;

    public CirrusMenuScreen(Screen parent) { super(Component.literal("Cirrus Mod Menu"), parent); }

    @Override protected Tab activeTab() { return Tab.MODS; }

    @Override protected void init() {
        buildHeader();
        boolean small = compact();
        panelX = contentX; panelY = contentY; panelW = contentW; panelH = contentBottom - contentY;
        int pad = small ? 8 : 12;
        int filterH = 20;
        cardH = small ? 70 : 84;
        gap = small ? 6 : 8;
        gridX = panelX + pad;
        gridW = panelW - pad * 2;
        gridY = panelY + pad + filterH + (small ? 6 : 10);
        gridH = panelY + panelH - pad - gridY;
        cols = Math.max(1, Math.min(5, (gridW + gap) / (112 + gap)));
        cardW = (gridW - gap * (cols - 1)) / cols;

        int searchW = Math.max(70, Math.min(170, gridW / 3));
        search = new EditBox(font, gridX + gridW - searchW + 22, panelY + pad + 4, searchW - 26, 12, Component.literal("Search mods"));
        search.setBordered(false);
        search.setTextShadow(false);
        search.addFormatter((value, cursor) -> CirrusUi.formatSearch(value));
        search.setHint(CirrusUi.small("Search"));
        search.setValue(query);
        search.setResponder(v -> { query = v; dirty = true; scrollTarget = 0; });
        addRenderableWidget(search);

        // filter pills, as many as fit left of the search box
        pillRects.clear(); pillTargets.clear();
        int px = gridX, py = panelY + pad, limit = gridX + gridW - searchW - 10;
        List<Object> options = new ArrayList<>();
        for (ModCategory c : ModCategory.values()) if (c == ModCategory.ALL || ModRegistry.all().stream().anyMatch(m -> m.category() == c)) options.add(c);
        options.add("favorites");
        for (Object o : options) {
            String label = o instanceof ModCategory c ? c.label : "Favorites";
            int w = CirrusUi.smallWidth(font, label) + 18;
            if (px + w > limit) break;
            pillRects.add(new int[] {px, py, w, filterH});
            pillTargets.add(o);
            px += w + 6;
        }
    }

    private List<CirrusMod> entries() {
        if (dirty) {
            var cfg = config();
            String q = query.toLowerCase(Locale.ROOT);
            entries = ModRegistry.all().stream()
                .filter(m -> category == ModCategory.ALL || m.category() == category)
                .filter(m -> !favoritesOnly || m.favorite(cfg))
                .filter(m -> (m.name() + " " + m.description()).toLowerCase(Locale.ROOT).contains(q))
                .toList();
            dirty = false;
        }
        return entries;
    }

    private int rows() { return (entries().size() + cols - 1) / cols; }
    private int contentHeight() { return rows() * (cardH + gap) - gap; }
    private int maxScroll() { return Math.max(0, contentHeight() - gridH); }
    private int cardX(int i) { return gridX + (i % cols) * (cardW + gap); }
    private int cardY(int i) { return gridY + (i / cols) * (cardH + gap) - Math.round(scroll); }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        float dt = clock.tick();
        scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget));
        scroll = Anim.approach(scroll, scrollTarget, dt, 16f);

        CirrusUi.panel(g, panelX, panelY, panelW, panelH, 14, t);

        // pills
        for (int i = 0; i < pillRects.size(); i++) {
            int[] r = pillRects.get(i);
            Object target = pillTargets.get(i);
            boolean on = target instanceof ModCategory c ? (!favoritesOnly && c == category) : favoritesOnly;
            boolean hover = mx >= r[0] && mx < r[0] + r[2] && my >= r[1] && my < r[1] + r[3];
            Gfx.fillRound(g, r[0], r[1], r[2], r[3], 7, on ? t.accent : Gfx.mix(t.surface, t.accent, hover ? 0.3f : 0f));
            if (!on) Gfx.strokeRound(g, r[0], r[1], r[2], r[3], 7, 0.5f, t.border);
            String label = target instanceof ModCategory c ? c.label : "Favorites";
            int tw = CirrusUi.smallWidth(font, label);
            CirrusUi.smallText(g, font, label, r[0] + (r[2] - tw) / 2, r[1] + (r[3] - CirrusUi.LINE) / 2, on ? 0xFFFFFFFF : (hover ? t.text : t.muted), false);
        }
        // search
        int searchW = gridW / 3 < 70 ? 70 : Math.min(170, gridW / 3);
        int sx = gridX + gridW - searchW, sy = panelY + (compact() ? 8 : 12);
        CirrusUi.card(g, sx, sy, searchW, 20, 7, t.surface, search != null && search.isFocused() ? t.cyan : t.border);
        CirrusUi.icon(g, sx + 6, sy + 4, 12, CirrusUi.ICON_SEARCH, t.cyan);

        // cards
        var list = entries();
        g.enableScissor(gridX - 2, gridY, gridX + gridW + 2, gridY + gridH);
        for (int i = 0; i < list.size(); i++) {
            int y = cardY(i);
            if (y + cardH < gridY || y > gridY + gridH) continue;
            drawCard(g, list.get(i), cardX(i), y, mx, my, t, dt);
        }
        g.disableScissor();
        CirrusUi.scrollbar(g, panelX + panelW - 6, gridY, gridH, maxScroll() == 0 ? 0 : scroll / maxScroll(), (float) gridH / Math.max(1, contentHeight()), t);

        if (list.isEmpty()) {
            int artH = Math.min(100, gridH - 24), artW = artH * 640 / 384;
            if (artH >= 40) {
                CirrusUi.emptyLibrary(g, gridX + (gridW - artW) / 2, gridY, artW, artH);
                CirrusUi.centeredSmall(g, font, "No mods match these filters.", gridX + gridW / 2, gridY + artH + 6, t.muted);
            } else {
                CirrusUi.centeredSmall(g, font, "No mods match these filters.", gridX + gridW / 2, gridY + gridH / 2 - 4, t.muted);
            }
        }
    }

    private void drawCard(GuiGraphics g, CirrusMod m, int x, int y, int mx, int my, CirrusTheme t, float dt) {
        var cfg = config();
        boolean hover = mx >= x && mx < x + cardW && my >= Math.max(y, gridY) && my < Math.min(y + cardH, gridY + gridH);
        boolean on = m.enabled(cfg);
        float prog = Anim.approach(toggles.getOrDefault(m.id(), on ? 1f : 0f), on ? 1f : 0f, dt, 14f);
        toggles.put(m.id(), prog);
        CirrusUi.card(g, x, y, cardW, cardH, 10, Gfx.mix(t.surface, t.accent, hover ? 0.14f : 0f), hover ? Gfx.mix(t.border, t.cyan, 0.6f) : t.border);
        // title and favourite
        int heart = 12;
        CirrusUi.headingText(g, font, CirrusUi.fit(font, m.name(), cardW - 16 - heart - 4, CirrusUi::heading), x + 8, y + 7, t.text);
        CirrusUi.icon(g, x + cardW - 8 - heart, y + 7, heart, CirrusUi.ICON_FAVORITE, m.favorite(cfg) ? 0xFFF5B942 : t.muted);
        // icon
        boolean small = compact();
        int tile = small ? 24 : 30;
        int ty = y + (small ? 21 : 24);
        Gfx.fillRound(g, x + (cardW - tile) / 2f, ty, tile, tile, 8, Gfx.mix(t.glow, t.accent, 0.35f * prog));
        int is = tile - 8;
        CirrusUi.icon(g, x + (cardW - is) / 2, ty + (tile - is) / 2, is, m.icon(), on ? t.cyan : t.muted);
        // bottom row: settings + enable switch
        int rowY = y + cardH - 26, rowH = 20, gear = 20;
        boolean gearHover = mx >= x + 8 && mx < x + 8 + gear && my >= rowY && my < rowY + rowH && my < gridY + gridH;
        Gfx.fillRound(g, x + 8, rowY, gear, rowH, 7, Gfx.mix(t.surface, t.accent, gearHover ? 0.4f : 0.1f));
        Gfx.strokeRound(g, x + 8, rowY, gear, rowH, 7, 0.5f, t.border);
        CirrusUi.sliders(g, x + 8 + 5, rowY + 5, 10, m.hasSettings() ? (gearHover ? t.cyan : t.muted) : Gfx.scaleAlpha(t.muted, 0.4f));
        int pillX = x + 8 + gear + 4, pillW = cardW - 16 - gear - 4;
        Gfx.fillRound(g, pillX, rowY, pillW, rowH, 7, Gfx.mix(Gfx.mix(t.surface, t.panel, 0.3f), t.accent, prog));
        if (prog < 0.95f) Gfx.strokeRound(g, pillX, rowY, pillW, rowH, 7, 0.5f, t.border);
        String label = on ? "Enabled" : "Disabled";
        int lw = CirrusUi.smallWidth(font, label);
        CirrusUi.smallText(g, font, label, pillX + (pillW - lw) / 2, rowY + (rowH - CirrusUi.LINE) / 2, Gfx.mix(t.muted, 0xFFFFFFFF, prog), false);
    }

    @Override public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        if (super.mouseClicked(event, doubleClick)) return true;
        double mx = event.x(), my = event.y();
        if (event.button() != 0) return false;
        for (int i = 0; i < pillRects.size(); i++) {
            int[] r = pillRects.get(i);
            if (mx >= r[0] && mx < r[0] + r[2] && my >= r[1] && my < r[1] + r[3]) {
                Object target = pillTargets.get(i);
                if (target instanceof ModCategory c) { category = c; favoritesOnly = false; } else favoritesOnly = !favoritesOnly;
                scrollTarget = 0; dirty = true;
                return true;
            }
        }
        if (mx < gridX || mx >= gridX + gridW || my < gridY || my >= gridY + gridH) return false;
        var list = entries();
        for (int i = 0; i < list.size(); i++) {
            int x = cardX(i), y = cardY(i);
            if (mx < x || mx >= x + cardW || my < y || my >= y + cardH) continue;
            var mod = list.get(i);
            int rowY = y + cardH - 26, rowH = 20, gear = 20;
            if (my >= rowY && my < rowY + rowH) {
                if (mx >= x + 8 && mx < x + 8 + gear) { if (mod.hasSettings()) mod.openSettings(this); }
                else if (mx >= x + 8 + gear + 4) mod.setEnabled(config(), !mod.enabled(config()));
            } else if (my < y + 22 && mx >= x + cardW - 8 - 14) {
                mod.setFavorite(config(), !mod.favorite(config())); dirty = true;
            }
            return true;
        }
        return false;
    }

    @Override public boolean mouseScrolled(double x, double y, double h, double v) {
        scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget - (float) (v * (cardH + gap) * 0.7)));
        return true;
    }
}
