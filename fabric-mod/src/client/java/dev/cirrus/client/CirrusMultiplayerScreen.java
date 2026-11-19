package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.dashboard.CirrusDashboard;
import dev.cirrus.client.dashboard.DashboardConfig;
import dev.cirrus.client.dashboard.ServerStatus;
import dev.cirrus.client.ui.Anim;
import dev.cirrus.client.ui.CirrusButton;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Gfx;
import dev.cirrus.client.ui.Glyphs;
import net.minecraft.client.Minecraft;
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

import java.util.ArrayList;
import java.util.List;

/**
 * Multiplayer in the Feather style: the dashboard's featured servers on top, the player's saved servers below, each row with
 * an icon tile, name, message of the day, player count and ping bars. Saved servers use the game's own ServerList, so they are
 * the same servers the vanilla screen shows.
 */
public final class CirrusMultiplayerScreen extends Screen {
    private record Row(boolean header, String label, String name, String address, int color, String tagline, ServerData target, int userIndex) {
        boolean selectable() { return !header && target != null; }
        boolean user() { return userIndex >= 0; }
    }

    private static final int ROW_H = 36, HEADER_H = 16;
    private final Screen parent;
    private ServerList servers;
    private final List<Row> rows = new ArrayList<>();
    private float scroll, scrollTarget;
    private int selected = -1;
    private int margin, listX, listW, listTop, listBottom;
    private CirrusButton join, edit, delete;
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
            rows.add(new Row(true, "Featured", null, null, 0, null, null, -1));
            for (DashboardConfig.Partner p : featured)
                rows.add(new Row(false, null, p.name(), p.address(), p.color(), p.tagline(), ServerStatus.data(p.name(), p.address()), -1));
        }
        rows.add(new Row(true, "Your servers", null, null, 0, null, null, -1));
        if (servers.size() == 0) rows.add(new Row(true, "No saved servers yet. Use Add or Direct to connect to one.", null, null, 0, null, null, -1));
        for (int i = 0; i < servers.size(); i++) {
            ServerData d = servers.get(i);
            rows.add(new Row(false, null, d.name, d.ip, colorFor(d.name), "", d, i));
        }
        for (Row r : rows) if (r.address() != null) ServerStatus.ensurePinged(r.name(), r.address());
        if (selected >= rows.size() || selected >= 0 && !rows.get(selected).selectable()) selected = -1;

        boolean small = width < 360 || height < 210;
        margin = small ? 8 : 14;
        listW = Math.min(width - margin * 2, 440);
        listX = (width - listW) / 2;
        int fy2 = height - margin - 20, fy1 = fy2 - 24;
        listTop = margin + 28;
        listBottom = fy1 - 6;

        addRenderableWidget(CirrusButton.icon(listX, margin, 22, CirrusUi.ICON_BACK, b -> onClose()));
        int half = (listW - 6) / 2;
        join = CirrusButton.primary(listX, fy1, half, 20, Component.literal("Join Server"), b -> joinSelected());
        addRenderableWidget(join);
        addRenderableWidget(CirrusButton.of(listX + half + 6, fy1, listW - half - 6, 20, Component.literal("Direct Connect"),
            b -> minecraft.setScreen(new CirrusServerEditScreen(this, CirrusServerEditScreen.Mode.DIRECT, servers, null))));
        int gap = 4, bw = (listW - gap * 4) / 5;
        addRenderableWidget(CirrusButton.of(listX, fy2, bw, 20, Component.literal("Add"), b -> minecraft.setScreen(new CirrusServerEditScreen(this, CirrusServerEditScreen.Mode.ADD, servers, null))));
        edit = CirrusButton.of(listX + (bw + gap), fy2, bw, 20, Component.literal("Edit"), b -> { Row r = selectedRow(); if (r != null && r.user()) minecraft.setScreen(new CirrusServerEditScreen(this, CirrusServerEditScreen.Mode.EDIT, servers, r.target())); });
        addRenderableWidget(edit);
        delete = CirrusButton.of(listX + (bw + gap) * 2, fy2, bw, 20, Component.literal("Delete"), b -> askDelete());
        addRenderableWidget(delete);
        addRenderableWidget(CirrusButton.of(listX + (bw + gap) * 3, fy2, bw, 20, Component.literal("Refresh"), b -> refresh()));
        addRenderableWidget(CirrusButton.of(listX + (bw + gap) * 4, fy2, listW - (bw + gap) * 4, 20, Component.literal("Back"), b -> onClose()));
        updateButtons();
        clampScroll();
    }

    private static int colorFor(String name) {
        int h = name == null ? 0 : name.hashCode();
        int[] palette = {0x1B8FFF, 0x42C8F5, 0x286FE8, 0x35D4C8, 0x5B8CFF, 0x2EA7E0};
        return palette[Math.floorMod(h, palette.length)];
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

    private void refresh() {
        for (Row r : rows) if (r.address() != null) ServerStatus.forceRefresh(r.name(), r.address());
    }

    // ---- geometry -----------------------------------------------------------------------------------------------

    private int rowHeight(Row r) { return r.header() ? HEADER_H : ROW_H; }
    private int contentHeight() { int h = 0; for (Row r : rows) h += rowHeight(r); return h; }
    private int maxScroll() { return Math.max(0, contentHeight() - (listBottom - listTop)); }
    private void clampScroll() { scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget)); scroll = Math.max(0, Math.min(maxScroll(), scroll)); }

    private int rowAt(double mx, double my) {
        if (mx < listX || mx >= listX + listW || my < listTop || my >= listBottom) return -1;
        int y = listTop - Math.round(scroll);
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
        scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget - (float) (v * ROW_H * 0.8)));
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
        int h = rowHeight(rows.get(index)), view = listBottom - listTop;
        if (y < scrollTarget) scrollTarget = y; else if (y + h > scrollTarget + view) scrollTarget = y + h - view;
        clampScroll();
    }

    @Override public void tick() { ServerStatus.tick(); }
    @Override public void onClose() { minecraft.setScreen(parent); }

    // ---- rendering ------------------------------------------------------------------------------------------------

    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) { CirrusUi.backdrop(g, width, height, theme()); }

    @Override public void render(GuiGraphics g, int mx, int my, float delta) {
        CirrusTheme t = theme();
        float dt = clock.tick();
        clampScroll();
        scroll = Anim.approach(scroll, scrollTarget, dt, 16f);
        CirrusUi.headingText(g, font, "Multiplayer", listX + 30, margin + 6, t.text);
        CirrusUi.rightSmall(g, font, servers.size() + (servers.size() == 1 ? " saved server" : " saved servers"), listX + listW, margin + 7, t.muted);

        g.enableScissor(listX - 2, listTop, listX + listW + 2, listBottom);
        int y = listTop - Math.round(scroll);
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            int h = rowHeight(r);
            if (y + h > listTop && y < listBottom) {
                if (r.header()) drawHeader(g, r, y, t);
                else drawRow(g, r, i, y, mx, my, t);
            }
            y += h;
        }
        g.disableScissor();
        CirrusUi.scrollbar(g, listX + listW + 4, listTop, listBottom - listTop, maxScroll() == 0 ? 0 : scroll / maxScroll(), (float) (listBottom - listTop) / Math.max(1, contentHeight()), t);
        super.render(g, mx, my, delta);
    }

    private void drawHeader(GuiGraphics g, Row r, int y, CirrusTheme t) {
        boolean info = r.label().length() > 14;
        if (info) CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, r.label(), listW), listX + 2, y + 2, t.muted, false);
        else {
            CirrusUi.smallText(g, font, r.label().toUpperCase(), listX + 2, y + 2, t.cyan, false);
            g.fill(listX + 4 + CirrusUi.smallWidth(font, r.label().toUpperCase()), y + 7, listX + listW, y + 8, Gfx.scaleAlpha(t.border, 0.6f));
        }
    }

    private void drawRow(GuiGraphics g, Row r, int index, int y, int mx, int my, CirrusTheme t) {
        boolean hover = mx >= listX && mx < listX + listW && my >= y && my < y + ROW_H - 3 && my >= listTop && my < listBottom;
        boolean sel = index == selected;
        int x = listX, w = listW, h = ROW_H - 3;
        Gfx.fillRound(g, x, y, w, h, 7, Gfx.mix(0xE60A0F1A, t.accent, sel ? 0.22f : hover ? 0.1f : 0f));
        Gfx.hairline(g, x + 7, y + 1, w - 14, Gfx.scaleAlpha(t.highlight, 1.4f));
        Gfx.strokeRound(g, x, y, w, h, 7, 0.5f, sel ? t.cyan : Gfx.mix(Gfx.scaleAlpha(t.border, 0.7f), t.cyan, hover ? 0.7f : 0f));

        int icon = 26, ix = x + 5, iy = y + (h - icon) / 2;
        Gfx.fillRound(g, ix, iy, icon, icon, 6, Gfx.mix(0xFF0A0F1A, 0xFF000000 | r.color(), 0.45f));
        CirrusUi.centeredHeading(g, font, monogram(r.name()), ix + icon / 2, iy + (icon - CirrusUi.LINE) / 2, 0xFFFFFFFF);

        ServerStatus.State state = ServerStatus.state(r.name(), r.address());
        int online = ServerStatus.online(r.name(), r.address()), max = ServerStatus.max(r.name(), r.address());
        long ping = ServerStatus.ping(r.name(), r.address());
        int dot = state == ServerStatus.State.ONLINE ? t.good : state == ServerStatus.State.CHECKING ? 0xFFE0A93B : 0xFF566176;
        Gfx.fillRound(g, ix + icon - 6, iy + icon - 6, 8, 8, 4, 0xFF070B14);
        Gfx.fillRound(g, ix + icon - 5, iy + icon - 5, 6, 6, 3, dot);

        // right side: ping bars and player count
        int rx = x + w - 8;
        int barsW = 14;
        int bars = state != ServerStatus.State.ONLINE ? 0 : ping < 150 ? 4 : ping < 300 ? 3 : ping < 600 ? 2 : 1;
        for (int b = 0; b < 4; b++) {
            int bh = 3 + b * 2;
            Gfx.fillRound(g, rx - barsW + b * 4, y + 6 + (9 - bh), 3, bh, 1, b < bars ? t.good : Gfx.scaleAlpha(t.muted, 0.35f));
        }
        String players = state == ServerStatus.State.ONLINE && online >= 0 ? online + " / " + max : state == ServerStatus.State.CHECKING ? "checking" : "offline";
        int pw = CirrusUi.smallWidth(font, players);
        CirrusUi.smallText(g, font, players, rx - barsW - 6 - pw, y + 6, state == ServerStatus.State.ONLINE ? t.text : t.muted, false);
        if (state == ServerStatus.State.ONLINE && ping > 0) CirrusUi.rightSmall(g, font, ping + " ms", rx, y + 18, t.muted);

        int tx = ix + icon + 8, tw = rx - barsW - 14 - pw - tx;
        CirrusUi.text(g, font, CirrusUi.fitBody(font, r.name(), Math.max(20, tw)), tx, y + 5, t.text, false);
        String motd = motdOf(r, state);
        CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, motd, Math.max(20, w - (tx - x) - 60)), tx, y + 18, t.muted, false);
    }

    private static String motdOf(Row r, ServerStatus.State state) {
        ServerData d = r.target();
        if (state == ServerStatus.State.ONLINE && d.motd != null) {
            String s = d.motd.getString().replace('\n', ' ').trim();
            if (!s.isEmpty()) return s;
        }
        if (!r.tagline().isEmpty()) return r.tagline();
        return r.address();
    }

    private static String monogram(String name) {
        StringBuilder sb = new StringBuilder();
        for (String part : name.trim().split("\\s+")) if (!part.isEmpty() && sb.length() < 2) sb.appendCodePoint(Character.toUpperCase(part.codePointAt(0)));
        return sb.length() == 0 ? "?" : sb.toString();
    }

    private CirrusTheme theme() { return CirrusTheme.current(CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath())); }
}
