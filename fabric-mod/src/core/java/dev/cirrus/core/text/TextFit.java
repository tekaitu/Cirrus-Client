package dev.cirrus.core.text;

import java.util.ArrayList;
import java.util.List;

/** Text fitting built only on {@link TextMetrics}: ellipsis and word-wrap that behave the same on every Minecraft version. */
public final class TextFit {
    /** Nominal line box of the Cirrus UI fonts in GUI units. */
    public static final int LINE = 9;
    public static final String ELLIPSIS = "…";
    private TextFit() { }

    /** The text, cut with an ellipsis if needed so it never exceeds {@code maxWidth}. Empty when there is no room at all. */
    public static String fit(TextMetrics m, String value, int maxWidth, TextStyle style) {
        if (maxWidth <= 0) return "";
        if (m.width(value, style) <= maxWidth) return value;
        String s = value;
        while (s.length() > 1 && m.width(s + ELLIPSIS, style) > maxWidth) s = s.substring(0, s.length() - 1);
        return s + ELLIPSIS;
    }

    /** Word-wraps to {@code maxWidth}; at most {@code maxLines} lines, the last one ellipsised if the text does not fit. */
    public static List<String> wrap(TextMetrics m, String value, int maxWidth, int maxLines, TextStyle style) {
        List<String> lines = new ArrayList<String>();
        if (value == null || value.trim().isEmpty() || maxWidth <= 0 || maxLines <= 0) return lines;
        StringBuilder line = new StringBuilder();
        String[] words = value.trim().split("\\s+");
        for (int i = 0; i < words.length; i++) {
            String candidate = line.length() == 0 ? words[i] : line + " " + words[i];
            if (line.length() == 0 || m.width(candidate, style) <= maxWidth) { line = new StringBuilder(candidate); continue; }
            lines.add(line.toString());
            if (lines.size() == maxLines) {
                StringBuilder rest = new StringBuilder(lines.get(maxLines - 1));
                for (int j = i; j < words.length; j++) rest.append(' ').append(words[j]);
                lines.set(maxLines - 1, fit(m, rest.toString(), maxWidth, style));
                return lines;
            }
            line = new StringBuilder(words[i]);
        }
        if (line.length() > 0) lines.add(fit(m, line.toString(), maxWidth, style));
        return lines;
    }
}
