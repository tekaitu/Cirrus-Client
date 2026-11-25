package dev.cirrus.core.hud;

import dev.cirrus.core.settings.Setting;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FormatTemplateTest {
    @Test void defaultIsJustTheValueInParentheses() {
        assertEquals("(400)", FormatTemplate.apply(FormatTemplate.template(FormatTemplate.DEFAULT, "FPS", ""), "400"));
        assertEquals("(52)", FormatTemplate.apply(FormatTemplate.template(FormatTemplate.DEFAULT, "Ping", "ms"), "52"));
    }

    @Test void everyStyleForAWidgetWithoutAUnit() {
        assertEquals("(400)", render(FormatTemplate.PARENTHESES, "FPS", "", "400"));
        assertEquals("400", render(FormatTemplate.PLAIN, "FPS", "", "400"));
        assertEquals("FPS: 400", render(FormatTemplate.LABEL, "FPS", "", "400"));
        assertEquals("400 FPS", render(FormatTemplate.SUFFIX, "FPS", "", "400"));
        assertEquals("[400]", render(FormatTemplate.BRACKETS, "FPS", "", "400"));
    }

    @Test void everyStyleForAWidgetWithAUnit() {
        assertEquals("Ping: 52 ms", render(FormatTemplate.LABEL, "Ping", "ms", "52"));
        assertEquals("52 ms", render(FormatTemplate.SUFFIX, "Ping", "ms", "52"));
        assertEquals("(52)", render(FormatTemplate.PARENTHESES, "Ping", "ms", "52"));
    }

    @Test void unknownOrMissingStyleFallsBackToTheDefault() {
        assertEquals("(7)", render("Nonsense", "FPS", "", "7"));
        assertEquals("(7)", render(null, "FPS", "", "7"));
    }

    @Test void everyBuiltInTemplateIsValidAndHasOnePlaceholder() {
        for (String style : FormatTemplate.STYLES) assertTrue(FormatTemplate.valid(FormatTemplate.template(style, "FPS", "ms")), style);
        assertTrue(FormatTemplate.valid(FormatTemplate.template(FormatTemplate.LABEL, null, null)));
    }

    @Test void validationRejectsUnsafeTemplates() {
        assertFalse(FormatTemplate.valid(null));
        assertFalse(FormatTemplate.valid("no placeholder"));
        assertFalse(FormatTemplate.valid("{value} and {value}"));
        assertFalse(FormatTemplate.valid("{value}\n"));
        assertFalse(FormatTemplate.valid("{value}" + "x".repeat(40)));
        assertTrue(FormatTemplate.valid("{value}"));
    }

    @Test void applyNeverShowsAnInvalidTemplate() {
        assertEquals("12", FormatTemplate.apply("oops", "12"));
        assertEquals("", FormatTemplate.apply("oops", null));
        assertEquals("<12>", FormatTemplate.apply("<{value}>", "12"));
    }

    @Test void valueContainingPlaceholderTextIsNotReinterpreted() {
        assertEquals("({value})", FormatTemplate.apply("({value})", "{value}"));
    }

    @Test void settingOffersEveryStyleWithTheDefaultFirstChoiceValid() {
        Setting s = FormatTemplate.setting();
        assertEquals("format", s.key());
        assertEquals(FormatTemplate.STYLES, s.choices());
        assertEquals(FormatTemplate.DEFAULT, s.defaultValue());
        assertEquals(FormatTemplate.DEFAULT, s.normalize("{value} hand edited"), "a hand-edited config cannot inject a template");
    }

    @Test void cacheReturnsTheSameStringUntilSomethingChanges() {
        FormatTemplate.Cache cache = new FormatTemplate.Cache();
        String a = cache.get("Label", "FPS", "", "60");
        assertEquals("FPS: 60", a);
        assertSame(a, cache.get("Label", "FPS", "", "60"));
        String b = cache.get("Label", "FPS", "", "61");
        assertEquals("FPS: 61", b);
        assertEquals("(61)", cache.get("Parentheses", "FPS", "", "61"));
        assertEquals("(--)", cache.get("Parentheses", "FPS", "", "--"));
    }

    private static String render(String style, String label, String unit, String value) {
        return FormatTemplate.apply(FormatTemplate.template(style, label, unit), value);
    }
}
