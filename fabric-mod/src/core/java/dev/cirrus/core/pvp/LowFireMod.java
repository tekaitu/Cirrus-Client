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

/** Lowers the fire overlay so it blocks less of the view. */
public final class LowFireMod implements CirrusMod {
    private static final List<Setting> SETTINGS = Collections.unmodifiableList(Arrays.<Setting>asList(Setting.slider("amount", "Lower by", "How far the fire overlay moves down.", 50, 10, 100, 10, "%")));

    public String id() { return "low_fire"; }
    public String name() { return "Low Fire"; }
    public String description() { return "Lowers the fire overlay so it blocks less of the view."; }
    public ModCategory category() { return ModCategory.RENDER; }
    @Override public int icon() { return Icons.FLAME; }
    @Override public List<Setting> settings() { return SETTINGS; }

    /** How far to move the overlay down, in the game's view units (about half a block at 100%). */
    public float offset(CirrusConfig c) { return ModSettings.number(c, id(), SETTINGS, "amount") / 100f * 0.5f; }
}
