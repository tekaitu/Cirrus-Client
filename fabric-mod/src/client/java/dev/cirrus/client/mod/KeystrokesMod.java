package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.Anim;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Gfx;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

/** WASD, jump and mouse buttons with a soft press animation. Reads your real key bindings, so rebinds are respected. */
public final class KeystrokesMod extends HudMod {
    private static final int KEY = 20, GAP = 2;
    private final float[] press = new float[7];
    private final Anim.Clock clock = new Anim.Clock();
    public String id() { return "keystrokes"; }
    public String name() { return "Keystrokes"; }
    public String description() { return "Shows movement keys, jump and mouse buttons as you press them."; }
    public ModCategory category() { return ModCategory.PVP; }
    public int width() { return KEY * 3 + GAP * 2; }
    public int height() { return KEY * 2 + GAP + GAP + 18 + GAP + 14; }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return Math.max(8, screenHeight - height() - 8); }

    public void render(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(c);
        float dt = clock.tick();
        var o = mc.options;
        boolean live = mc.player != null;
        KeyMapping[] maps = {o.keyUp, o.keyLeft, o.keyDown, o.keyRight, o.keyAttack, o.keyUse, o.keyJump};
        for (int i = 0; i < press.length; i++) press[i] = Anim.approach(press[i], live && maps[i].isDown() ? 1f : 0f, dt, 28f);
        int mid = x + KEY + GAP;
        key(g, mc, mid, y, KEY, KEY, "W", press[0], t);
        int row2 = y + KEY + GAP;
        key(g, mc, x, row2, KEY, KEY, "A", press[1], t);
        key(g, mc, mid, row2, KEY, KEY, "S", press[2], t);
        key(g, mc, mid + KEY + GAP, row2, KEY, KEY, "D", press[3], t);
        int row3 = row2 + KEY + GAP, half = (width() - GAP) / 2;
        key(g, mc, x, row3, half, 18, "LMB", press[4], t);
        key(g, mc, x + half + GAP, row3, width() - half - GAP, 18, "RMB", press[5], t);
        key(g, mc, x, row3 + 18 + GAP, width(), 14, "SPACE", press[6], t);
    }

    private static void key(GuiGraphics g, Minecraft mc, int x, int y, int w, int h, String label, float p, CirrusTheme t) {
        Gfx.fillRound(g, x, y, w, h, 5, Gfx.mix(Gfx.mix(t.panel, 0xFF000000, 0.15f), t.accent, p));
        Gfx.strokeRound(g, x, y, w, h, 5, 0.5f, Gfx.mix(t.border, t.cyan, p));
        int color = Gfx.mix(t.muted, 0xFFFFFFFF, p);
        CirrusUi.centeredSmall(g, mc.font, label, x + w / 2, y + (h - CirrusUi.LINE) / 2, color);
    }
}
