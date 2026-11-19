package dev.cirrus.client;

import dev.cirrus.client.asset.CirrusAssetTextures;
import dev.cirrus.client.dashboard.CirrusDashboard;
import dev.cirrus.client.dashboard.DashboardConfig;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Gfx;
import dev.cirrus.client.ui.Glyphs;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.multiplayer.ServerSelectionList;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.network.chat.Component;
import org.lwjgl.glfw.GLFW;

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
        boolean shift = (event.modifiers() & GLFW.GLFW_MOD_SHIFT) != 0;
        boolean vertical = event.key() == GLFW.GLFW_KEY_UP || event.key() == GLFW.GLFW_KEY_DOWN;
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
            Glyphs.draw(g, Glyphs.STAR, nameX + markW + 2, ty - 1, 10, STAR);
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
            Gfx.fillRound(g, startX, startY + 1, startW, startH, 4, 0x66000000);
            Gfx.fillRound(g, startX, startY, startW, startH, 4, over ? 0xFF42C8F5 : 0xFF286FE8);
            Gfx.strokeRound(g, startX, startY, startW, startH, 4, 0.5f, over ? 0xFFFFFFFF : 0xFF42C8F5);
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
