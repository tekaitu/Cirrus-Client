package dev.cirrus.client;

import dev.cirrus.client.dashboard.CirrusDashboard;
import dev.cirrus.client.dashboard.DashboardConfig;
import dev.cirrus.client.dashboard.ServerStatus;
import dev.cirrus.client.ui.Anim;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Gfx;
import dev.cirrus.client.ui.Glyphs;
import dev.cirrus.client.ui.MenuButton;
import dev.cirrus.client.ui.SceneScreen;
import dev.cirrus.client.ui.ServerIcons;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.ConfirmScreen;
import net.minecraft.client.gui.screens.ConnectScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.ServerList;
import net.minecraft.client.multiplayer.resolver.ServerAddress;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;

import java.util.ArrayList;
import java.util.List;

/**
 * Cirrus Multiplayer: Minecraft panorama background, a card list with the dashboard's official partner servers (gold star,
 * accent bar) above the player's own saved servers, favicons, MOTD, player count, ping bars and a clear icon footer. Saved
 * servers still live in the game's own {@link ServerList}, and every vanilla action (join, direct connect, add, edit, delete,
 * refresh, keyboard and double-click join) is kept.
 */
public final class CirrusMultiplayerScreen extends SceneScreen {
    private static final int STAR = 0xFFFFC857;

    private enum Kind { HEADER, EMPTY, SERVER }
    private record Row(Kind kind, String label, String name, String address, int color, String tagline, ServerData target, int userIndex, boolean partner) {
        boolean selectable() { return kind == Kind.SERVER && target != null; }
        boolean user() { return userIndex >= 0; }
    }

    private final Screen parent;
    private ServerList servers;
    private final List<Row> rows = new ArrayList<>();
    private float[] hover = new float[0];
    private final ServerIcons icons = new ServerIcons();
    private float scroll, scrollTarget;
    private int selected = -1;
    private int margin, listX, listW, panelTop, panelBottom, rowH, cardH, iconSize;
    private MenuButton join, edit, delete;
    private final Anim.Clock clock = new Anim.Clock();
    private long lastClickAt; private int lastClickRow = -1;

    public CirrusMultiplayerScreen(Screen parent) {
        super(Component.literal("Multiplayer"));
        this.parent = parent;
    }

    @Override protected void init() {
        servers = new ServerList(minecraft);
        servers.load();
        rows.clear();
        List<DashboardConfig.Partner> featured = CirrusDashboard.get().partners().stream().filter(DashboardConfig.Partner::featured).toList();
        if (!featured.isEmpty()) {
            rows.add(new Row(Kind.HEADER, "Cirrus partners", null, null, 0, null, null, -1, true));
            for (DashboardConfig.Partner p : featured)
                rows.add(new Row(Kind.SERVER, null, p.name(), p.address(), p.color(), p.tagline(), ServerStatus.data(p.name(), p.address()), -1, true));
        }
        rows.add(new Row(Kind.HEADER, "Your servers", null, null, 0, null, null, -1, false));
        if (servers.size() == 0) rows.add(new Row(Kind.EMPTY, "No saved servers yet", null, null, 0, "Use Add or Direct Connect below.", null, -1, false));
        for (int i = 0; i < servers.size(); i++) {
            ServerData d = servers.get(i);
            rows.add(new Row(Kind.SERVER, null, d.name, d.ip, colorFor(d.name), "", d, i, false));
        }
        for (Row r : rows) if (r.address() != null) ServerStatus.ensurePinged(r.name(), r.address());
        if (selected >= rows.size() || selected >= 0 && !rows.get(selected).selectable()) selected = -1;
        if (hover.length != rows.size()) hover = new float[rows.size()];

        boolean small = width < 360 || height < 210;
        margin = small ? 8 : 14;
        rowH = small ? 36 : 46;
        cardH = rowH - 4;
        iconSize = cardH - 8;
        listW = Math.min(width - margin * 2, 480);
        listX = (width - listW) / 2;
        int bh = small ? 20 : 22;
        int fy2 = height - margin - bh, fy1 = fy2 - bh - 4;
        panelTop = margin + 30;
        panelBottom = fy1 - 8;

        addRenderableWidget(MenuButton.square(listX, margin, 24, Glyphs.BACK, "Back", b -> onClose()));
        int half = (listW - 6) / 2;
        join = MenuButton.primary(listX, fy1, half, bh, "Join Server", Glyphs.MULTIPLAYER, b -> joinSelected());
        addRenderableWidget(join);
        addRenderableWidget(MenuButton.action(listX + half + 6, fy1, listW - half - 6, bh, "Direct Connect", Glyphs.EXTERNAL,
            b -> minecraft.setScreen(new CirrusServerEditScreen(this, CirrusServerEditScreen.Mode.DIRECT, servers, null))));
        int gap = 4, bw = (listW - gap * 4) / 5;
        addRenderableWidget(MenuButton.action(listX, fy2, bw, bh, "Add", Glyphs.ADD, b -> minecraft.setScreen(new CirrusServerEditScreen(this, CirrusServerEditScreen.Mode.ADD, servers, null))));
        edit = MenuButton.action(listX + (bw + gap), fy2, bw, bh, "Edit", Glyphs.EDIT, b -> { Row r = selectedRow(); if (r != null && r.user()) minecraft.setScreen(new CirrusServerEditScreen(this, CirrusServerEditScreen.Mode.EDIT, servers, r.target())); });
        addRenderableWidget(edit);
        delete = MenuButton.action(listX + (bw + gap) * 2, fy2, bw, bh, "Delete", Glyphs.DELETE, b -> askDelete());
        addRenderableWidget(delete);
        addRenderableWidget(MenuButton.action(listX + (bw + gap) * 3, fy2, bw, bh, "Refresh", Glyphs.REFRESH, b -> refresh()));
        addRenderableWidget(MenuButton.action(listX + (bw + gap) * 4, fy2, listW - (bw + gap) * 4, bh, "Back", Glyphs.BACK, b -> onClose()));
        updateButtons();
        clampScroll();
    }

    private static int colorFor(String name) {
        int[] palette = {0x1B8FFF, 0x42C8F5, 0x286FE8, 0x35D4C8, 0x5B8CFF, 0x2EA7E0};
        return palette[Math.floorMod(name == null ? 0 : name.hashCode(), palette.length)];
    }

    private Row selectedRow() { return selected >= 0 && selected < rows.size() ? rows.get(selected) : null; }

    private void updateButtons() {
        Row r = selectedRow();
        join.active = r != null && r.selectable();
        edit.active = r != null && r.user();
        delete.active = r != null && r.user();
    }

    private void joinSelected() {
        Row r = selectedRow();
        if (r == null || !r.selectable()) return;
        ServerData data = r.target();
        ConnectScreen.startConnecting(this, minecraft, ServerAddress.parseString(data.ip), data, false, null);
    }

    private void askDelete() {
        Row r = selectedRow();
        if (r == null || !r.user()) return;
        minecraft.setScreen(new ConfirmScreen(yes -> {
            if (yes) { servers.remove(r.target()); servers.save(); selected = -1; }
            minecraft.setScreen(this);
        }, Component.literal("Delete this server?"), Component.literal(r.name() + " will be removed from your server list.")));
    }

    private void refresh() { for (Row r : rows) if (r.address() != null) ServerStatus.forceRefresh(r.name(), r.address()); }

    // ---- geometry -----------------------------------------------------------------------------------------------

    private int rowHeight(Row r) { return switch (r.kind()) { case HEADER -> 20; case EMPTY -> rowH; case SERVER -> rowH; }; }
    private int contentHeight() { int h = 0; for (Row r : rows) h += rowHeight(r); return h; }
    private int viewTop() { return panelTop + 6; }
    private int viewBottom() { return panelBottom - 6; }
    private int maxScroll() { return Math.max(0, contentHeight() - (viewBottom() - viewTop())); }
    private void clampScroll() { scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget)); scroll = Math.max(0, Math.min(maxScroll(), scroll)); }
    private int rowX() { return listX + 6; }
    private int rowW() { return listW - 12 - 6; }

    private int rowAt(double mx, double my) {
        if (mx < rowX() || mx >= rowX() + rowW() || my < viewTop() || my >= viewBottom()) return -1;
        int y = viewTop() - Math.round(scroll);
        for (int i = 0; i < rows.size(); i++) {
            int h = rowHeight(rows.get(i));
            if (my >= y && my < y + h) return i;
            y += h;
        }
        return -1;
    }

    // ---- input ---------------------------------------------------------------------------------------------------

    @Override public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        if (super.mouseClicked(event, doubleClick)) return true;
        int i = rowAt(event.x(), event.y());
        if (i >= 0 && rows.get(i).selectable()) {
            long now = System.currentTimeMillis();
            boolean again = i == lastClickRow && now - lastClickAt < 350;
            selected = i; lastClickRow = i; lastClickAt = now;
            updateButtons();
            if (again || doubleClick) joinSelected();
            return true;
        }
        return false;
    }

    @Override public boolean mouseScrolled(double x, double y, double h, double v) {
        scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget - (float) (v * rowH * 0.8)));
        return true;
    }

    @Override public boolean keyPressed(KeyEvent event) {
        int key = event.key();
        if (key == 264 || key == 265) {           // down / up
            int dir = key == 264 ? 1 : -1, i = selected;
            do { i += dir; } while (i >= 0 && i < rows.size() && !rows.get(i).selectable());
            if (i >= 0 && i < rows.size()) { selected = i; updateButtons(); ensureVisible(i); }
            return true;
        }
        if ((key == 257 || key == 335) && selectedRow() != null) { joinSelected(); return true; }
        return super.keyPressed(event);
    }

    private void ensureVisible(int index) {
        int y = 0;
        for (int i = 0; i < index; i++) y += rowHeight(rows.get(i));
        int h = rowHeight(rows.get(index)), view = viewBottom() - viewTop();
        if (y < scrollTarget) scrollTarget = y; else if (y + h > scrollTarget + view) scrollTarget = y + h - view;
        clampScroll();
    }

    @Override public void tick() { ServerStatus.tick(); }
    @Override public void onClose() { minecraft.setScreen(parent); }
    @Override public void removed() { icons.release(); }

    // ---- rendering ------------------------------------------------------------------------------------------------

    @Override public void render(GuiGraphics g, int mx, int my, float delta) {
        CirrusTheme t = CirrusTheme.DARK;
        float dt = clock.tick();
        clampScroll();
        scroll = Anim.approach(scroll, scrollTarget, dt, 16f);
        CirrusUi.headingText(g, font, "Multiplayer", listX + 34, margin + 6, t.text);
        int saved = servers.size();
        CirrusUi.rightSmall(g, font, saved + (saved == 1 ? " saved server" : " saved servers"), listX + listW, margin + 8, Gfx.scaleAlpha(t.text, 0.75f));

        Gfx.fillRound(g, listX, panelTop, listW, panelBottom - panelTop, 10, 0xB8060B16);
        Gfx.hairline(g, listX + 10, panelTop + 1, listW - 20, Gfx.scaleAlpha(t.highlight, 1.4f));
        Gfx.strokeRound(g, listX, panelTop, listW, panelBottom - panelTop, 10, 0.5f, Gfx.scaleAlpha(t.border, 0.8f));

        g.enableScissor(listX + 1, viewTop(), listX + listW - 1, viewBottom());
        int y = viewTop() - Math.round(scroll);
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            int h = rowHeight(r);
            boolean hovered = mx >= rowX() && mx < rowX() + rowW() && my >= y && my < y + cardH && my >= viewTop() && my < viewBottom() && r.selectable();
            hover[i] = Anim.approach(hover[i], hovered ? 1f : 0f, dt, 18f);
            if (y + h > viewTop() && y < viewBottom()) {
                switch (r.kind()) {
                    case HEADER -> drawHeader(g, r, y, t);
                    case EMPTY -> drawEmpty(g, r, y, t);
                    case SERVER -> drawServer(g, r, i, y, t);
                }
            }
            y += h;
        }
        g.disableScissor();
        if (maxScroll() > 0) CirrusUi.scrollbar(g, listX + listW - 5, viewTop(), viewBottom() - viewTop(), scroll / maxScroll(), (float) (viewBottom() - viewTop()) / Math.max(1, contentHeight()), t);
        super.render(g, mx, my, delta);
    }

    private void drawHeader(GuiGraphics g, Row r, int y, CirrusTheme t) {
        int x = rowX() + 2;
        int glyph = r.partner() ? Glyphs.STAR : Glyphs.SERVER;
        Glyphs.draw(g, glyph, x, y + 3, 10, r.partner() ? STAR : t.cyan);
        String label = r.label().toUpperCase();
        CirrusUi.smallText(g, font, label, x + 14, y + 5, r.partner() ? t.cyan : Gfx.mix(t.muted, t.cyan, 0.5f), false);
        g.fill(x + 18 + CirrusUi.smallWidth(font, label), y + 10, rowX() + rowW(), y + 11, Gfx.scaleAlpha(t.border, 0.55f));
    }

    private void drawEmpty(GuiGraphics g, Row r, int y, CirrusTheme t) {
        int x = rowX(), w = rowW();
        Gfx.strokeRound(g, x, y, w, cardH, 8, 0.5f, Gfx.scaleAlpha(t.border, 0.6f));
        int s = Math.max(14, cardH - 16);
        Glyphs.draw(g, Glyphs.SERVER, x + 10, y + (cardH - s) / 2, s, Gfx.scaleAlpha(t.muted, 0.7f));
        CirrusUi.text(g, font, r.label(), x + 10 + s + 10, y + cardH / 2 - 10, t.text, false);
        CirrusUi.smallText(g, font, r.tagline(), x + 10 + s + 10, y + cardH / 2 + 2, t.muted, false);
    }

    private void drawServer(GuiGraphics g, Row r, int index, int y, CirrusTheme t) {
        float hv = hover[index];
        boolean sel = index == selected;
        int x = rowX(), w = rowW(), h = cardH;
        int base = r.partner() ? 0xE00A1428 : 0xE00A0F1A;                                   // partners sit on a slightly bluer card
        Gfx.fillRound(g, x, y, w, h, 8, Gfx.mix(Gfx.mix(base, t.accent, sel ? 0.2f : 0.09f * hv), 0xFF000000, 0f));
        Gfx.hairline(g, x + 8, y + 1, w - 16, Gfx.scaleAlpha(t.highlight, 1.2f));
        int edge = sel ? t.cyan : Gfx.mix(Gfx.scaleAlpha(t.border, 0.65f), t.cyan, hv * 0.8f);
        Gfx.strokeRound(g, x, y, w, h, 8, sel ? 1f : 0.5f, edge);
        if (r.partner() || sel) Gfx.fillRound(g, x + 1.5f, y + 8, 2.5f, h - 16, 1.25f, r.partner() ? t.cyan : t.accent);

        ServerStatus.State state = ServerStatus.state(r.name(), r.address());
        int online = ServerStatus.online(r.name(), r.address()), max = ServerStatus.max(r.name(), r.address());
        long ping = ServerStatus.ping(r.name(), r.address());

        // icon: the server's favicon when it sent one, otherwise a monogram (partners) or a server glyph (personal)
        int ix = x + 9, iy = y + (h - iconSize) / 2;
        byte[] favicon = ServerStatus.data(r.name(), r.address()).getIconBytes();
        if (favicon == null && r.target() != null) favicon = r.target().getIconBytes();
        Identifier tex = icons.get(r.address(), favicon);
        if (tex != null) {
            Gfx.fillRound(g, ix - 1, iy - 1, iconSize + 2, iconSize + 2, 4, Gfx.scaleAlpha(t.border, 0.9f));
            Gfx.region(g, tex, ix, iy, iconSize, iconSize, 0, 0, 64, 64, 64, 64, 0xFFFFFFFF);
        } else if (r.partner()) {
            Gfx.fillRound(g, ix, iy, iconSize, iconSize, 6, Gfx.mix(0xFF0A0F1A, 0xFF000000 | r.color(), 0.5f));
            CirrusUi.centeredFit(g, font, monogram(r.name()), ix + iconSize / 2, iy + iconSize / 2, iconSize - 4, 0xFFFFFFFF);
        } else {
            Gfx.fillRound(g, ix, iy, iconSize, iconSize, 6, 0xFF101A2C);
            Gfx.strokeRound(g, ix, iy, iconSize, iconSize, 6, 0.5f, Gfx.scaleAlpha(t.border, 0.9f));
            int gs = iconSize * 5 / 9;
            Glyphs.draw(g, Glyphs.SERVER, ix + (iconSize - gs) / 2, iy + (iconSize - gs) / 2, gs, t.muted);
        }

        // right column: status + players on the first line, ping bars + latency on the second
        int rx = x + w - 10;
        int dot = state == ServerStatus.State.ONLINE ? t.good : state == ServerStatus.State.CHECKING ? 0xFFE0A93B : 0xFF566176;
        String players = state == ServerStatus.State.ONLINE ? (online >= 0 ? online + " / " + max : "Online") : state == ServerStatus.State.CHECKING ? "Checking" : "Offline";
        int pw = CirrusUi.smallWidth(font, players);
        int line1 = y + h / 2 - 11, line2 = y + h / 2 + 3;
        CirrusUi.smallText(g, font, players, rx - pw, line1, state == ServerStatus.State.ONLINE ? t.text : t.muted, false);
        Gfx.fillRound(g, rx - pw - 10, line1 + 3, 6, 6, 3, dot);
        int barsW = 14;
        int bars = state != ServerStatus.State.ONLINE ? 0 : ping < 150 ? 4 : ping < 300 ? 3 : ping < 600 ? 2 : 1;
        int barColor = bars >= 3 ? t.good : 0xFFE0A93B;
        for (int b = 0; b < 4; b++) {
            int bh = 3 + b * 2;
            Gfx.fillRound(g, rx - barsW + b * 4, line2 + (9 - bh), 3, bh, 1, b < bars ? barColor : Gfx.scaleAlpha(t.muted, 0.3f));
        }
        if (state == ServerStatus.State.ONLINE && ping > 0) CirrusUi.rightSmall(g, font, ping + " ms", rx - barsW - 4, line2, t.muted);
        int rightCol = Math.max(pw + 12, barsW + 4 + (ping > 0 ? CirrusUi.smallWidth(font, ping + " ms") : 0)) + 14;

        // name (+ gold star and PARTNER tag for official partners) and message of the day
        int tx = ix + iconSize + 10, tw = Math.max(24, rx - rightCol - tx);
        int nameY = y + h / 2 - 11;
        int nameW = CirrusUi.bodyWidth(font, r.name());
        int extra = r.partner() ? 14 : 0;
        CirrusUi.text(g, font, CirrusUi.fitBody(font, r.name(), Math.max(20, tw - extra)), tx, nameY, t.text, false);
        if (r.partner()) {
            int sx = tx + Math.min(nameW, Math.max(20, tw - extra)) + 4;
            Glyphs.draw(g, Glyphs.STAR, sx, nameY, 10, STAR);
            int tagX = sx + 14;
            if (tagX + 44 < tx + tw && w > 300) {
                Gfx.fillRound(g, tagX, nameY + 1, 42, 9, 4.5f, Gfx.scaleAlpha(t.cyan, 0.16f));
                CirrusUi.centeredSmall(g, font, "PARTNER", tagX + 21, nameY + 1, t.cyan);
            }
        }
        CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, motdOf(r, state), tw), tx, y + h / 2 + 3, t.muted, false);
    }

    private String motdOf(Row r, ServerStatus.State state) {
        ServerData d = ServerStatus.data(r.name(), r.address());
        if (state == ServerStatus.State.ONLINE && d.motd != null) {
            String s = d.motd.getString().replace('\n', ' ').trim();
            if (!s.isEmpty()) return s;
        }
        if (r.tagline() != null && !r.tagline().isEmpty()) return r.tagline();
        return r.address();
    }

    private static String monogram(String name) {
        StringBuilder sb = new StringBuilder();
        for (String part : name.trim().split("\\s+")) if (!part.isEmpty() && sb.length() < 2) sb.appendCodePoint(Character.toUpperCase(part.codePointAt(0)));
        return sb.length() == 0 ? "?" : sb.toString();
    }
}
