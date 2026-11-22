package dev.cirrus.core.input;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Pins the key codes to GLFW's numbering (the numbers are written out because Core must not import GLFW). */
class KeysTest {
    @Test void codesMatchGlfw() {
        assertEquals(-1, Keys.UNKNOWN);
        assertEquals(32, Keys.SPACE);
        assertEquals(70, Keys.F);
        assertEquals(256, Keys.ESCAPE);
        assertEquals(257, Keys.ENTER);
        assertEquals(258, Keys.TAB);
        assertEquals(259, Keys.BACKSPACE);
        assertEquals(261, Keys.DELETE);
        assertEquals(262, Keys.RIGHT);
        assertEquals(263, Keys.LEFT);
        assertEquals(264, Keys.DOWN);
        assertEquals(265, Keys.UP);
        assertEquals(335, Keys.KP_ENTER);
        assertEquals(344, Keys.RIGHT_SHIFT);
        assertEquals(1, Keys.MOD_SHIFT);
        assertEquals(2, Keys.MOD_CONTROL);
        assertEquals(0, MouseButtons.LEFT);
    }

    @Test void helpers() {
        assertTrue(Keys.isConfirm(Keys.ENTER));
        assertTrue(Keys.isConfirm(Keys.KP_ENTER));
        assertFalse(Keys.isConfirm(Keys.SPACE));
        assertTrue(Keys.hasModifier(Keys.MOD_SHIFT | Keys.MOD_CONTROL, Keys.MOD_CONTROL));
        assertFalse(Keys.hasModifier(Keys.MOD_SHIFT, Keys.MOD_CONTROL));
    }
}
