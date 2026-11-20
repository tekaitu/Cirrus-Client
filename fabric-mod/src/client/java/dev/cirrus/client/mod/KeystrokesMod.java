package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.Anim;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Gfx;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

import java.util.List;

/** WASD, mouse buttons and space with a press animation. Reads your real key bindings, so rebinds are respected. */
public final class KeystrokesMod extends HudMod {
    private static final int KEY = 20, GAP = 2;
    private static final List<Setting> OWN = List.of(
        Setting.toggle("mouse", "Mouse buttons", "Show left and right click.", true),
        Setting.toggle("space", "Space bar", "Show the jump key below the other keys.", true),
        Setting.slider("speed", "Animation speed", "How quickly a key lights up and fades.", 5, 1, 10, 1, ""));

    private final float[] press = new float[7];
    private final Anim.Clock clock = new Anim.Clock();
    public String id() { return "keystrokes"; }
    public String name() { return "Keystrokes"; }
    public String description() { return "Shows movement keys, jump and mouse buttons as you press them."; }
    public ModCategory category() { return ModCategory.PVP; }
    @Override public int icon() { return dev.cirrus.client.ui.CirrusUi.ICON_UTILITY; }
    @Override protected List<Setting> featureSettings() { return OWN; }
    @Override protected int baseWidth(CirrusConfig c) { return KEY * 3 + GAP * 2; }
    @Override protected int baseHeight(CirrusConfig c) { return KEY * 2 + GAP + (on(c, "mouse") ? GAP + 18 : 0) + (on(c, "space") ? GAP + 14 : 0); }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return Math.max(8, screenHeight - height() - 8); }

    @Override protected void draw(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(c);
        float dt = clock.tick();
        float rate = 8f + num(c, "speed") * 4f;
        var o = mc.options;
        boolean live = mc.player != null;
        KeyMapping[] maps = {o.keyUp, o.keyLeft, o.keyDown, o.keyRight, o.keyAttack, o.keyUse, o.keyJump};
        for (int i = 0; i < press.length; i++) press[i] = Anim.approach(press[i], live && maps[i].isDown() ? 1f : 0f, dt, rate);
        int w = baseWidth(c);
        int mid = x + KEY + GAP;
        key(g, mc, mid, y, KEY, KEY, "W", press[0], c, t);
        int row2 = y + KEY + GAP;
        key(g, mc, x, row2, KEY, KEY, "A", press[1], c, t);
        key(g, mc, mid, row2, KEY, KEY, "S", press[2], c, t);
        key(g, mc, mid + KEY + GAP, row2, KEY, KEY, "D", press[3], c, t);
        int next = row2 + KEY + GAP;
        if (on(c, "mouse")) {
            int half = (w - GAP) / 2;
            key(g, mc, x, next, half, 18, "LMB", press[4], c, t);
            key(g, mc, x + half + GAP, next, w - half - GAP, 18, "RMB", press[5], c, t);
            next += 18 + GAP;
        }
        if (on(c, "space")) key(g, mc, x, next, w, 14, "SPACE", press[6], c, t);
    }

    /** With the background on each key is a filled box; with it off only a pressed key is highlighted. */
    private void key(GuiGraphics g, Minecraft mc, int x, int y, int w, int h, String label, float p, CirrusConfig c, CirrusTheme t) {
        int base = backgroundColor(c, t);
        int lit = Gfx.withAlpha(0xFFFFFFFF, Math.round(255 * Math.max(p, 0f)));
        if (base != 0) Gfx.fillRound(g, x, y, w, h, 5, base);
        if (p > 0.01f) Gfx.fillRound(g, x, y, w, h, 5, lit);
        if (borderOn(c)) Gfx.strokeRound(g, x, y, w, h, 5, 0.5f, Gfx.mix(t.border, 0xFFFFFFFF, p));
        int color = Gfx.mix(0xFFFFFFFF, 0xFF000000, Math.min(1f, p * 1.2f));
        CirrusUi.centeredSmall(g, mc.font, label, x + w / 2, y + (h - CirrusUi.LINE) / 2, color);
    }
}
