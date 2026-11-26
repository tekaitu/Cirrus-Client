package dev.cirrus.core.hud;

import dev.cirrus.core.settings.Setting;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * How an informational widget writes its value. A template is plain text with exactly one {@code {value}} placeholder, so the
 * default can be just "(400)" with no forced label. Players choose a named style; the style is what is stored in the config (and
 * in profiles and share codes), so a hand-edited or outdated value can never produce a template the widget does not understand.
 */
public final class FormatTemplate {
    private FormatTemplate() { }

    public static final String VALUE = "{value}";
    public static final String PARENTHESES = "Parentheses", PLAIN = "Plain", LABEL = "Label", SUFFIX = "Suffix", BRACKETS = "Brackets";
    public static final List<String> STYLES = Collections.unmodifiableList(Arrays.asList(PARENTHESES, PLAIN, LABEL, SUFFIX, BRACKETS));
    public static final String DEFAULT = PARENTHESES;
    private static final int MAX_LENGTH = 40;

    /** The shared "Format" option for informational widgets; the widget supplies its label and unit when it draws. */
    public static Setting setting() {
        return Setting.choice("format", "Format", "How the value is written, for example (400), 400, FPS: 400 or 400 FPS.", DEFAULT,
            STYLES.toArray(new String[0])).group("Text");
    }

    /**
     * The template for a style. {@code label} names the widget ("FPS"); {@code unit} is what follows the number ("ms"), or empty.
     * An unknown style gets the default one.
     */
    public static String template(String style, String label, String unit) {
        String l = label == null ? "" : label, u = unit == null ? "" : unit;
        if (PLAIN.equals(style)) return VALUE;
        if (LABEL.equals(style)) return l + ": " + VALUE + (u.isEmpty() ? "" : " " + u);
        if (SUFFIX.equals(style)) return VALUE + " " + (u.isEmpty() ? l : u);
        if (BRACKETS.equals(style)) return "[" + VALUE + "]";
        return "(" + VALUE + ")";
    }

    /** True when the template has exactly one placeholder, is not too long and has no control characters. */
    public static boolean valid(String template) {
        if (template == null || template.length() > MAX_LENGTH) return false;
        int at = template.indexOf(VALUE);
        if (at < 0 || template.indexOf(VALUE, at + 1) >= 0) return false;
        for (int i = 0; i < template.length(); i++) if (template.charAt(i) < 32) return false;
        return true;
    }

    /** The template with the value put in; an invalid template shows the bare value rather than anything unexpected. */
    public static String apply(String template, String value) {
        String v = value == null ? "" : value;
        if (!valid(template)) return v;
        int at = template.indexOf(VALUE);
        return template.substring(0, at) + v + template.substring(at + VALUE.length());
    }

    /** Remembers the last result so a widget that draws the same text every frame builds no new strings. */
    public static final class Cache {
        private String style, label, unit, value, result;

        public String get(String style, String label, String unit, String value) {
            if (result == null || !same(style, this.style) || !same(label, this.label) || !same(unit, this.unit) || !same(value, this.value)) {
                result = apply(template(style, label, unit), value);
                this.style = style; this.label = label; this.unit = unit; this.value = value;
            }
            return result;
        }

        private static boolean same(String a, String b) { return a == null ? b == null : a.equals(b); }
    }
}
