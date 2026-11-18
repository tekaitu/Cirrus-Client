package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;

/** Base for modules that are both a library entry (toggle, favourite) and a movable HUD element. One switch controls both. */
public abstract class HudMod implements CirrusMod, HudElement {
    @Override public boolean defaultEnabled() { return true; }
    @Override public boolean enabled(CirrusConfig c) { return CirrusMod.super.enabled(c); }
    @Override public void setEnabled(CirrusConfig c, boolean value) { CirrusMod.super.setEnabled(c, value); }
    @Override public String label() { return name(); }
}
