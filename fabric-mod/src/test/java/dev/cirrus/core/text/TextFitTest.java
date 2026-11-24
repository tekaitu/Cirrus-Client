package dev.cirrus.core.text;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TextFitTest {
    /** Every character is 6 wide in BODY and 4 wide otherwise, so expectations are exact. */
    private static final TextMetrics FIXED = new TextMetrics() {
        @Override public int width(String text, TextStyle style) { return text.length() * (style == TextStyle.BODY ? 6 : 4); }
        @Override public int lineHeight(TextStyle style) { return 9; }
    };

    @Test void textThatFitsIsUntouched() {
        assertEquals("hello", TextFit.fit(FIXED, "hello", 30, TextStyle.BODY));
    }

    @Test void longTextEndsWithAnEllipsisAndFits() {
        String s = TextFit.fit(FIXED, "hello world", 30, TextStyle.BODY);
        assertTrue(s.endsWith(TextFit.ELLIPSIS));
        assertTrue(FIXED.width(s, TextStyle.BODY) <= 30);
        assertEquals("hell…", s);
    }

    @Test void noRoomGivesEmptyString() {
        assertEquals("", TextFit.fit(FIXED, "hello", 0, TextStyle.BODY));
        assertEquals("", TextFit.fit(FIXED, "hello", -3, TextStyle.BODY));
    }

    @Test void styleChangesTheMeasurement() {
        assertEquals("hello", TextFit.fit(FIXED, "hello", 20, TextStyle.SMALL));
        assertNotEquals("hello", TextFit.fit(FIXED, "hello", 20, TextStyle.BODY));
    }

    @Test void wrapBreaksAtWordsAndRespectsTheWidth() {
        List<String> lines = TextFit.wrap(FIXED, "one two three four", 36, 10, TextStyle.SMALL);   // 9 chars per line
        assertEquals(List.of("one two", "three", "four"), lines);
        for (String l : lines) assertTrue(FIXED.width(l, TextStyle.SMALL) <= 36);
    }

    @Test void wrapStopsAtMaxLinesAndEllipsisesTheLast() {
        List<String> lines = TextFit.wrap(FIXED, "alpha beta gamma delta epsilon", 28, 2, TextStyle.SMALL);   // 7 chars per line
        assertEquals(2, lines.size());
        assertTrue(lines.get(1).endsWith(TextFit.ELLIPSIS));
        assertTrue(FIXED.width(lines.get(1), TextStyle.SMALL) <= 28);
    }

    @Test void wrapHandlesEmptyAndDegenerateInput() {
        assertTrue(TextFit.wrap(FIXED, null, 50, 3, TextStyle.SMALL).isEmpty());
        assertTrue(TextFit.wrap(FIXED, "   ", 50, 3, TextStyle.SMALL).isEmpty());
        assertTrue(TextFit.wrap(FIXED, "text", 0, 3, TextStyle.SMALL).isEmpty());
        assertTrue(TextFit.wrap(FIXED, "text", 50, 0, TextStyle.SMALL).isEmpty());
    }

    @Test void aSingleWordWiderThanTheLineIsEllipsisedNotDropped() {
        List<String> lines = TextFit.wrap(FIXED, "supercalifragilistic", 20, 3, TextStyle.SMALL);
        assertEquals(1, lines.size());
        assertTrue(FIXED.width(lines.get(0), TextStyle.SMALL) <= 20);
    }
}
