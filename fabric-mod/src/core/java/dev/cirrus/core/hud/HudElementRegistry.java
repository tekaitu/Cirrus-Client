package dev.cirrus.core.hud;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** HUD element registration is independent of both the editor UI and the rendering runtime. {@link #all()} does not allocate. */
public final class HudElementRegistry {
    private static final Map<String, HudElement> ELEMENTS = new LinkedHashMap<String, HudElement>();
    private static volatile List<HudElement> snapshot = Collections.emptyList();

    private HudElementRegistry() { }

    public static synchronized void register(HudElement element) {
        if (ELEMENTS.containsKey(element.id())) throw new IllegalArgumentException("Duplicate HUD element id: " + element.id());
        ELEMENTS.put(element.id(), element);
        snapshot = Collections.unmodifiableList(new ArrayList<HudElement>(ELEMENTS.values()));
    }

    public static List<HudElement> all() { return snapshot; }

    public static synchronized Optional<HudElement> find(String id) { return Optional.ofNullable(ELEMENTS.get(id)); }

    /** Empties the registry. For tests. */
    public static synchronized void reset() { ELEMENTS.clear(); snapshot = Collections.emptyList(); }
}
