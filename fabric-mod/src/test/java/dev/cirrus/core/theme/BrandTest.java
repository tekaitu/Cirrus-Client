package dev.cirrus.core.theme;

import dev.cirrus.core.render.Colors;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class BrandTest {
    @Test void mainColourIsMapleOrange() {
        assertEquals(0xFFE25303, Brand.MAIN);
        assertEquals("Maple Client", Brand.NAME);
    }

    @Test void shadesAreMixesOfTheMainColourWithWhiteAndBlack() {
        assertEquals(Brand.LIGHT, Colors.mix(Brand.MAIN, 0xFFFFFFFF, 0.25f), "light");
        assertEquals(Brand.LIGHTER, Colors.mix(Brand.MAIN, 0xFFFFFFFF, 0.5f), "lighter");
        assertEquals(Brand.LIGHTEST, Colors.mix(Brand.MAIN, 0xFFFFFFFF, 0.75f), "lightest");
        assertEquals(Brand.DARK, Colors.mix(Brand.MAIN, 0xFF000000, 0.25f), "dark");
        assertEquals(Brand.DARKER, Colors.mix(Brand.MAIN, 0xFF000000, 0.5f), "darker");
        assertEquals(Brand.DARKEST, Colors.mix(Brand.MAIN, 0xFF000000, 0.75f), "darkest");
    }

    @Test void shadeLadderGetsMonotonicallyDarker() {
        int[] ladder = {Brand.LIGHTEST, Brand.LIGHTER, Brand.LIGHT, Brand.MAIN, Brand.DARK, Brand.DARKER, Brand.DARKEST};
        for (int i = 1; i < ladder.length; i++) assertTrue(luma(ladder[i]) < luma(ladder[i - 1]), "step " + i);
    }

    @Test void themeUsesTheBrandShades() {
        assertEquals(Brand.MAIN, CirrusTheme.DARK.accent);
        assertEquals(Brand.LIGHT, CirrusTheme.DARK.accentLight);
        assertEquals(Brand.DARK, CirrusTheme.DARK.accentDark);
    }

    @Test void markIsSquare() {
        assertEquals(24, Brand.markWidth(24));
        assertEquals(1, Brand.markWidth(0));
    }

    private static double luma(int c) { return 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255); }
}
