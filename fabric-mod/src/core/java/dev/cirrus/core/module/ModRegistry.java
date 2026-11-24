package dev.cirrus.core.module;

import dev.cirrus.core.config.CirrusConfig;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;

/**
 * Registration point for feature modules; UI and runtime enumerate this registry. It also holds the one {@link ModContext} the
 * version adapter binds at start-up (a client runs one game instance, so one context). {@link #all()} returns a snapshot that is
 * rebuilt only when a module is registered, so calling it every frame does not allocate.
 */
public final class ModRegistry {
    private static final Map<String, CirrusMod> MODS = new LinkedHashMap<String, CirrusMod>();
    private static final Set<String> INITIALIZED = new HashSet<String>();
    private static volatile List<CirrusMod> snapshot = Collections.emptyList();
    private static volatile ModContext context;

    private ModRegistry() { }

    /** Called once by the version adapter before modules are initialised. */
    public static void bind(ModContext modContext) { context = modContext; }

    public static boolean isBound() { return context != null; }

    /** The bound context. Throws if the adapter has not bound one yet. */
    public static ModContext context() {
        ModContext c = context;
        if (c == null) throw new IllegalStateException("No ModContext bound: the version adapter must call ModRegistry.bind first");
        return c;
    }

    public static synchronized void register(CirrusMod mod) {
        if (MODS.containsKey(mod.id())) throw new IllegalArgumentException("Duplicate Cirrus mod id: " + mod.id());
        MODS.put(mod.id(), mod);
        snapshot = Collections.unmodifiableList(new ArrayList<CirrusMod>(MODS.values()));
    }

    public static List<CirrusMod> all() { return snapshot; }

    public static synchronized Optional<CirrusMod> find(String id) { return Optional.ofNullable(MODS.get(id)); }

    /** Starts persisted enabled features once the client and instance config are ready. */
    public static synchronized void initialize(CirrusConfig config) {
        ModContext ctx = context();
        for (CirrusMod mod : MODS.values()) {
            if (INITIALIZED.add(mod.id()) && mod.enabled(config)) mod.onEnable(ctx);
        }
    }

    public static void forEach(Consumer<CirrusMod> action) { for (CirrusMod m : snapshot) action.accept(m); }

    /** Empties the registry and unbinds the context. For tests. */
    public static synchronized void reset() {
        MODS.clear();
        INITIALIZED.clear();
        snapshot = Collections.emptyList();
        context = null;
    }
}
