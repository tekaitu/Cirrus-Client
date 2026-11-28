package dev.cirrus.core.pvp;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.module.CirrusMod;
import dev.cirrus.core.module.ModCategory;
import dev.cirrus.core.render.Icons;
import dev.cirrus.core.settings.ModSettings;
import dev.cirrus.core.settings.Setting;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** Hold a key to zoom in. The key itself is a normal Minecraft key binding (Controls > Maple), so it can be rebound. */
public final class ZoomMod implements CirrusMod {
    private static final List<Setting> SETTINGS = Collections.unmodifiableList(Arrays.asList(
        Setting.slider("level", "Zoom level", "How much of the normal view you keep while zoomed. Lower zooms in more.", 30, 10, 90, 5, "%"),
        Setting.toggle("smooth", "Smooth zoom", "Ease in and out instead of snapping.", true)));
    public final ZoomState state = new ZoomState();

    public String id() { return "zoom"; }
    public String name() { return "Zoom"; }
    public String description() { return "Hold a key to zoom in, with an adjustable level."; }
    public ModCategory category() { return ModCategory.MOVEMENT; }
    @Override public int icon() { return Icons.ZOOM; }
    @Override public List<Setting> settings() { return SETTINGS; }

    /** Fraction of the normal field of view while zoomed. */
    public float target(CirrusConfig c) { return ModSettings.number(c, id(), SETTINGS, "level") / 100f; }
    public boolean smooth(CirrusConfig c) { return ModSettings.bool(c, id(), SETTINGS, "smooth"); }
}
