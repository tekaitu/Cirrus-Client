package dev.cirrus.client;



import dev.cirrus.core.input.Keys;
import dev.cirrus.core.render.Icons;
import dev.cirrus.client.asset.CirrusAssetTextures;
import dev.cirrus.client.dashboard.CirrusDashboard;
import dev.cirrus.client.dashboard.DashboardConfig;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Gfx;
import dev.cirrus.client.ui.Glyphs;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.multiplayer.ServerSelectionList;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.contents.TranslatableContents;

import java.util.ArrayList;
import java.util.List;

/**
 * Minecraft's own Multiplayer screen, unchanged, with the Cirrus partner servers from the dashboard appended to its list.
 *
 * <ul>
 *   <li>Everything vanilla keeps working: saved servers, Direct Connection, Add / Edit / Delete, Refresh, Back, LAN servers.</li>
 *   <li>Partner rows are real server-list rows (so they ping and connect through Minecraft's own code). They are never written
 *       to {@code servers.dat}, cannot be edited or deleted, and show the Cirrus mark and a star before the name.</li>
 *   <li>The one partner the dashboard advertises gets an outline and a START button that connects immediately.</li>
 * </ul>
 * The list of partners and the advertised server come only from {@link CirrusDashboard}; with no dashboard data this screen is
 * exactly the vanilla one.
 */
public class CirrusJoinMultiplayerScreen extends JoinMultiplayerScreen {
    private static final int STAR = 0xFFFFC94D, ACCENT = 0xFF42C8F5;
    private static final Component EDIT = Component.translatable("selectServer.edit"), DELETE = Component.translatable("selectServer.delete");

    private final List<PartnerEntry> partnerEntries = new ArrayList<>();
    private DashboardConfig applied;
    private ServerSelectionList appliedList;

    public CirrusJoinMultiplayerScreen(Screen parent) { super(parent); }

    @Override protected void init() {
        super.init();
        syncPartners();
        onSelectedChange();
    }

    @Override public void tick() {
        super.tick();
        syncPartners();
    }

    @Override public void render(GuiGraphics g, int mouseX, int mouseY, float delta) {
        syncPartners();
        for (PartnerEntry e : partnerEntries) e.startVisible = false;
        super.render(g, mouseX, mouseY, delta);
        drawBlackButtons(g);
    }

    /**
     * The only visual change to the vanilla screen besides the partner rows: its buttons are drawn black with white text and a
     * white icon. Layout, sizes, behaviour, enabled states and tooltips are all still Minecraft's own.
     */
    private void drawBlackButtons(GuiGraphics g) {
        var font = Minecraft.getInstance().font;
        for (var child : this.children()) {
            if (!(child instanceof Button b) || !b.visible) continue;
            int x = b.getX(), y = b.getY(), w = b.getWidth(), h = b.getHeight();
            boolean lit = b.active && b.isHoveredOrFocused();
            g.fill(x, y, x + w, y + h, 0xFF000000);
            int edge = !b.active ? 0xFF2A2F38 : lit ? 0xFFFFFFFF : 0xFF4A515E;
            g.renderOutline(x, y, w, h, edge);
            int color = b.active ? 0xFFFFFFFF : 0xFF6B7280;
            Component label = b.getMessage();
            int icon = iconFor(label);
            int textW = font.width(label), iconW = icon >= 0 && textW + 22 <= w ? 10 : 0;
            int total = textW + (iconW > 0 ? iconW + 4 : 0), left = x + (w - total) / 2, ty = y + (h - 8) / 2;
            if (iconW > 0) { Glyphs.draw(g, icon, left, y + (h - 10) / 2, 10, color); left += iconW + 4; }
            g.drawString(font, label, left, ty, color, false);
        }
    }

    private static int iconFor(Component label) {
        if (!(label.getContents() instanceof TranslatableContents tc)) return -1;
        return switch (tc.getKey()) {
            case "selectServer.select" -> Icons.MULTIPLAYER;
            case "selectServer.direct" -> Icons.GLOBE;
            case "selectServer.add" -> Icons.ADD;
            case "selectServer.edit" -> Icons.EDIT;
            case "selectServer.delete" -> Icons.DELETE;
            case "selectServer.refresh" -> Icons.REFRESH;
            case "gui.back" -> Icons.BACK;
            default -> -1;
        };
    }

    /** The START button can sit outside the row, where the list does not deliver clicks, so the screen handles it. */
    @Override public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        ServerSelectionList list = this.serverSelectionList;
        if (list != null && event.button() == 0) {
            for (PartnerEntry e : partnerEntries) {
                if (e.hitsStart(event.x(), event.y(), list.getY(), list.getY() + list.getHeight())) {
                    join(e.serverData());
                    return true;
                }
            }
        }
        return super.mouseClicked(event, doubleClick);
    }

    /** Appends the partner rows to the list; repeated whenever vanilla rebuilt the list or the dashboard changed. */
    private void syncPartners() {
        ServerSelectionList list = this.serverSelectionList;
        if (list == null) return;
        DashboardConfig cfg = CirrusDashboard.get();
        boolean present = !partnerEntries.isEmpty() && list.children().contains(partnerEntries.get(0));
        if (cfg == applied && list == appliedList && (present || cfg.partners().isEmpty())) return;
        for (PartnerEntry e : partnerEntries) if (list.children().contains(e)) list.removeEntry(e);
        partnerEntries.clear();
        DashboardConfig.Advertised ad = cfg.advertised();
        for (DashboardConfig.Partner p : cfg.partners()) {
            boolean advertised = ad != null && ad.partnerId().equals(p.id());
            PartnerEntry e = new PartnerEntry(list, this, p, advertised, advertised && ad.startButton() ? ad.label() : "");
            partnerEntries.add(e);
            list.addEntry(e);
        }
        applied = cfg;
        appliedList = list;
        onSelectedChange();
    }

    /** Partner rows are managed by the dashboard, so the Edit and Delete buttons stay off while one is selected. */
    @Override protected void onSelectedChange() {
        super.onSelectedChange();
        if (this.serverSelectionList == null || !(this.serverSelectionList.getSelected() instanceof PartnerEntry)) return;
        for (var child : this.children()) {
            if (child instanceof AbstractWidget w && (EDIT.equals(w.getMessage()) || DELETE.equals(w.getMessage()))) w.active = false;
        }
    }

    /** Vanilla reorders saved servers with Shift+Up/Down by list index; that must never touch partner rows. */
    @Override public boolean keyPressed(KeyEvent event) {
        boolean shift = (event.modifiers() & Keys.MOD_SHIFT) != 0;
        boolean vertical = event.key() == Keys.UP || event.key() == Keys.DOWN;
        if (shift && vertical && this.serverSelectionList != null && this.serverSelectionList.getSelected() instanceof PartnerEntry) return true;
        return super.keyPressed(event);
    }

    /** A partner row: a normal vanilla server row plus the Cirrus mark, a star and (when advertised) a START button. */
    static final class PartnerEntry extends ServerSelectionList.OnlineServerEntry {
        private static final int MARK_H = 8, GAP = 3, START_W = 46, START_H = 18;
        private final JoinMultiplayerScreen screen;
        private final ServerData data;
        private final boolean advertised;
        private final String startLabel;
        private final String partnerName;
        private final int markW = (MARK_H * 640 + 236) / 473;
        private int startX, startY, startW, startH;
        boolean startVisible;

        PartnerEntry(ServerSelectionList list, JoinMultiplayerScreen screen, DashboardConfig.Partner partner, boolean advertised, String startLabel) {
            list.super(screen, new ServerData(partner.name(), partner.address(), ServerData.Type.OTHER));
            this.screen = screen;
            this.data = getServerData();
            this.advertised = advertised;
            this.startLabel = startLabel;
            this.partnerName = partner.name();
            // Reserve room before the name (vanilla draws it at a fixed offset) for the Cirrus mark and the star.
            int space = Math.max(1, Minecraft.getInstance().font.width(" "));
            int reserve = markW + 2 + 9 + GAP;
            this.data.name = " ".repeat((reserve + space - 1) / space) + partner.name();
        }

        @Override public void renderContent(GuiGraphics g, int mouseX, int mouseY, boolean hovered, float delta) {
            int x = getContentX(), y = getContentY(), w = getContentWidth(), h = getContentHeight();
            if (advertised) {
                Gfx.fillRound(g, x - 3, y - 3, w + 6, h + 6, 3, 0x2442C8F5);
                Gfx.strokeRound(g, x - 3, y - 3, w + 6, h + 6, 3, 1f, ACCENT);
            }
            super.renderContent(g, mouseX, mouseY, hovered, delta);
            int nameX = x + 32 + 3, ty = y + 1;
            CirrusAssetTextures.drawMark(g, nameX, ty, markW, MARK_H, 0xFFFFFFFF);
            Glyphs.draw(g, Icons.STAR, nameX + markW + 2, ty - 1, 10, STAR);
            if (mouseX >= nameX && mouseX < nameX + markW + 2 + 10 && mouseY >= ty - 1 && mouseY < ty + 9) {
                g.setTooltipForNextFrame(Component.literal("Official Cirrus partner server"), mouseX, mouseY);
            }
            if (!startLabel.isEmpty()) drawStart(g, mouseX, mouseY, x, y, w, h);
        }

        private void drawStart(GuiGraphics g, int mouseX, int mouseY, int x, int y, int w, int h) {
            var font = Minecraft.getInstance().font;
            int screenW = Minecraft.getInstance().getWindow().getGuiScaledWidth();
            boolean outside = x + w + 6 + START_W + 4 <= screenW;
            startW = outside ? START_W : 40;
            startH = outside ? START_H : 13;
            startX = outside ? x + w + 6 : x + w - startW - 3;
            startY = outside ? y + (h - startH) / 2 : y + h - startH - 1;
            startVisible = true;
            boolean over = mouseX >= startX && mouseX < startX + startW && mouseY >= startY && mouseY < startY + startH;
            g.fill(startX, startY, startX + startW, startY + startH, 0xFF000000);
            g.renderOutline(startX, startY, startW, startH, over ? 0xFFFFFFFF : ACCENT);
            String label = CirrusUi.fitBody(font, startLabel, startW - 6);
            CirrusUi.centered(g, font, label, startX + startW / 2, startY + (startH - CirrusUi.LINE) / 2, 0xFFFFFFFF);
            if (over) g.setTooltipForNextFrame(Component.literal("Connect to " + partnerName), mouseX, mouseY);
        }

        ServerData serverData() { return data; }

        boolean hitsStart(double mx, double my, int listTop, int listBottom) {
            return startVisible && startY >= listTop && startY + startH <= listBottom
                && mx >= startX && mx < startX + startW && my >= startY && my < startY + startH;
        }

        @Override public Component getNarration() {
            return Component.literal("Official Cirrus partner server ").append(super.getNarration());
        }
    }
}
