package dev.cirrus.client;

import dev.cirrus.client.dashboard.DashboardParser;
import dev.cirrus.client.ui.CirrusTextField;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Gfx;
import dev.cirrus.client.ui.Glyphs;
import dev.cirrus.client.ui.MenuButton;
import dev.cirrus.client.ui.SceneScreen;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.ConnectScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.ServerList;
import net.minecraft.client.multiplayer.resolver.ServerAddress;
import net.minecraft.network.chat.Component;

/** Add / edit / direct-connect dialog in the Cirrus style, with inline validation feedback on each field. */
public final class CirrusServerEditScreen extends SceneScreen {
    public enum Mode { ADD, EDIT, DIRECT }
    private static final int WARN = 0xFFE0A93B;

    private final Screen parent;
    private final Mode mode;
    private final ServerData existing;
    private final ServerList servers;
    private EditBox nameBox, addressBox;
    private MenuButton done;
    private boolean nameTouched, addressTouched;
    private int panelX, panelY, panelW, panelH, fieldX, fieldW, nameY, addressY;

    public CirrusServerEditScreen(Screen parent, Mode mode, ServerList servers, ServerData existing) {
        super(Component.literal(mode == Mode.ADD ? "Add server" : mode == Mode.EDIT ? "Edit server" : "Direct connect"));
        this.parent = parent;
        this.mode = mode;
        this.servers = servers;
        this.existing = existing;
    }

    private boolean named() { return mode != Mode.DIRECT; }

    @Override protected void init() {
        panelW = Math.min(300, width - 16);
        panelH = 36 + (named() ? 34 : 0) + 34 + 6 + 22 + 12;
        panelH = Math.min(panelH, height - 8);
        panelX = (width - panelW) / 2;
        panelY = (height - panelH) / 2;
        fieldX = panelX + 16;
        fieldW = panelW - 32;
        int y = panelY + 38;
        String oldName = nameBox == null ? (existing == null ? "" : existing.name) : nameBox.getValue();
        String oldAddr = addressBox == null ? (existing == null ? "" : existing.ip) : addressBox.getValue();
        if (named()) {
            nameY = y;
            nameBox = box(y, "My server", 40, oldName, true);
            y += 34;
        }
        addressY = y;
        addressBox = box(y, "play.example.com", 260, oldAddr, false);

        int by = panelY + panelH - 12 - 22, half = (fieldW - 6) / 2;
        String label = mode == Mode.DIRECT ? "Connect" : mode == Mode.ADD ? "Add server" : "Save";
        done = MenuButton.primary(fieldX, by, half, 22, label, mode == Mode.DIRECT ? Glyphs.MULTIPLAYER : Glyphs.CHECK, b -> submit());
        addRenderableWidget(done);
        addRenderableWidget(MenuButton.action(fieldX + half + 6, by, fieldW - half - 6, 22, "Cancel", Glyphs.CLOSE, b -> onClose()));
        setInitialFocus(named() && nameBox.getValue().isEmpty() ? nameBox : addressBox);
        validate();
    }

    private EditBox box(int labelY, String hint, int max, String value, boolean isName) {
        EditBox box = new CirrusTextField(font, fieldX + 22, labelY + 12 + 5, fieldW - 30, 10, Component.literal(isName ? "Server name" : "Server address"), hint);
        box.setMaxLength(max);
        box.setValue(value);
        box.setResponder(v -> { if (isName) nameTouched = true; else addressTouched = true; validate(); });
        addRenderableWidget(box);
        return box;
    }

    private boolean nameOk() { return !named() || !nameBox.getValue().isBlank(); }
    private boolean addressOk() { return DashboardParser.validAddress(addressBox.getValue().trim()); }

    private boolean duplicate() {
        if (mode != Mode.ADD) return false;
        String a = addressBox.getValue().trim();
        for (int i = 0; i < servers.size(); i++) if (servers.get(i).ip.equalsIgnoreCase(a)) return true;
        return false;
    }

    private void validate() { if (done != null) done.active = nameOk() && addressOk(); }

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

    @Override public void render(GuiGraphics g, int mx, int my, float delta) {
        CirrusTheme t = CirrusTheme.DARK;
        Gfx.shadow(g, panelX, panelY, panelW, panelH, 12, 10, 0x66000000);
        Gfx.fillRound(g, panelX, panelY, panelW, panelH, 12, 0xF0090E1A);
        Gfx.hairline(g, panelX + 12, panelY + 1, panelW - 24, Gfx.scaleAlpha(t.highlight, 2f));
        Gfx.strokeRound(g, panelX, panelY, panelW, panelH, 12, 0.5f, Gfx.scaleAlpha(t.border, 0.9f));

        Gfx.fillRound(g, fieldX, panelY + 10, 22, 22, 6, Gfx.mix(0xFF0A0F1A, t.accent, 0.55f));
        Glyphs.draw(g, mode == Mode.EDIT ? Glyphs.EDIT : mode == Mode.DIRECT ? Glyphs.EXTERNAL : Glyphs.ADD, fieldX + 5, panelY + 15, 12, 0xFFFFFFFF);
        CirrusUi.headingText(g, font, getTitle().getString(), fieldX + 30, panelY + 11, t.text);
        CirrusUi.smallText(g, font, mode == Mode.DIRECT ? "Join without saving" : "Saved to your server list", fieldX + 30, panelY + 24, t.muted, false);

        if (named()) {
            boolean bad = nameTouched && !nameOk();
            field(g, nameBox, nameY, "Name", bad ? "Give the server a name" : "", bad, Glyphs.EDIT, t);
        }
        boolean empty = addressBox.getValue().isBlank();
        boolean badAddress = addressTouched && !addressOk() && !empty || addressTouched && empty;
        String note;
        boolean warn = badAddress;
        if (badAddress) note = empty ? "Enter an address" : "Not a valid address";
        else if (empty) note = "host or host:port";
        else if (duplicate()) { note = "Already in your list"; warn = true; }
        else note = addressOk() ? "Looks good" : "";
        field(g, addressBox, addressY, "Address", note, warn, Glyphs.GLOBE, t);
        if (!empty && addressOk() && !warn) Glyphs.draw(g, Glyphs.CHECK, fieldX + fieldW - 10 - CirrusUi.smallWidth(font, note) - 2, addressY + 1, 9, t.cyan);
        super.render(g, mx, my, delta);
    }

    private void field(GuiGraphics g, EditBox box, int y, String label, String note, boolean warn, int glyph, CirrusTheme t) {
        CirrusUi.smallText(g, font, label, fieldX + 2, y, t.muted, false);
        if (!note.isEmpty()) CirrusUi.rightSmall(g, font, note, fieldX + fieldW - 2, y, warn ? WARN : box.getValue().isBlank() ? Gfx.scaleAlpha(t.muted, 0.7f) : t.cyan);
        Gfx.fillRound(g, fieldX, y + 12, fieldW, 20, 6, 0xF0050912);
        int edge = warn ? WARN : box.isFocused() ? t.cyan : Gfx.scaleAlpha(t.border, 0.9f);
        Gfx.strokeRound(g, fieldX, y + 12, fieldW, 20, 6, box.isFocused() || warn ? 1f : 0.5f, edge);
        Glyphs.draw(g, glyph, fieldX + 7, y + 17, 10, box.isFocused() ? t.cyan : t.muted);
    }
}
