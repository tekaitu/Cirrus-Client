package dev.cirrus.client;

import dev.cirrus.client.mod.*;
import dev.cirrus.client.ui.*;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

import java.util.*;

/** Mod library: category rail, search, favourites filter and a smooth scrolling list of registered mods. */
public final class CirrusMenuScreen extends CirrusScreen {
    private ModCategory category = ModCategory.ALL;
    private String query = "";
    private boolean favoritesOnly, dirty = true;
    private EditBox search;
    private float scroll, scrollTarget;
    private final Anim.Clock clock = new Anim.Clock();
    private final Map<String, Float> toggles = new HashMap<>();
    private List<CirrusMod> entries = List.of();
    // layout (GUI units), recomputed in init
    private int railX, railW, cx, cw, listTop, listBottom, cardH, cardGap;

    public CirrusMenuScreen(Screen parent) { super(Component.literal("Cirrus Client"), parent); }

    @Override protected void init() {
        boolean small = compact();
        railX = 14;
        railW = Math.max(small ? 64 : 78, Math.min(108, width / 5));
        cx = railX + railW + 8;
        cw = width - 14 - cx;
        cardH = small ? 40 : 48;
        cardGap = small ? 4 : 6;
        int top = 14;
        int footerH = 22;
        int searchY = top + 28;
        listTop = searchY + 26;
        listBottom = height - 14 - footerH - 6;

        // rail
        int y = top + 8 + (small ? 24 : 32);
        addRenderableWidget(CirrusButton.nav(railX + 6, y, railW - 12, 20, Component.literal("Dashboard"), CirrusUi.ICON_DASHBOARD, b -> minecraft.setScreen(new CirrusDashboardScreen(this))));
        y += 24;
        for (ModCategory c : ModCategory.values()) {
            if (c == ModCategory.ALL || ModRegistry.all().stream().anyMatch(m -> m.category() == c)) {
                final ModCategory choice = c;
                if (y + 20 > height - 14 - 28) break;
                addRenderableWidget(CirrusButton.nav(railX + 6, y, railW - 12, 20, Component.literal(c.label), categoryIcon(c), b -> { category = choice; scrollTarget = 0; dirty = true; }));
                y += 24;
            }
        }
        addRenderableWidget(CirrusButton.nav(railX + 6, height - 14 - 28, railW - 12, 20, Component.literal("Themes"), CirrusUi.ICON_THEMES, b -> minecraft.setScreen(new CirrusThemesScreen(this))));

        // header actions (right aligned)
        int hx = cx + cw;
        if (cw > 300) { hx -= 110; addRenderableWidget(CirrusButton.of(hx, top + 2, 110, 20, Component.literal("Minecraft settings"), b -> minecraft.setScreen(new OptionsScreen(this, minecraft.options)))); hx -= 6; }
        hx -= 84;
        addRenderableWidget(CirrusButton.of(hx, top + 2, 84, 20, Component.literal(favoritesOnly ? "Favorites: on" : "Favorites"), b -> { favoritesOnly = !favoritesOnly; dirty = true; b.setMessage(Component.literal(favoritesOnly ? "Favorites: on" : "Favorites")); }));

        // search
        search = new EditBox(font, cx + 24, searchY + 5, Math.max(40, cw - 32), 12, Component.literal("Search mods"));
        search.setBordered(false);
        search.addFormatter((value, cursor) -> CirrusUi.formatSearch(value));
        search.setHint(CirrusUi.small("Search mods…"));
        search.setValue(query);
        search.setResponder(v -> { query = v; dirty = true; scrollTarget = 0; });
        addRenderableWidget(search);

        // footer
        int fy = height - 14 - footerH;
        addRenderableWidget(CirrusButton.nav(cx, fy, 104, footerH, Component.literal("HUD Editor"), CirrusUi.ICON_HUD, b -> minecraft.setScreen(new HudEditorScreen(this))));
        addRenderableWidget(CirrusButton.primary(cx + cw - 72, fy, 72, footerH, Component.literal("Done"), b -> minecraft.setScreen(parent)));
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

    private int maxScroll() { return Math.max(0, entries().size() * (cardH + cardGap) - cardGap - (listBottom - listTop)); }
    private int cardTop(int index) { return listTop + index * (cardH + cardGap) - Math.round(scroll); }
    private int cardWidth() { return cw - 8; }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        float dt = clock.tick();
        scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget));
        scroll = Anim.approach(scroll, scrollTarget, dt, 16f);

        CirrusUi.panel(g, 6, 6, width - 12, height - 12, 16, t);
        // rail
        CirrusUi.card(g, railX, 14, railW, height - 28, 12, t.surface, t.border);
        boolean small = compact();
        int mark = small ? 16 : 22;
        CirrusUi.mark(g, railX + 10, 14 + 8, mark);
        // header
        CirrusUi.headingText(g, font, "MOD LIBRARY", cx + 2, 14 + 8, t.cyan);
        CirrusUi.smallText(g, font, category.label + "  ·  " + entries().size() + " available", cx + 2, 14 + 8 + 14, t.muted, false);
        // search field
        CirrusUi.card(g, cx, 14 + 28, cw, 22, 8, t.surface, search != null && search.isFocused() ? t.cyan : t.border);
        CirrusUi.icon(g, cx + 6, 14 + 28 + 4, 14, CirrusUi.ICON_SEARCH, t.cyan);

        // list
        var list = entries();
        g.enableScissor(cx, listTop, cx + cw, listBottom);
        int w = cardWidth();
        for (int i = 0; i < list.size(); i++) {
            int y = cardTop(i);
            if (y + cardH < listTop || y > listBottom) continue;
            drawCard(g, list.get(i), cx, y, w, mx, my, t, dt);
        }
        g.disableScissor();
        CirrusUi.scrollbar(g, cx + cw - 3, listTop, listBottom - listTop, maxScroll() == 0 ? 0 : scroll / maxScroll(), (float) (listBottom - listTop) / Math.max(1, list.size() * (cardH + cardGap)), t);
        if (list.isEmpty()) {
            int availH = listBottom - listTop;
            int artH = Math.min(110, availH - 26), artW = artH * 640 / 384;
            if (artH >= 40) {
                CirrusUi.emptyLibrary(g, cx + (cw - artW) / 2, listTop + 2, artW, artH);
                CirrusUi.centeredSmall(g, font, "No registered mods match these filters.", cx + cw / 2, listTop + artH + 8, t.muted);
            } else {
                CirrusUi.centeredSmall(g, font, "No registered mods match these filters.", cx + cw / 2, listTop + availH / 2 - 4, t.muted);
            }
        }
    }

    private void drawCard(GuiGraphics g, CirrusMod m, int x, int y, int w, int mx, int my, CirrusTheme t, float dt) {
        var cfg = config();
        boolean hover = mx >= x && mx < x + w && my >= Math.max(y, listTop) && my < Math.min(y + cardH, listBottom);
        boolean on = m.enabled(cfg);
        float prog = Anim.approach(toggles.getOrDefault(m.id(), on ? 1f : 0f), on ? 1f : 0f, dt, 14f);
        toggles.put(m.id(), prog);
        CirrusUi.card(g, x, y, w, cardH, 10, Gfx.mix(t.surface, t.accent, hover ? 0.18f : 0f), hover ? t.accent : t.border);
        int tile = cardH - 16, tx = x + 8, ty = y + (cardH - tile) / 2;
        Gfx.fillRound(g, tx, ty, tile, tile, 8, t.glow);
        int is = tile - 8;
        CirrusUi.icon(g, tx + (tile - is) / 2, ty + (tile - is) / 2, is, categoryIcon(m.category()), t.cyan);
        int textX = tx + tile + 8;
        int right = x + w - 10;
        int toggleX = right - 24;
        int starX = toggleX - 8 - 14;
        int textW = Math.max(30, starX - 8 - textX);
        CirrusUi.headingText(g, font, CirrusUi.fit(font, m.name(), textW, CirrusUi::heading), textX, y + 7, t.text);
        CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, m.category().label, textW), textX, y + 19, t.cyan, false);
        if (cardH >= 46) CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, m.description(), textW), textX, y + 31, t.muted, false);
        CirrusUi.toggle(g, toggleX, y + 8, on, prog, t);
        CirrusUi.icon(g, starX, y + 7, 14, CirrusUi.ICON_FAVORITE, m.favorite(cfg) ? 0xFFF5B942 : t.muted);
        if (m.hasSettings()) CirrusUi.rightSmall(g, font, "Settings  ›", right, y + cardH - 14, hover ? t.cyan : t.accent);
    }

    @Override public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        if (super.mouseClicked(event, doubleClick)) return true;
        double mx = event.x(), my = event.y();
        if (event.button() != 0 || mx < cx || mx >= cx + cardWidth() || my < listTop || my >= listBottom) return false;
        var list = entries();
        for (int i = 0; i < list.size(); i++) {
            int y = cardTop(i);
            if (my < y || my >= y + cardH) continue;
            var mod = list.get(i);
            int right = cx + cardWidth() - 10, toggleX = right - 24, starX = toggleX - 8 - 14;
            if (mx >= toggleX - 4) mod.setEnabled(config(), !mod.enabled(config()));
            else if (mx >= starX - 3) { mod.setFavorite(config(), !mod.favorite(config())); dirty = true; }
            else if (mod.hasSettings()) mod.openSettings(this);
            return true;
        }
        return false;
    }

    @Override public boolean mouseScrolled(double x, double y, double h, double v) {
        scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget - (float) (v * (cardH + cardGap) * 0.8)));
        return true;
    }

    private int categoryIcon(ModCategory value) {
        return switch (value) { case ALL -> CirrusUi.ICON_LIBRARY; case HUD -> CirrusUi.ICON_HUD; case PVP -> CirrusUi.ICON_PVP; case VISUALS -> CirrusUi.ICON_VISUALS; case PERFORMANCE -> CirrusUi.ICON_PERFORMANCE; case UTILITY -> CirrusUi.ICON_UTILITY; case INTERFACE -> CirrusUi.ICON_SETTINGS; };
    }
}
