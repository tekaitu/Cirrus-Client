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

/** Uses unaccelerated mouse movement. */
public final class RawInputMod implements CirrusMod {
    private static final List<Setting> SETTINGS = Collections.unmodifiableList(Arrays.<Setting>asList());

    public String id() { return "raw_input"; }
    public String name() { return "Raw Mouse Input"; }
    public String description() { return "Uses unaccelerated mouse movement."; }
    public ModCategory category() { return ModCategory.PLAYER; }
    @Override public int icon() { return Icons.MOUSE; }
    @Override public List<Setting> settings() { return SETTINGS; }
}
