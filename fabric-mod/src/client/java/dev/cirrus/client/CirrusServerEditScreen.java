package dev.cirrus.client;

import dev.cirrus.client.dashboard.DashboardParser;
import dev.cirrus.client.ui.CirrusButton;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Gfx;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.ConnectScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.ServerList;
import net.minecraft.client.multiplayer.resolver.ServerAddress;
import net.minecraft.network.chat.Component;

/** Add / edit / direct-connect form for the Multiplayer screen, in the Cirrus style. */
public final class CirrusServerEditScreen extends Screen {
    public enum Mode { ADD, EDIT, DIRECT }

    private final Screen parent;
    private final Mode mode;
    private final ServerData existing;
    private final ServerList servers;
    private EditBox nameBox, addressBox;
    private CirrusButton done;
    private int panelX, panelY, panelW, panelH;

    public CirrusServerEditScreen(Screen parent, Mode mode, ServerList servers, ServerData existing) {
        super(Component.literal(mode == Mode.ADD ? "Add server" : mode == Mode.EDIT ? "Edit server" : "Direct connect"));
        this.parent = parent;
        this.mode = mode;
        this.servers = servers;
        this.existing = existing;
    }

    @Override protected void init() {
        boolean named = mode != Mode.DIRECT;
        panelW = Math.min(280, width - 16);
        panelH = named ? 132 : 100;
        if (panelH > height - 8) panelH = height - 8;
        panelX = (width - panelW) / 2;
        panelY = (height - panelH) / 2;
        int fx = panelX + 14, fw = panelW - 28, y = panelY + 30;
        String oldName = nameBox == null ? (existing == null ? "" : existing.name) : nameBox.getValue();
        String oldAddr = addressBox == null ? (existing == null ? "" : existing.ip) : addressBox.getValue();
        if (named) {
            nameBox = new EditBox(font, fx + 6, y + 14, fw - 12, 10, Component.literal("Server name"));
            nameBox.setBordered(false);
            nameBox.setMaxLength(40);
            nameBox.setValue(oldName);
            nameBox.setResponder(v -> validate());
            addRenderableWidget(nameBox);
            y += 34;
        }
        addressBox = new EditBox(font, fx + 6, y + 14, fw - 12, 10, Component.literal("Server address"));
        addressBox.setBordered(false);
        addressBox.setMaxLength(260);
        addressBox.setValue(oldAddr);
        addressBox.setResponder(v -> validate());
        addRenderableWidget(addressBox);
        int by = panelY + panelH - 14 - 20, half = (fw - 6) / 2;
        done = CirrusButton.primary(fx, by, half, 20, Component.literal(mode == Mode.DIRECT ? "Connect" : "Done"), b -> submit());
        addRenderableWidget(done);
        addRenderableWidget(CirrusButton.of(fx + half + 6, by, half, 20, Component.literal("Cancel"), b -> onClose()));
        setInitialFocus(named ? nameBox : addressBox);
        validate();
    }

    private void validate() {
        if (done == null) return;
        boolean ok = DashboardParser.validAddress(addressBox.getValue().trim()) && (mode == Mode.DIRECT || !nameBox.getValue().isBlank());
        done.active = ok;
    }

    private void submit() {
        if (!done.active) return;
        String address = addressBox.getValue().trim();
        switch (mode) {
            case ADD -> { servers.add(new ServerData(nameBox.getValue().trim(), address, ServerData.Type.OTHER), false); servers.save(); minecraft.setScreen(parent); }
            case EDIT -> { existing.name = nameBox.getValue().trim(); existing.ip = address; servers.save(); minecraft.setScreen(parent); }
            case DIRECT -> ConnectScreen.startConnecting(parent, minecraft, ServerAddress.parseString(address), new ServerData("Direct connection", address, ServerData.Type.OTHER), false, null);
        }
    }

    @Override public boolean keyPressed(KeyEvent event) {
        if ((event.key() == 257 || event.key() == 335) && done != null && done.active) { submit(); return true; }
        return super.keyPressed(event);
    }

    @Override public void onClose() { minecraft.setScreen(parent); }

    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) { CirrusUi.backdrop(g, width, height, theme()); }

    @Override public void render(GuiGraphics g, int mx, int my, float delta) {
        CirrusTheme t = theme();
        CirrusUi.panel(g, panelX, panelY, panelW, panelH, 12, t);
        CirrusUi.headingText(g, font, getTitle().getString(), panelX + 14, panelY + 12, t.text);
        int fx = panelX + 14, y = panelY + 30;
        if (mode != Mode.DIRECT) { CirrusUi.smallText(g, font, "Name", fx, y, t.muted, false); y += 34; }
        CirrusUi.smallText(g, font, "Address  (host or host:port)", fx, y, t.muted, false);
        if (mode != Mode.DIRECT) field(g, nameBox, panelX + 14, panelY + 40, panelW - 28, t);
        field(g, addressBox, panelX + 14, panelY + 40 + (mode != Mode.DIRECT ? 34 : 0), panelW - 28, t);
        super.render(g, mx, my, delta);
    }

    private void field(GuiGraphics g, EditBox box, int x, int y, int w, CirrusTheme t) {
        Gfx.fillRound(g, x, y, w, 18, 6, 0xF0070B14);
        Gfx.strokeRound(g, x, y, w, 18, 6, box.isFocused() ? 1f : 0.5f, box.isFocused() ? t.cyan : Gfx.scaleAlpha(t.border, 0.9f));
    }

    private CirrusTheme theme() { return CirrusTheme.DARK; }   // main-menu screens keep the dark Cirrus identity in every theme
}
