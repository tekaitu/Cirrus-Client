package dev.cirrus.core.render;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ColorsTest {
    @Test void alphaHelpers() {
        assertEquals(0x80, Colors.alpha(0x80112233));
        assertEquals(0xFF112233, Colors.withAlpha(0x00112233, 255));
        assertEquals(0x00112233, Colors.withAlpha(0xFF112233, -5));
        assertEquals(0xFF112233, Colors.withAlpha(0x00112233, 999));
        assertEquals(0x40112233, Colors.scaleAlpha(0x80112233, 0.5f));
    }

    @Test void mixEndpointsAndMidpoint() {
        assertEquals(0xFF000000, Colors.mix(0xFF000000, 0xFFFFFFFF, 0f));
        assertEquals(0xFFFFFFFF, Colors.mix(0xFF000000, 0xFFFFFFFF, 1f));
        assertEquals(0xFF808080, Colors.mix(0xFF000000, 0xFFFFFFFF, 0.5f));
        assertEquals(0xFFFFFFFF, Colors.mix(0xFF000000, 0xFFFFFFFF, 7f), "t is clamped");
    }
}
