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

/** Removes the screen tilt when you take damage. */
public final class DamageTiltMod implements CirrusMod {
    private static final List<Setting> SETTINGS = Collections.unmodifiableList(Arrays.<Setting>asList());

    public String id() { return "damage_tilt"; }
    public String name() { return "Damage Tilt"; }
    public String description() { return "Removes the screen tilt when you take damage."; }
    public ModCategory category() { return ModCategory.PLAYER; }
    @Override public int icon() { return Icons.TILT; }
    @Override public List<Setting> settings() { return SETTINGS; }
}
