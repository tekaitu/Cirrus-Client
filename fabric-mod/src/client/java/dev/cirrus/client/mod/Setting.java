package dev.cirrus.client.mod;

import java.util.List;
import java.util.function.UnaryOperator;

/**
 * One user-facing option of a feature: a toggle, a choice from a fixed list, or a bounded number. Values are stored as strings
 * (see {@link ModSettings}); every read goes through {@link #normalize}, so a hand-edited or outdated config can never produce a
 * value the feature does not understand. An option can depend on another one ({@link #requires}); while that is not met the UI
 * shows it disabled and the feature behaves as if it were off.
 */
public final class Setting {
    public enum Kind { TOGGLE, CHOICE, SLIDER }

    private final String key, label, hint, group, def;
    private final Kind kind;
    private final List<String> choices;
    private final int min, max, step;
    private final String unit;
    private final String requiresKey, requiresValue;

    private Setting(String key, String label, String hint, String group, Kind kind, String def, List<String> choices, int min, int max, int step, String unit, String requiresKey, String requiresValue) {
        this.key = key; this.label = label; this.hint = hint; this.group = group; this.kind = kind; this.def = def;
        this.choices = choices; this.min = min; this.max = max; this.step = step; this.unit = unit;
        this.requiresKey = requiresKey; this.requiresValue = requiresValue;
    }

    public static Setting toggle(String key, String label, String hint, boolean def) {
        return new Setting(key, label, hint, "Options", Kind.TOGGLE, Boolean.toString(def), List.of("false", "true"), 0, 1, 1, "", null, null);
    }

    public static Setting choice(String key, String label, String hint, String def, String... choices) {
        List<String> list = List.of(choices);
        if (!list.contains(def)) throw new IllegalArgumentException("default '" + def + "' is not one of " + list);
        return new Setting(key, label, hint, "Options", Kind.CHOICE, def, list, 0, list.size() - 1, 1, "", null, null);
    }

    public static Setting slider(String key, String label, String hint, int def, int min, int max, int step, String unit) {
        if (min >= max || step <= 0 || def < min || def > max) throw new IllegalArgumentException("bad slider range for " + key);
        return new Setting(key, label, hint, "Options", Kind.SLIDER, Integer.toString(def), List.of(), min, max, step, unit, null, null);
    }

    public Setting group(String name) { return new Setting(key, label, hint, name, kind, def, choices, min, max, step, unit, requiresKey, requiresValue); }

    /** Enabled only while the option {@code otherKey} (same feature) has {@code value}. */
    public Setting requires(String otherKey, String value) { return new Setting(key, label, hint, group, kind, def, choices, min, max, step, unit, otherKey, value); }

    public String key() { return key; }
    public String label() { return label; }
    public String hint() { return hint; }
    public String group() { return group; }
    public Kind kind() { return kind; }
    public String defaultValue() { return def; }
    public List<String> choices() { return choices; }
    public int min() { return min; }
    public int max() { return max; }
    public int step() { return step; }
    public String requiresKey() { return requiresKey; }
    public String requiresValue() { return requiresValue; }

    /** A valid value for this option: the given one when it is valid (sliders are clamped and snapped), otherwise the default. */
    public String normalize(String raw) {
        if (raw == null) return def;
        switch (kind) {
            case TOGGLE: return raw.equalsIgnoreCase("true") ? "true" : raw.equalsIgnoreCase("false") ? "false" : def;
            case CHOICE: return choices.contains(raw) ? raw : def;
            default:
                try {
                    int v = Integer.parseInt(raw.trim());
                    v = Math.max(min, Math.min(max, v));
                    v = min + Math.round((float) (v - min) / step) * step;
                    return Integer.toString(Math.min(max, v));
                } catch (NumberFormatException e) { return def; }
        }
    }

    /** True when the dependency (if any) holds; {@code read} returns the normalized current value of another option by key. */
    public boolean active(UnaryOperator<String> read) {
        return requiresKey == null || requiresValue.equals(read.apply(requiresKey));
    }

    /** The value after one step in {@code direction} (+1 / -1). Toggles flip, choices wrap around, sliders stop at their ends. */
    public String step(String current, int direction) {
        String cur = normalize(current);
        switch (kind) {
            case TOGGLE: return cur.equals("true") ? "false" : "true";
            case CHOICE: return choices.get(Math.floorMod(choices.indexOf(cur) + direction, choices.size()));
            default: return normalize(Integer.toString(Integer.parseInt(cur) + direction * step));
        }
    }

    /** Slider value for a position 0..1 along its track. */
    public String fromFraction(double fraction) {
        double f = Math.max(0, Math.min(1, fraction));
        return normalize(Integer.toString((int) Math.round(min + f * (max - min))));
    }

    public double fraction(String value) {
        return kind != Kind.SLIDER ? 0 : (Integer.parseInt(normalize(value)) - min) / (double) (max - min);
    }

    /** Text shown for a value ("80%", "Both", "On"). */
    public String display(String value) {
        String v = normalize(value);
        return switch (kind) {
            case TOGGLE -> v.equals("true") ? "On" : "Off";
            case CHOICE -> v;
            case SLIDER -> v + unit;
        };
    }
}
