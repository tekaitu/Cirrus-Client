package dev.cirrus.client.mod;

import java.util.*;

/** HUD element registration is independent of both editor UI and rendering runtime. */
public final class HudElementRegistry {
    private static final Map<String, HudElement> ELEMENTS = new LinkedHashMap<>();
    private HudElementRegistry() {}
    public static synchronized void register(HudElement element) {
        if (ELEMENTS.putIfAbsent(element.id(), element) != null) throw new IllegalArgumentException("Duplicate HUD element id: " + element.id());
    }
    public static synchronized List<HudElement> all() { return List.copyOf(ELEMENTS.values()); }
    public static synchronized Optional<HudElement> find(String id) { return Optional.ofNullable(ELEMENTS.get(id)); }
}
