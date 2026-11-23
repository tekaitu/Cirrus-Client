package dev.cirrus.core.input;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class InputTrackerTest {
    @Test void keysAreHeldBetweenPressAndRelease() {
        InputTracker t = new InputTracker();
        assertFalse(t.isKeyDown(Keys.SPACE));
        t.keyPressed(Keys.SPACE, 0);
        assertTrue(t.isKeyDown(Keys.SPACE));
        assertFalse(t.isKeyDown(Keys.F));
        t.keyReleased(Keys.SPACE, 0);
        assertFalse(t.isKeyDown(Keys.SPACE));
    }

    @Test void modifiersFollowTheLatestEvent() {
        InputTracker t = new InputTracker();
        t.keyPressed(Keys.LEFT_SHIFT, Keys.MOD_SHIFT);
        assertTrue(Keys.hasModifier(t.modifiers(), Keys.MOD_SHIFT));
        t.keyPressed(Keys.F, Keys.MOD_SHIFT | Keys.MOD_CONTROL);
        assertTrue(Keys.hasModifier(t.modifiers(), Keys.MOD_CONTROL));
        t.keyReleased(Keys.F, 0);
        assertEquals(0, t.modifiers());
    }

    @Test void mouseButtonsAreIndependent() {
        InputTracker t = new InputTracker();
        t.mousePressed(MouseButtons.LEFT, 10, 20, 0);
        t.mousePressed(MouseButtons.MIDDLE, 10, 20, 0);
        assertTrue(t.isMouseDown(MouseButtons.LEFT));
        assertFalse(t.isMouseDown(MouseButtons.RIGHT));
        assertTrue(t.isMouseDown(MouseButtons.MIDDLE));
        t.mouseReleased(MouseButtons.LEFT, 10, 20, 0);
        assertFalse(t.isMouseDown(MouseButtons.LEFT));
        assertTrue(t.isMouseDown(MouseButtons.MIDDLE));
    }

    @Test void pointerPositionAndMovementAccumulateUntilEndFrame() {
        InputTracker t = new InputTracker();
        t.mouseMoved(100, 50);
        assertEquals(0, t.mouseDeltaX(), 0.0001, "the first sample has nothing to compare with");
        t.mouseMoved(110, 45);
        t.mouseMoved(115, 60);
        assertEquals(115, t.mouseX(), 0.0001);
        assertEquals(60, t.mouseY(), 0.0001);
        assertEquals(15, t.mouseDeltaX(), 0.0001);
        assertEquals(10, t.mouseDeltaY(), 0.0001);
        t.endFrame();
        assertEquals(0, t.mouseDeltaX(), 0.0001);
        assertEquals(115, t.mouseX(), 0.0001, "position survives the frame boundary");
    }

    @Test void scrollAccumulatesAndClears() {
        InputTracker t = new InputTracker();
        t.mouseScrolled(5, 5, 0, 1);
        t.mouseScrolled(5, 5, 0.5, 2);
        assertEquals(3, t.scrollY(), 0.0001);
        assertEquals(0.5, t.scrollX(), 0.0001);
        t.endFrame();
        assertEquals(0, t.scrollY(), 0.0001);
    }

    @Test void resetReleasesEverythingSoNothingStaysStuck() {
        InputTracker t = new InputTracker();
        t.keyPressed(Keys.UP, Keys.MOD_ALT);
        t.mousePressed(MouseButtons.RIGHT, 1, 1, 0);
        t.reset();
        assertFalse(t.isKeyDown(Keys.UP));
        assertFalse(t.isMouseDown(MouseButtons.RIGHT));
        assertEquals(0, t.modifiers());
    }

    @Test void outOfRangeCodesAreIgnoredSafely() {
        InputTracker t = new InputTracker();
        t.keyPressed(Keys.UNKNOWN, 0);
        t.keyPressed(99999, 0);
        t.mousePressed(42, 0, 0, 0);
        assertFalse(t.isKeyDown(Keys.UNKNOWN));
        assertFalse(t.isKeyDown(99999));
        assertFalse(t.isMouseDown(42));
        assertFalse(t.isMouseDown(-1));
    }

    @Test void listenersReceiveEventsInOrder() {
        InputTracker t = new InputTracker();
        final List<String> log = new ArrayList<String>();
        InputAdapter a = new InputAdapter() {
            @Override public void onKeyPressed(int key, int modifiers) { log.add("down " + key); }
            @Override public void onKeyReleased(int key, int modifiers) { log.add("up " + key); }
            @Override public void onMousePressed(int button, double x, double y, int modifiers) { log.add("press " + button); }
            @Override public void onMouseScrolled(double x, double y, double sx, double sy) { log.add("scroll " + sy); }
        };
        t.addListener(a);
        t.addListener(a);                         // a second registration of the same listener is ignored
        t.keyPressed(Keys.F, 0);
        t.mousePressed(MouseButtons.LEFT, 1, 1, 0);
        t.mouseScrolled(1, 1, 0, -1);
        t.keyReleased(Keys.F, 0);
        assertEquals(java.util.Arrays.asList("down 70", "press 0", "scroll -1.0", "up 70"), log);
        t.removeListener(a);
        t.keyPressed(Keys.F, 0);
        assertEquals(4, log.size());
    }

    @Test void movementEventsOnlyFireWhenThePointerActuallyMoved() {
        InputTracker t = new InputTracker();
        final int[] moves = {0};
        t.addListener(new InputAdapter() { @Override public void onMouseMoved(double x, double y, double dx, double dy) { moves[0]++; } });
        t.mouseMoved(1, 1);
        t.mouseMoved(1, 1);
        t.mouseMoved(2, 1);
        assertEquals(1, moves[0]);
    }
}
