package dev.cirrus.core.profile;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.module.CirrusMod;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.module.ModRegistry;

import java.io.IOException;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Profiles: named snapshots of every module option (enabled switches, per-module settings, HUD positions and sizes).
 * Switching applies a snapshot, saving overwrites it with the current settings, sharing copies a code to the clipboard.
 * Key bindings live in Minecraft's own options.txt and are not part of a profile.
 */
public final class Profiles {
    private static final String ACTIVE = "profile.active";
    private final ProfileStore store;
    private final CirrusConfig config;

    /** @param gameDir the instance's game directory; settings and profiles live under {@code config/cirrus-client}. */
    public Profiles(Path gameDir) {
        this.config = CirrusConfig.get(gameDir);
        this.store = new ProfileStore(gameDir.resolve("config/cirrus-client/profiles"));
    }

    public List<String> names() { return store.names(); }
    public String active() { String a = config.getString(ACTIVE, ""); return store.exists(a) ? a : ""; }
    public boolean atLimit() { return store.names().size() >= ProfileStore.MAX_PROFILES; }

    private Map<String, String> current() { return config.snapshot(ProfileCodec::allowedKey); }

    /** Saves the current settings as a new profile and makes it the active one. Returns the name actually used. */
    public String create(String wanted) throws IOException {
        String name = store.uniqueName(wanted);
        store.save(name, current());
        config.put(ACTIVE, name);
        return name;
    }

    /** Overwrites a profile with the current settings. */
    public void save(String name) throws IOException { store.save(name, current()); config.put(ACTIVE, name); }

    public void delete(String name) throws IOException {
        store.delete(name);
        if (name.equalsIgnoreCase(config.getString(ACTIVE, ""))) config.put(ACTIVE, "");
    }

    /** Applies a profile: every module option is replaced, and modules start or stop as their switch changes. */
    public void apply(String name) throws IOException { applyValues(name, store.load(name)); }

    private void applyValues(String name, Map<String, String> values) {
        Map<String, Boolean> before = new HashMap<>();
        for (CirrusMod m : ModRegistry.all()) before.put(m.id(), m.enabled(config));
        config.replace(ProfileCodec::allowedKey, values);
        config.put(ACTIVE, name);
        ModContext ctx = ModRegistry.isBound() ? ModRegistry.context() : null;
        for (CirrusMod m : ModRegistry.all()) {
            Boolean wasOn = before.get(m.id());
            boolean was = wasOn != null && wasOn, now = m.enabled(config);
            if (ctx == null) continue;
            if (now && !was) m.onEnable(ctx); else if (!now && was) m.onDisable(ctx);
        }
    }

    /** The share code for a saved profile. */
    public String share(String name) throws IOException { return ProfileCodec.encode(name, store.load(name)); }

    /** The share code for the settings as they are right now. */
    public String shareCurrent() { String a = active(); return ProfileCodec.encode(a.isEmpty() ? "Shared" : a, current()); }

    /** Imports a share code as a new saved profile (it is not applied). Returns the name used. */
    public String importCode(String code) throws IOException {
        ProfileCodec.Profile p = ProfileCodec.decode(code);
        String name = store.uniqueName(p.name());
        store.save(name, p.values());
        return name;
    }
}
