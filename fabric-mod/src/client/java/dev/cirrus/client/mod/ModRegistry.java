package dev.cirrus.client.mod;

import java.util.*;
import java.util.function.Consumer;
import dev.cirrus.client.config.CirrusConfig;
import net.minecraft.client.Minecraft;

/** Registration point for feature modules; UI and runtime enumerate this registry. */
public final class ModRegistry {
    private static final Map<String, CirrusMod> MODS = new LinkedHashMap<>();
    private static final Set<String> INITIALIZED = new HashSet<>();
    private ModRegistry() {}
    public static synchronized void register(CirrusMod mod) {
        if (MODS.putIfAbsent(mod.id(), mod) != null) throw new IllegalArgumentException("Duplicate Cirrus mod id: " + mod.id());
    }
    public static synchronized List<CirrusMod> all() { return List.copyOf(MODS.values()); }
    public static synchronized Optional<CirrusMod> find(String id) { return Optional.ofNullable(MODS.get(id)); }
    /** Starts persisted enabled features once the client and instance config are ready. */
    public static synchronized void initialize(CirrusConfig config) {
        for (CirrusMod mod : MODS.values()) {
            if (INITIALIZED.add(mod.id()) && mod.enabled(config)) mod.onEnable(Minecraft.getInstance());
        }
    }
    public static void forEach(Consumer<CirrusMod> action) { all().forEach(action); }
}
