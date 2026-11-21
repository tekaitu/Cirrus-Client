package dev.cirrus.client.ui;

import dev.cirrus.client.profile.ProfileCodec;
import dev.cirrus.client.profile.ProfileStore;
import dev.cirrus.client.profile.Profiles;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.network.chat.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * The Profiles page: save the current module settings under a name, switch between saved profiles, and share them as a code
 * (copied to the clipboard) or import a code from the clipboard.
 */
public final class ProfilesPage {
    private static final int ROW_H = 28;
    private final Profiles profiles;
    private final EditBox nameBox;
    private List<String> names = List.of();
    private String active = "", status = "", confirmDelete = "";
    private int x, y, w, h, scroll;
    private ClickGuiLayout.Rect createBtn, shareBtn, importBtn, listRect, nameRect;
    private boolean compactButtons;

    public ProfilesPage(Minecraft mc) {
        this.profiles = new Profiles(mc);
        this.nameBox = new EditBox(mc.font, 0, 0, 100, 12, Component.literal("Profile name"));
        nameBox.setBordered(false);
        nameBox.setTextShadow(false);
        nameBox.setMaxLength(24);
        nameBox.setHint(CirrusUi.small("Name for a new profile"));
        nameBox.addFormatter((value, cursor) -> CirrusUi.formatSearch(value));
        refresh();
    }

    public EditBox nameBox() { return nameBox; }
    public void refresh() { names = profiles.names(); active = profiles.active(); confirmDelete = ""; }

    public void layout(Font font, int x, int y, int w, int h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        int top = y + 36;
        int cw = Math.min(64, w / 4);
        nameRect = new ClickGuiLayout.Rect(x, top, w - cw - 6, 20);
        createBtn = new ClickGuiLayout.Rect(x + w - cw, top, cw, 20);
        nameBox.setX(nameRect.x() + 8); nameBox.setY(nameRect.y() + 4); nameBox.setWidth(Math.max(10, nameRect.w() - 16));
        int by = top + 26, half = (w - 6) / 2;
        shareBtn = new ClickGuiLayout.Rect(x, by, half, 20);
        importBtn = new ClickGuiLayout.Rect(x + half + 6, by, w - half - 6, 20);
        int ly = by + 28;
        listRect = new ClickGuiLayout.Rect(x, ly, w, Math.max(0, y + h - 14 - ly));
        compactButtons = w < 330;
        scroll = Math.max(0, Math.min(scroll, maxScroll()));
    }

    private int maxScroll() { return Math.max(0, names.size() * ROW_H - listRect.h()); }
    private ClickGuiLayout.Rect rowRect(int i) { return new ClickGuiLayout.Rect(x, listRect.y() + i * ROW_H - scroll, w - (maxScroll() > 0 ? 7 : 0), ROW_H - 4); }

    // actions per row, right to left: delete, share, save, load
    private int actionW() { return compactButtons ? 20 : 0; }
    private ClickGuiLayout.Rect action(ClickGuiLayout.Rect row, int slot) {
        int[] widths = compactButtons ? new int[] {20, 20, 20, 20} : new int[] {50, 44, 44, 44};
        int right = row.right() - 4;
        for (int i = 0; i <= slot; i++) { if (i == slot) return new ClickGuiLayout.Rect(right - widths[i], row.y() + (row.h() - 20) / 2, widths[i], 20); right -= widths[i] + 4; }
        return row;
    }
    private static final String[] LABELS = {"Delete", "Share", "Save", "Load"};
    private static final int[] GLYPHS = {Glyphs.DELETE, Glyphs.EXTERNAL, Glyphs.BOX, Glyphs.CHECK};
    private static final String[] TIPS = {"Delete this profile.", "Copy a share code for this profile to the clipboard.", "Overwrite this profile with your current settings.", "Switch to this profile."};

    public void render(GuiGraphics g, int mx, int my, CirrusTheme t) {
        Font font = Minecraft.getInstance().font;
        CirrusUi.text(g, font, "Profiles", x, y, 0xFFFFFFFF, false);
        var lines = CirrusUi.wrapSmall(font, "Save your module settings, switch between setups and share them as a code. Key bindings are not included.", w, 2);
        for (int i = 0; i < lines.size(); i++) CirrusUi.smallText(g, font, lines.get(i), x, y + 13 + i * 10, t.muted, false);
        CirrusUi.card(g, nameRect.x(), nameRect.y(), nameRect.w(), nameRect.h(), 7, 0xFF000000, nameBox.isFocused() ? 0xFFFFFFFF : t.border);
        button(g, font, createBtn, "Create", Glyphs.ADD, false, mx, my, t, true);
        button(g, font, shareBtn, "Share current settings", Glyphs.EXTERNAL, false, mx, my, t, false);
        button(g, font, importBtn, "Import from clipboard", Glyphs.LIST, false, mx, my, t, false);
        g.enableScissor(listRect.x() - 2, listRect.y(), listRect.right() + 2, listRect.bottom());
        for (int i = 0; i < names.size(); i++) {
            var r = rowRect(i);
            if (r.bottom() < listRect.y() || r.y() > listRect.bottom()) continue;
            String name = names.get(i);
            boolean isActive = name.equalsIgnoreCase(active);
            boolean hover = r.contains(mx, my) && listRect.contains(mx, my);
            Gfx.fillRound(g, r.x(), r.y(), r.w(), r.h(), 8, hover ? 0xFF0F0F0F : 0xFF000000);
            Gfx.strokeRound(g, r.x(), r.y(), r.w(), r.h(), 8, 0.5f, isActive ? 0xFFFFFFFF : t.border);
            int tx = r.x() + 10;
            int reserved = compactButtons ? 4 * 24 + 8 : 50 + 44 * 3 + 4 * 4 + 8;
            int tagW = isActive ? CirrusUi.smallWidth(font, "Active") + 12 : 0;
            CirrusUi.text(g, font, CirrusUi.fitBody(font, name, r.w() - reserved - tagW - 20), tx, r.y() + (r.h() - CirrusUi.LINE) / 2, 0xFFFFFFFF, false);
            if (isActive) {
                int nx = tx + CirrusUi.bodyWidth(font, CirrusUi.fitBody(font, name, r.w() - reserved - tagW - 20)) + 8;
                Gfx.fillRound(g, nx, r.y() + (r.h() - 12) / 2, tagW, 12, 6, 0xFFFFFFFF);
                CirrusUi.smallText(g, font, "Active", nx + 6, r.y() + (r.h() - CirrusUi.LINE) / 2, 0xFF000000, false);
            }
            for (int s = 0; s < 4; s++) {
                var b = action(r, s);
                boolean confirm = s == 0 && name.equals(confirmDelete);
                button(g, font, b, confirm ? "Sure?" : LABELS[s], GLYPHS[s], compactButtons && !confirm, mx, my, t, false);
            }
        }
        g.disableScissor();
        if (maxScroll() > 0) CirrusUi.scrollbar(g, x + w - 3, listRect.y(), listRect.h(), scroll / (float) maxScroll(), listRect.h() / (float) (names.size() * ROW_H), t);
        if (names.isEmpty()) CirrusUi.centeredSmall(g, font, "No profiles yet. Type a name and press Create to save your current settings.", x + w / 2, listRect.y() + 12, 0xFF8C8C8C);
        if (!status.isEmpty()) CirrusUi.smallText(g, font, CirrusUi.fitSmall(font, status, w), x, y + h - 10, 0xFFFFFFFF, false);
    }

    private void button(GuiGraphics g, Font font, ClickGuiLayout.Rect r, String label, int glyph, boolean iconOnly, int mx, int my, CirrusTheme t, boolean primary) {
        boolean hover = r.contains(mx, my);
        Gfx.fillRound(g, r.x(), r.y(), r.w(), r.h(), 6, primary ? (hover ? 0xFFDDDDDD : 0xFFFFFFFF) : (hover ? 0xFF141414 : 0xFF000000));
        if (!primary) Gfx.strokeRound(g, r.x(), r.y(), r.w(), r.h(), 6, 0.5f, hover ? 0xFFFFFFFF : t.border);
        int fg = primary ? 0xFF000000 : 0xFFFFFFFF;
        if (iconOnly || r.w() < 30) { Glyphs.draw(g, glyph, r.x() + (r.w() - 12) / 2, r.y() + (r.h() - 12) / 2, 12, fg); return; }
        boolean small = r.w() < 60;
        int tw = small ? CirrusUi.smallWidth(font, label) : CirrusUi.bodyWidth(font, label);
        boolean icon = !small && tw + 26 <= r.w();
        int cx = r.x() + (r.w() - tw - (icon ? 16 : 0)) / 2;
        if (icon) { Glyphs.draw(g, glyph, cx, r.y() + (r.h() - 12) / 2, 12, fg); cx += 16; }
        if (small) CirrusUi.smallText(g, font, label, cx, r.y() + (r.h() - CirrusUi.LINE) / 2, fg, false);
        else CirrusUi.text(g, font, CirrusUi.fitBody(font, label, r.w() - 6), cx, r.y() + (r.h() - CirrusUi.LINE) / 2, fg, false);
    }

    public String tooltip(double mx, double my) {
        if (createBtn.contains(mx, my)) return "Save your current settings as a new profile.";
        if (shareBtn.contains(mx, my)) return "Copy a code of all your current module settings to the clipboard. Anyone can paste it into Import.";
        if (importBtn.contains(mx, my)) return "Read a Cirrus profile code from the clipboard and save it as a new profile.";
        for (int i = 0; i < names.size(); i++) {
            var r = rowRect(i);
            if (!listRect.contains(mx, my)) break;
            for (int s = 0; s < 4; s++) if (action(r, s).contains(mx, my)) return TIPS[s];
        }
        return null;
    }

    public boolean mouseClicked(double mx, double my) {
        Minecraft mc = Minecraft.getInstance();
        if (createBtn.contains(mx, my)) { create(); return true; }
        if (shareBtn.contains(mx, my)) { mc.keyboardHandler.setClipboard(profiles.shareCurrent()); status = "Share code copied to the clipboard."; return true; }
        if (importBtn.contains(mx, my)) { importFromClipboard(); return true; }
        if (!listRect.contains(mx, my)) { confirmDelete = ""; return false; }
        for (int i = 0; i < names.size(); i++) {
            var r = rowRect(i);
            for (int s = 0; s < 4; s++) {
                if (!action(r, s).contains(mx, my)) continue;
                String name = names.get(i);
                try {
                    switch (s) {
                        case 3 -> { profiles.apply(name); status = "Loaded " + name + "."; confirmDelete = ""; }
                        case 2 -> { profiles.save(name); status = "Saved your current settings to " + name + "."; confirmDelete = ""; }
                        case 1 -> { mc.keyboardHandler.setClipboard(profiles.share(name)); status = "Share code for " + name + " copied to the clipboard."; confirmDelete = ""; }
                        default -> {
                            if (name.equals(confirmDelete)) { profiles.delete(name); status = "Deleted " + name + "."; confirmDelete = ""; }
                            else { confirmDelete = name; status = "Click Delete again to remove " + name + "."; }
                        }
                    }
                } catch (IOException e) { status = "That did not work: " + (e.getMessage() == null ? "file error" : e.getMessage()); }
                refreshKeep();
                return true;
            }
        }
        confirmDelete = "";
        return true;
    }

    private void refreshKeep() { String c = confirmDelete; refresh(); confirmDelete = c; scroll = Math.max(0, Math.min(scroll, maxScroll())); }

    public void create() {
        if (profiles.atLimit()) { status = "You can keep up to " + ProfileStore.MAX_PROFILES + " profiles."; return; }
        try {
            String name = profiles.create(nameBox.getValue());
            nameBox.setValue("");
            status = "Saved your current settings as " + name + ".";
        } catch (IOException e) { status = "Could not save the profile."; }
        refreshKeep();
    }

    private void importFromClipboard() {
        if (profiles.atLimit()) { status = "You can keep up to " + ProfileStore.MAX_PROFILES + " profiles."; return; }
        try {
            String name = profiles.importCode(Minecraft.getInstance().keyboardHandler.getClipboard());
            status = "Imported as " + name + ". Press Load to use it.";
        } catch (IllegalArgumentException e) { status = e.getMessage(); }
        catch (IOException e) { status = "Could not save the imported profile."; }
        refreshKeep();
    }

    public boolean mouseScrolled(double mx, double my, double v) {
        if (!listRect.contains(mx, my) || maxScroll() == 0) return false;
        scroll = Math.max(0, Math.min(maxScroll(), scroll - (int) (v * ROW_H)));
        return true;
    }

    public String activeName() { return active; }
}
