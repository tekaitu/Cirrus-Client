package dev.cirrus.core.hud;

import dev.cirrus.core.anim.Anim;
import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.input.GameAction;
import dev.cirrus.core.module.ModCategory;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.render.Canvas;
import dev.cirrus.core.render.Colors;
import dev.cirrus.core.render.Icons;
import dev.cirrus.core.render.Shapes;
import dev.cirrus.core.settings.Setting;
import dev.cirrus.core.text.TextFit;
import dev.cirrus.core.text.TextStyle;
import dev.cirrus.core.theme.CirrusTheme;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** WASD, mouse buttons and space with a press animation. Reads the player's real key bindings through the context, so rebinds are respected. */
public final class KeystrokesMod extends HudMod {
    private static final int KEY = 20, GAP = 2;
    private static final List<Setting> OWN = Collections.unmodifiableList(Arrays.asList(
        Setting.toggle("mouse", "Mouse buttons", "Show left and right click.", true),
        Setting.toggle("space", "Space bar", "Show the jump key below the other keys.", true),
        Setting.slider("speed", "Animation speed", "How quickly a key lights up and fades.", 5, 1, 10, 1, "")));
    private static final GameAction[] ACTIONS = {GameAction.FORWARD, GameAction.LEFT, GameAction.BACK, GameAction.RIGHT, GameAction.ATTACK, GameAction.USE, GameAction.JUMP};

    private final float[] press = new float[ACTIONS.length];
    private final Anim.Clock clock = new Anim.Clock();

    public String id() { return "keystrokes"; }
    public String name() { return "Keystrokes"; }
    public String description() { return "Shows movement keys, jump and mouse buttons as you press them."; }
    public ModCategory category() { return ModCategory.HUD; }
    @Override public int icon() { return Icons.KEYCAP; }
    @Override protected List<Setting> featureSettings() { return OWN; }
    @Override protected int baseWidth(ModContext m) { return KEY * 3 + GAP * 2; }
    @Override protected int baseHeight(ModContext m) {
        CirrusConfig c = m.config();
        return KEY * 2 + GAP + (on(c, "mouse") ? GAP + 18 : 0) + (on(c, "space") ? GAP + 14 : 0);
    }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return Math.max(8, screenHeight - height() - 8); }

    @Override protected void draw(Canvas g, int x, int y, float tick, ModContext m) {
        CirrusConfig c = m.config();
        CirrusTheme t = CirrusTheme.current(c);
        float dt = clock.tick();
        float rate = 8f + num(c, "speed") * 4f;
        boolean live = m.inWorld();
        for (int i = 0; i < press.length; i++) press[i] = Anim.approach(press[i], live && m.isActionDown(ACTIONS[i]) ? 1f : 0f, dt, rate);
        int w = baseWidth(m);
        int mid = x + KEY + GAP;
        key(g, m, mid, y, KEY, KEY, "W", press[0], c, t);
        int row2 = y + KEY + GAP;
        key(g, m, x, row2, KEY, KEY, "A", press[1], c, t);
        key(g, m, mid, row2, KEY, KEY, "S", press[2], c, t);
        key(g, m, mid + KEY + GAP, row2, KEY, KEY, "D", press[3], c, t);
        int next = row2 + KEY + GAP;
        if (on(c, "mouse")) {
            int half = (w - GAP) / 2;
            key(g, m, x, next, half, 18, "LMB", press[4], c, t);
            key(g, m, x + half + GAP, next, w - half - GAP, 18, "RMB", press[5], c, t);
            next += 18 + GAP;
        }
        if (on(c, "space")) key(g, m, x, next, w, 14, "SPACE", press[6], c, t);
    }

    /** With the background on each key is a filled box; with it off only a pressed key is highlighted. */
    private void key(Canvas g, ModContext m, int x, int y, int w, int h, String label, float p, CirrusConfig c, CirrusTheme t) {
        int base = backgroundColor(c, t);
        int lit = Colors.withAlpha(0xFFFFFFFF, Math.round(255 * Math.max(p, 0f)));
        if (base != 0) Shapes.fillRound(g, x, y, w, h, 5, base);
        if (p > 0.01f) Shapes.fillRound(g, x, y, w, h, 5, lit);
        if (borderOn(c)) Shapes.strokeRound(g, x, y, w, h, 5, 0.5f, Colors.mix(t.border, 0xFFFFFFFF, p));
        int color = Colors.mix(0xFFFFFFFF, 0xFF000000, Math.min(1f, p * 1.2f));
        g.text(label, TextStyle.SMALL, x + (w - m.text().width(label, TextStyle.SMALL)) / 2, y + (h - TextFit.LINE) / 2, color, shadowOn(c) && p < 0.5f);
    }
}
