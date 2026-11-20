package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;

import java.util.List;

/** Reads and writes feature options in the Cirrus config as {@code mod.<modId>.<key>}, always normalized by their {@link Setting}. */
public final class ModSettings {
    private ModSettings() { }

    public static String configKey(String modId, String key) { return "mod." + modId + "." + key; }

    public static Setting find(List<Setting> all, String key) {
        for (Setting s : all) if (s.key().equals(key)) return s;
        throw new IllegalArgumentException("unknown setting: " + key);
    }

    public static String get(CirrusConfig c, String modId, List<Setting> all, String key) {
        Setting s = find(all, key);
        return s.normalize(c.getString(configKey(modId, key), s.defaultValue()));
    }

    public static boolean bool(CirrusConfig c, String modId, List<Setting> all, String key) { return get(c, modId, all, key).equals("true"); }

    public static int number(CirrusConfig c, String modId, List<Setting> all, String key) { return Integer.parseInt(get(c, modId, all, key)); }

    /** Whether the option's dependency is met right now (an unmet option is shown disabled and treated as off). */
    public static boolean active(CirrusConfig c, String modId, List<Setting> all, Setting s) {
        return s.active(k -> get(c, modId, all, k));
    }

    public static void set(CirrusConfig c, String modId, Setting s, String value) {
        String v = s.normalize(value);
        if (!v.equals(c.getString(configKey(modId, s.key()), s.defaultValue()))) c.put(configKey(modId, s.key()), v);
    }

    public static void reset(CirrusConfig c, String modId, List<Setting> all) {
        for (Setting s : all) set(c, modId, s, s.defaultValue());
    }
}
