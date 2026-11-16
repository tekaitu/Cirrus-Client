package dev.cirrus.client.mod;

import java.util.*;
import java.util.function.Consumer;

/** Registration point for feature modules; UI and runtime enumerate this registry. */
public final class ModRegistry {
    private static final Map<String, CirrusMod> MODS = new LinkedHashMap<>();
    private ModRegistry() {}
    public static synchronized void register(CirrusMod mod) {
        if (MODS.putIfAbsent(mod.id(), mod) != null) throw new IllegalArgumentException("Duplicate Cirrus mod id: " + mod.id());
    }
    public static synchronized List<CirrusMod> all() { return List.copyOf(MODS.values()); }
    public static synchronized Optional<CirrusMod> find(String id) { return Optional.ofNullable(MODS.get(id)); }
    public static void forEach(Consumer<CirrusMod> action) { all().forEach(action); }
}
