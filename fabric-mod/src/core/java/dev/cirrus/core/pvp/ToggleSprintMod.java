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

/** Tap once to sprint or sneak instead of holding the key. */
public final class ToggleSprintMod implements CirrusMod {
    private static final List<Setting> SETTINGS = Collections.unmodifiableList(Arrays.<Setting>asList(Setting.toggle("sprint", "Toggle sprint", "Tap the sprint key once to keep sprinting.", true),
        Setting.toggle("sneak", "Toggle sneak", "Tap the sneak key once to keep sneaking.", false)));

    public String id() { return "toggle_sprint"; }
    public String name() { return "Toggle Sprint/Sneak"; }
    public String description() { return "Tap once to sprint or sneak instead of holding the key."; }
    public ModCategory category() { return ModCategory.MOVEMENT; }
    @Override public int icon() { return Icons.TOGGLE; }
    @Override public List<Setting> settings() { return SETTINGS; }

    public boolean sprint(CirrusConfig c) { return ModSettings.bool(c, id(), SETTINGS, "sprint"); }
    public boolean sneak(CirrusConfig c) { return ModSettings.bool(c, id(), SETTINGS, "sneak"); }
}
