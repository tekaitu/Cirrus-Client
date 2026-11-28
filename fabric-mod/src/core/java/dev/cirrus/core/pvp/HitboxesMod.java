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

/** Shows entity hitboxes using the game's own hitbox display. */
public final class HitboxesMod implements CirrusMod {
    private static final List<Setting> SETTINGS = Collections.unmodifiableList(Arrays.<Setting>asList());

    public String id() { return "hitboxes"; }
    public String name() { return "Hitboxes"; }
    public String description() { return "Shows entity hitboxes using the game's own hitbox display."; }
    public ModCategory category() { return ModCategory.COMBAT; }
    @Override public int icon() { return Icons.CUBE; }
    @Override public List<Setting> settings() { return SETTINGS; }
}
