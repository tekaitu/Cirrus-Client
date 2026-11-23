package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.Gfx;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

import java.util.ArrayList;
import java.util.List;

/**
 * Base for modules that are both a library entry (toggle, favourite) and a movable HUD element. One switch controls both.
 * Every HUD feature gets the same appearance options (scale, background, opacity, border, text shadow) plus whatever it adds in
 * {@link #featureSettings()}. Subclasses draw at scale 1 in {@link #draw}; scaling and the settings page are handled here.
 */
public abstract class HudMod implements CirrusMod, HudElement {
    public static final List<Setting> APPEARANCE = List.of(
        Setting.slider("scale", "Scale", "Size of this element on screen.", 100, 50, 200, 10, "%").group("Appearance"),
        Setting.toggle("background", "Background", "Draw a panel behind the element.", true).group("Appearance"),
        Setting.slider("opacity", "Background opacity", "How solid the background is.", 80, 10, 100, 5, "%").requires("background", "true").group("Appearance"),
        Setting.toggle("border", "Border", "Thin outline around the background.", true).requires("background", "true").group("Appearance"),
        Setting.toggle("shadow", "Text shadow", "Keeps text readable when the background is off.", false).group("Appearance"));

    private List<Setting> all;

    @Override public boolean defaultEnabled() { return true; }
    @Override public boolean enabled(CirrusConfig c) { return CirrusMod.super.enabled(c); }
    @Override public void setEnabled(CirrusConfig c, boolean value) { CirrusMod.super.setEnabled(c, value); }
    @Override public String label() { return name(); }

    /** Options specific to this feature, shown before the shared appearance options. */
    protected List<Setting> featureSettings() { return List.of(); }

    @Override public final synchronized List<Setting> settings() {
        if (all == null) {
            List<Setting> list = new ArrayList<>(featureSettings());
            list.addAll(APPEARANCE);
            all = List.copyOf(list);
        }
        return all;
    }

    @Override public void openSettings(net.minecraft.client.gui.screens.Screen parent) {
        Minecraft.getInstance().setScreen(new dev.cirrus.client.ModSettingsScreen(parent, this));
    }

    // ---- option access ----------------------------------------------------------------------------------------------

    protected final String opt(CirrusConfig c, String key) { return ModSettings.get(c, id(), settings(), key); }
    protected final boolean on(CirrusConfig c, String key) { return ModSettings.bool(c, id(), settings(), key); }
    protected final int num(CirrusConfig c, String key) { return ModSettings.number(c, id(), settings(), key); }

    protected final boolean backgroundOn(CirrusConfig c) { return on(c, "background"); }
    protected final boolean borderOn(CirrusConfig c) { return on(c, "background") && on(c, "border"); }
    protected final boolean shadowOn(CirrusConfig c) { return on(c, "shadow"); }
    protected final float scale(CirrusConfig c) { return num(c, "scale") / 100f; }

    /** Fill colour for a surface of this element: the theme's HUD panel at the chosen opacity, or fully clear when the background is off. */
    protected final int backgroundColor(CirrusConfig c, CirrusTheme t) {
        if (!backgroundOn(c)) return 0;
        return Gfx.withAlpha(Gfx.mix(t.panel, 0xFF000000, 0.15f), Math.round(255 * num(c, "opacity") / 100f));
    }

    /** Standard element surface honouring the background and border options. */
    protected final void surface(GuiGraphics g, int x, int y, int w, int h, int radius, CirrusConfig c, CirrusTheme t) {
        if (backgroundOn(c)) Gfx.fillRound(g, x, y, w, h, radius, backgroundColor(c, t));
        if (borderOn(c)) Gfx.strokeRound(g, x, y, w, h, radius, 0.5f, t.border);
    }

    // ---- size, scale and drawing --------------------------------------------------------------------------------------

    /** Unscaled size; may depend on the options (for example a layout choice). */
    protected abstract int baseWidth(CirrusConfig c);
    protected abstract int baseHeight(CirrusConfig c);
    /** Draw at scale 1 with the top-left corner at (x, y). */
    protected abstract void draw(GuiGraphics g, int x, int y, float tick, CirrusConfig c);

    private static CirrusConfig config() { return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath()); }

    @Override public final int width() { CirrusConfig c = config(); return Math.max(1, Math.round(baseWidth(c) * scale(c))); }
    @Override public final int height() { CirrusConfig c = config(); return Math.max(1, Math.round(baseHeight(c) * scale(c))); }

    @Override public final void render(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        float s = scale(c);
        if (s == 1f) { draw(g, x, y, tick, c); return; }
        var pose = g.pose();
        pose.pushMatrix();
        pose.translate(x, y);
        pose.scale(s, s);
        draw(g, 0, 0, tick, c);
        pose.popMatrix();
    }
}
