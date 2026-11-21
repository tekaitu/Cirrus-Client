package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.mod.CirrusMod;
import dev.cirrus.client.mod.HudElement;
import dev.cirrus.client.mod.ModKeys;
import dev.cirrus.client.mod.Setting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import org.lwjgl.glfw.GLFW;

import java.util.List;

/**
 * The settings pane of the Click GUI for one module: header and description, live preview (HUD elements), the enable switch,
 * the optional toggle key and the module's own settings. Everything for one module lives in this one pane.
 */
public final class ModPane {
    private static final int ROW = 22;
    private final CirrusMod mod;
    private final Runnable editPosition, back;
    private final SettingsPanel settings;
    private int x, y, w, h;
    private boolean showBack, listening, focused;
    private List<String> descLines = List.of(), noteLines = List.of();
    private ClickGuiLayout.Rect backBtn, previewRect, enabledRow, keyRow, keyBtn, resetBtn, editBtn, settingsRect;
    private float progress = -1f;

    public ModPane(CirrusMod mod, Runnable editPosition, Runnable back) {
        this.mod = mod; this.editPosition = editPosition; this.back = back;
        this.settings = new SettingsPanel(mod);
    }

    public CirrusMod mod() { return mod; }
    public boolean isListening() { return listening; }
    public boolean focused() { return focused; }
    public void setFocused(boolean f) { focused = f; }
    public boolean contains(double mx, double my) { return mx >= x && mx < x + w && my >= y && my < y + h; }
    private boolean hud() { return mod instanceof HudElement && mod.available(); }

    public void layout(Font font, int x, int y, int w, int h, boolean showBack) {
        this.x = x; this.y = y; this.w = w; this.h = h; this.showBack = showBack;
        int pad = 8, iw = w - pad * 2, cy = y + pad;
        backBtn = null; previewRect = null; enabledRow = null; keyRow = null; keyBtn = null; resetBtn = null; editBtn = null; settingsRect = null;
        if (showBack) { backBtn = new ClickGuiLayout.Rect(x + pad, cy, 52, 16); cy += 22; }
        cy += 28; // header: icon tile and title
        descLines = CirrusUi.wrapSmall(font, mod.description(), iw, 3);
        cy += descLines.size() * 10 + 4;
        noteLines = mod.note().isEmpty() ? List.of() : CirrusUi.wrapSmall(font, mod.note(), iw, 3);
        cy += noteLines.size() * 10 + (noteLines.isEmpty() ? 0 : 2);
        if (!mod.available()) return;
        boolean hasFooter = !settings.isEmpty() || hud();
        int footerH = hasFooter ? 28 : 0;
        if (hud() && (y + h) - cy - footerH >= 170) { previewRect = new ClickGuiLayout.Rect(x + pad, cy, iw, 52); cy += 58; }
        enabledRow = new ClickGuiLayout.Rect(x + pad, cy, iw, ROW); cy += ROW + 2;
        if (ModKeys.supported(mod.id())) {
            keyRow = new ClickGuiLayout.Rect(x + pad, cy, iw, ROW);
            int bw = Math.min(84, iw / 2);
            keyBtn = new ClickGuiLayout.Rect(x + pad + iw - bw - 4, cy + 2, bw, ROW - 4);
            cy += ROW + 2;
        }
        if (hasFooter) {
            int by = y + h - pad - 20;
            boolean both = hud() && !settings.isEmpty();
            int bw = both ? (iw - 4) / 2 : iw;
            int bx = x + pad;
            if (!settings.isEmpty()) { resetBtn = new ClickGuiLayout.Rect(bx, by, bw, 20); bx += bw + 4; }
            if (hud()) editBtn = new ClickGuiLayout.Rect(bx, by, bw, 20);
            if (!settings.isEmpty()) {
                int top = cy + 14, bottom = by - 6;
                settingsRect = new ClickGuiLayout.Rect(x + pad, top, iw, Math.max(0, bottom - top));
                settings.layout(settingsRect.x(), settingsRect.y(), settingsRect.w(), settingsRect.h(), iw < 230);
            }
        }
    }

    // ---- drawing -----------------------------------------------------------------------------------------------------

    public void render(GuiGraphics g, int mx, int my, float dt, CirrusTheme t) {
        Font font = Minecraft.getInstance().font;
        CirrusConfig cfg = CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());
        CirrusUi.card(g, x, y, w, h, 10, 0xFF000000, t.border);
        boolean on = mod.enabled(cfg);
        if (progress < 0) progress = on ? 1f : 0f;
        progress = Anim.approach(progress, on ? 1f : 0f, dt, 14f);
        int pad = 8, cy = y + pad;
        if (backBtn != null) {
            boolean hover = backBtn.contains(mx, my);
            Glyphs.draw(g, Glyphs.BACK, backBtn.x(), backBtn.y() + 2, 12, hover ? 0xFFFFFFFF : t.muted);
            CirrusUi.smallText(g, font, "Back", backBtn.x() + 16, backBtn.y() + 3, hover ? 0xFFFFFFFF : t.muted, false);
            cy += 22;
        }
        // header
        ModTile.draw(g, mod, on, x + pad, cy, 24);
        CirrusUi.text(g, font, CirrusUi.fitBody(font, mod.name(), w - pad * 2 - 30), x + pad + 30, cy + 2, 0xFFFFFFFF, false);
        String sub = mod.category().label + (mod.available() ? (on ? " · On" : " · Off") : " · Planned");
        CirrusUi.smallText(g, font, sub, x + pad + 30, cy + 14, t.muted, false);
        cy += 28;
        for (String line : descLines) { CirrusUi.smallText(g, font, line, x + pad, cy, t.muted, false); cy += 10; }
        for (String line : noteLines) { CirrusUi.smallText(g, font, line, x + pad, cy + 2, 0xFF8C8C8C, false); cy += 10; }
        if (!mod.available()) {
            CirrusUi.smallText(g, font, "Not available yet.", x + pad, y + h - pad - 8, 0xFF8C8C8C, false);
            return;
        }
        if (previewRect != null) HudPreview.draw(g, (HudElement) mod, cfg, t, previewRect.x(), previewRect.y(), previewRect.w(), previewRect.h());
        if (enabledRow != null) {
            CirrusUi.text(g, font, "Enabled", enabledRow.x() + 2, enabledRow.y() + (ROW - CirrusUi.LINE) / 2, 0xFFFFFFFF, false);
            CirrusUi.toggle(g, enabledRow.right() - 28, enabledRow.y() + (ROW - 12) / 2, on, progress, t);
        }
        if (keyRow != null) {
            CirrusUi.text(g, font, "Toggle key", keyRow.x() + 2, keyRow.y() + (ROW - CirrusUi.LINE) / 2, 0xFFFFFFFF, false);
            boolean hover = keyBtn.contains(mx, my);
            Gfx.fillRound(g, keyBtn.x(), keyBtn.y(), keyBtn.w(), keyBtn.h(), 5, listening ? 0xFFFFFFFF : (hover ? 0xFF141414 : 0xFF000000));
            Gfx.strokeRound(g, keyBtn.x(), keyBtn.y(), keyBtn.w(), keyBtn.h(), 5, 0.5f, listening || hover ? 0xFFFFFFFF : t.border);
            String label = listening ? "Press a key" : ModKeys.label(mod.id());
            CirrusUi.centeredSmall(g, font, CirrusUi.fitSmall(font, label, keyBtn.w() - 8), keyBtn.x() + keyBtn.w() / 2, keyBtn.y() + (keyBtn.h() - CirrusUi.LINE) / 2, listening ? 0xFF000000 : 0xFFFFFFFF);
        }
        if (settingsRect != null) {
            CirrusUi.smallText(g, font, "SETTINGS", x + pad + 2, settingsRect.y() - 12, 0xFF8C8C8C, false);
            settings.render(g, mx, my, t, focused);
        }
        if (resetBtn != null) button(g, font, resetBtn, "Reset settings", mx, my, t);
        if (editBtn != null) button(g, font, editBtn, "Edit position", mx, my, t);
    }

    private static void button(GuiGraphics g, Font font, ClickGuiLayout.Rect r, String label, int mx, int my, CirrusTheme t) {
        boolean hover = r.contains(mx, my);
        Gfx.fillRound(g, r.x(), r.y(), r.w(), r.h(), 6, hover ? 0xFF141414 : 0xFF000000);
        Gfx.strokeRound(g, r.x(), r.y(), r.w(), r.h(), 6, 0.5f, hover ? 0xFFFFFFFF : t.border);
        CirrusUi.centered(g, font, CirrusUi.fitBody(font, label, r.w() - 8), r.x() + r.w() / 2, r.y() + (r.h() - CirrusUi.LINE) / 2, 0xFFFFFFFF);
    }

    /** Help text for whatever is under the pointer, or null. */
    public String tooltip(double mx, double my) {
        if (!mod.available()) return null;
        if (keyBtn != null && keyBtn.contains(mx, my)) return "Click, then press the key that switches this module on or off in game. Backspace clears it.";
        if (enabledRow != null && enabledRow.contains(mx, my)) return "Turn this module on or off.";
        if (editBtn != null && editBtn.contains(mx, my)) return "Open the HUD editor with this element selected.";
        if (resetBtn != null && resetBtn.contains(mx, my)) return "Put every setting of this module back to its default.";
        Setting s = settings.hovered(mx, my);
        return s == null ? null : s.hint();
    }

    // ---- input -------------------------------------------------------------------------------------------------------

    public boolean mouseClicked(double mx, double my, int button) {
        if (!contains(mx, my)) return false;
        focused = true;
        if (listening) { listening = false; return true; }
        CirrusConfig cfg = CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());
        if (backBtn != null && backBtn.contains(mx, my)) { back.run(); return true; }
        if (!mod.available()) return true;
        if (enabledRow != null && enabledRow.contains(mx, my)) { mod.setEnabled(cfg, !mod.enabled(cfg)); return true; }
        if (keyBtn != null && keyBtn.contains(mx, my)) { listening = true; return true; }
        if (resetBtn != null && resetBtn.contains(mx, my)) { settings.reset(); return true; }
        if (editBtn != null && editBtn.contains(mx, my)) { editPosition.run(); return true; }
        if (settingsRect != null && settingsRect.contains(mx, my)) settings.mouseClicked(mx, my, button);
        return true;
    }

    public boolean mouseDragged(double mx) { return settings.mouseDragged(mx); }
    public void mouseReleased() { settings.mouseReleased(); }
    public boolean mouseScrolled(double mx, double my, double v) { return settings.mouseScrolled(mx, my, v); }

    /** Handles a key while the pane has focus or is waiting for a key to bind. Returns true if the key was used. */
    public boolean keyPressed(int key) {
        if (listening) {
            if (key == GLFW.GLFW_KEY_ESCAPE) listening = false;
            else {
                ModKeys.bind(mod.id(), key == GLFW.GLFW_KEY_BACKSPACE || key == GLFW.GLFW_KEY_DELETE ? -1 : key);
                listening = false;
            }
            return true;
        }
        return focused && mod.available() && settings.keyPressed(key);
    }
}
