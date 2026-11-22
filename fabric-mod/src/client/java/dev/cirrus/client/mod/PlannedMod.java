package dev.cirrus.client.mod;


import dev.cirrus.core.module.ModStatus;
import dev.cirrus.core.module.ModCategory;
/** A catalogue entry for a feature that is not built yet. It can be seen and searched, but never enabled. */
public final class PlannedMod implements CirrusMod {
    private final PlannedCatalog.Entry entry;
    public PlannedMod(PlannedCatalog.Entry entry) { this.entry = entry; }
    @Override public String id() { return entry.id(); }
    @Override public String name() { return entry.name(); }
    @Override public String description() { return entry.description(); }
    @Override public ModCategory category() { return entry.category(); }
    @Override public int icon() { return entry.glyph(); }
    @Override public ModStatus status() { return ModStatus.PLANNED; }
    @Override public String note() { return entry.note(); }
}
