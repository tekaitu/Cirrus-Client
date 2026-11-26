package dev.cirrus.core.text;

/** Measures text for layout. Implemented by each version adapter on top of that game's font renderer. Widths are in GUI units. */
public interface TextMetrics {
    int width(String text, TextStyle style);

    /** Height of one line box in GUI units. */
    int lineHeight(TextStyle style);
}
