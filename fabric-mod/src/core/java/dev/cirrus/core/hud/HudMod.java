package dev.cirrus.core.hud;

import dev.cirrus.core.text.TextStyle;
import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.module.CirrusMod;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.module.ModRegistry;
import dev.cirrus.core.render.Canvas;
import dev.cirrus.core.render.Colors;
import dev.cirrus.core.render.Shapes;
import dev.cirrus.core.settings.ModSettings;
import dev.cirrus.core.settings.Setting;
import dev.cirrus.core.theme.CirrusTheme;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Base for modules that are both a library entry (toggle, favourite) and a movable HUD element. One switch controls both.
 * Every HUD feature gets the same appearance options (scale, background, opacity, border, text shadow) plus whatever it adds in
 * {@link #featureSettings()}. Subclasses draw at scale 1 in {@link #draw}; scaling and the settings list are handled here.
 */
public abstract class HudMod implements CirrusMod, HudElement {
    public static final List<Setting> APPEARANCE = Collections.unmodifiableList(Arrays.asList(
        Setting.slider("scale", "Scale", "Size of this element on screen.", 100, 50, 200, 10, "%").group("Appearance"),
        Setting.toggle("background", "Background", "Draw a panel behind the element. Off shows plain text.", false).group("Appearance"),
        HudColors.backgroundSetting(),
        Setting.slider("opacity", "Background opacity", "How solid the background is.", 80, 10, 100, 5, "%").requires("background", "true").group("Appearance"),
        Setting.toggle("border", "Border", "Thin outline around the background.", true).requires("background", "true").group("Appearance"),
        Setting.toggle("shadow", "Text shadow", "Keeps text readable when the background is off.", true).group("Appearance")));

    /** The plainest look: just the text, with an optional background and a size. Used by simple counters such as FPS and Ping. */
    public static final List<Setting> SIMPLE = Collections.unmodifiableList(Arrays.asList(
        Setting.toggle("background", "Background", "Draw a panel behind the text.", false).group("Appearance"),
        HudColors.backgroundSetting(),
        Setting.slider("opacity", "Background opacity", "How solid the background is.", 80, 10, 100, 5, "%").requires("background", "true").group("Appearance"),
        Setting.slider("scale", "Scale", "Size of this element on screen.", 100, 50, 200, 10, "%").group("Appearance")));

    /** Format and text colour for text counters such as FPS and Ping; shown under their own "Text" heading before the appearance options. */
    public static final List<Setting> TEXT = Collections.unmodifiableList(Arrays.asList(FormatTemplate.setting(), HudColors.setting()));

    private List<Setting> all;

    @Override public boolean defaultEnabled() { return true; }
    @Override public boolean enabled(CirrusConfig c) { return CirrusMod.super.enabled(c); }
    @Override public void setEnabled(CirrusConfig c, boolean value) { CirrusMod.super.setEnabled(c, value); }
    @Override public String label() { return name(); }

    /** The shared appearance options; simple elements return {@link #SIMPLE} instead. */
    protected List<Setting> appearance() { return APPEARANCE; }

    /** Options specific to this feature, shown before the shared appearance options. */
    protected List<Setting> featureSettings() { return Collections.emptyList(); }

    @Override public final synchronized List<Setting> settings() {
        if (all == null) {
            List<Setting> list = new ArrayList<Setting>(featureSettings());
            list.addAll(appearance());
            all = Collections.unmodifiableList(list);
        }
        return all;
    }

    // ---- option access ----------------------------------------------------------------------------------------------

    protected final String opt(CirrusConfig c, String key) { return ModSettings.get(c, id(), settings(), key); }
    protected final boolean on(CirrusConfig c, String key) { return ModSettings.bool(c, id(), settings(), key); }
    protected final int num(CirrusConfig c, String key) { return ModSettings.number(c, id(), settings(), key); }

    private boolean has(String key) { for (Setting s : settings()) if (s.key().equals(key)) return true; return false; }
    protected final boolean backgroundOn(CirrusConfig c) { return on(c, "background"); }
    protected final boolean borderOn(CirrusConfig c) { return on(c, "background") && (!has("border") || on(c, "border")); }
    /** Simple elements have no shadow option: text gets a shadow when there is no background behind it. */
    protected final boolean shadowOn(CirrusConfig c) { return has("shadow") ? on(c, "shadow") : !on(c, "background"); }
    /** The chosen text colour, or white for widgets without the option. */
    /**
     * Draws an informational line: the template's text in the text colour, the number in {@code valueColor}, and (Maple style) the
     * widget's name in the accent colour, e.g. a white "[", orange "FPS", then a white number and "]".
     */
    protected final void drawInfo(Canvas canvas, int x, int y, CirrusConfig c, ModContext m, String label, String unit, String value, int valueColor) {
        String tpl = FormatTemplate.template(opt(c, "format"), label, unit);
        if (!FormatTemplate.valid(tpl)) tpl = FormatTemplate.VALUE;
        int at = tpl.indexOf(FormatTemplate.VALUE);
        String pre = tpl.substring(0, at), post = tpl.substring(at + FormatTemplate.VALUE.length());
        int base = textColor(c), cx = x;
        boolean shadow = shadowOn(c);
        int named = FormatTemplate.MAPLE.equals(opt(c, "format")) && !label.isEmpty() ? pre.indexOf(label) : -1;
        if (named >= 0) {
            String a = pre.substring(0, named), b = pre.substring(named + label.length());
            int accent = CirrusTheme.current(c).accent;
            cx = seg(canvas, m, a, cx, y, base, shadow);
            cx = seg(canvas, m, label, cx, y, accent, shadow);
            cx = seg(canvas, m, b, cx, y, base, shadow);
        } else cx = seg(canvas, m, pre, cx, y, base, shadow);
        cx = seg(canvas, m, value, cx, y, valueColor, shadow);
        seg(canvas, m, post, cx, y, base, shadow);
    }

    private static int seg(Canvas canvas, ModContext m, String s, int x, int y, int color, boolean shadow) {
        if (s.isEmpty()) return x;
        canvas.text(s, TextStyle.BODY, x, y, color, shadow);
        return x + m.text().width(s, TextStyle.BODY);
    }

    protected final int textColor(CirrusConfig c) { return has("color") ? HudColors.argb(opt(c, "color")) : 0xFFFFFFFF; }
    protected final float scale(CirrusConfig c) { return num(c, "scale") / 100f; }

    /** Fill colour for a surface of this element: the theme's HUD panel at the chosen opacity, or fully clear when the background is off. */
    protected final int backgroundColor(CirrusConfig c, CirrusTheme t) {
        if (!backgroundOn(c)) return 0;
        int rgb = has("bgcolor") ? HudColors.background(opt(c, "bgcolor")) : Colors.mix(t.panel, 0xFF000000, 0.15f);
        return Colors.withAlpha(rgb, Math.round(255 * (has("opacity") ? num(c, "opacity") : 85) / 100f));
    }

    /** Standard element surface honouring the background and border options. */
    protected final void surface(Canvas canvas, int x, int y, int w, int h, int radius, CirrusConfig c, CirrusTheme t) {
        if (backgroundOn(c)) Shapes.fillRound(canvas, x, y, w, h, radius, backgroundColor(c, t));
        if (borderOn(c)) Shapes.strokeRound(canvas, x, y, w, h, radius, 0.5f, t.border);
    }

    // ---- size, scale and drawing --------------------------------------------------------------------------------------

    /** Unscaled size; may depend on the options (for example a layout choice). */
    protected abstract int baseWidth(ModContext context);
    protected abstract int baseHeight(ModContext context);
    /** Draw at scale 1 with the top-left corner at (x, y). */
    protected abstract void draw(Canvas canvas, int x, int y, float tick, ModContext context);

    @Override public final int width() { ModContext m = ModRegistry.context(); return Math.max(1, Math.round(baseWidth(m) * scale(m.config()))); }
    @Override public final int height() { ModContext m = ModRegistry.context(); return Math.max(1, Math.round(baseHeight(m) * scale(m.config()))); }

    @Override public final void render(Canvas canvas, int x, int y, float tick, ModContext context) {
        float s = scale(context.config());
        if (s == 1f) { draw(canvas, x, y, tick, context); return; }
        canvas.pushTransform(x, y, s);
        draw(canvas, 0, 0, tick, context);
        canvas.popTransform();
    }
}
