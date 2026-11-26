package dev.cirrus.core.hud;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SnapEngineTest {
    private static final int SW = 400, SH = 240;

    @Test void snapsToTheLeftAndTopEdgesWithinTheThreshold() {
        SnapEngine.Result r = SnapEngine.snap(5, 4, 40, 16, SW, SH, null, 6);
        assertEquals(0, r.x);
        assertEquals(0, r.y);
        assertEquals(0, r.guideX);
        assertEquals(0, r.guideY);
        assertTrue(r.snappedX() && r.snappedY());
    }

    @Test void doesNotSnapBeyondTheThreshold() {
        SnapEngine.Result r = SnapEngine.snap(20, 30, 40, 16, SW, SH, null, 6);
        assertEquals(20, r.x);
        assertEquals(30, r.y);
        assertEquals(SnapEngine.NONE, r.guideX);
        assertEquals(SnapEngine.NONE, r.guideY);
        assertFalse(r.snappedX() || r.snappedY());
    }

    @Test void thresholdOfZeroDisablesSnapping() {
        SnapEngine.Result r = SnapEngine.snap(1, 1, 40, 16, SW, SH, null, 0);
        assertEquals(1, r.x);
        assertEquals(1, r.y);
        assertFalse(r.snappedX() || r.snappedY());
    }

    @Test void centresOnTheScreen() {
        // a 40x16 box whose centre is 3 units left of and 2 units above the screen centre
        SnapEngine.Result r = SnapEngine.snap(SW / 2 - 20 - 3, SH / 2 - 8 - 2, 40, 16, SW, SH, null, 6);
        assertEquals(SW / 2 - 20, r.x);
        assertEquals(SH / 2 - 8, r.y);
        assertEquals(SW / 2, r.guideX);
        assertEquals(SH / 2, r.guideY);
    }

    @Test void snapsTheRightAndBottomEdgesToTheScreenEdges() {
        SnapEngine.Result r = SnapEngine.snap(SW - 40 - 4, SH - 16 - 5, 40, 16, SW, SH, null, 6);
        assertEquals(SW - 40, r.x);
        assertEquals(SH - 16, r.y);
        assertEquals(SW, r.guideX);
        assertEquals(SH, r.guideY);
    }

    @Test void snapsToAnotherWidgetsEdgesAndCentre() {
        List<int[]> others = Collections.singletonList(new int[] {100, 50, 60, 20});   // lines: x 100, 130, 160; y 50, 60, 70
        // a box 8 wide: its edges are at x, x+4 and x+8, so each case below has one clearly nearest line
        SnapEngine.Result left = SnapEngine.snap(103, 120, 8, 10, SW, SH, others, 6);     // left edge 3 from 100
        assertEquals(100, left.x);
        assertEquals(100, left.guideX);
        SnapEngine.Result right = SnapEngine.snap(153, 120, 8, 10, SW, SH, others, 6);    // right edge 161, 1 from 160
        assertEquals(152, right.x);
        assertEquals(160, right.guideX);
        SnapEngine.Result mid = SnapEngine.snap(125, 120, 8, 10, SW, SH, others, 6);      // centre 129, 1 from 130
        assertEquals(126, mid.x);
        assertEquals(130, mid.guideX);
        SnapEngine.Result below = SnapEngine.snap(300, 73, 8, 10, SW, SH, others, 6);     // top 73, 3 from the bottom edge 70
        assertEquals(70, below.y);
        assertEquals(70, below.guideY);
    }

    @Test void picksTheNearestLineWhenSeveralAreInRange() {
        List<int[]> others = Arrays.asList(new int[] {50, 0, 10, 10}, new int[] {54, 0, 10, 10});
        SnapEngine.Result r = SnapEngine.snap(53, 100, 20, 10, SW, SH, others, 6);       // left edge: 54 is 1 away, 50 is 3 away
        assertEquals(54, r.x);
        assertEquals(54, r.guideX);
    }

    @Test void axesAreIndependent() {
        SnapEngine.Result r = SnapEngine.snap(2, 60, 40, 16, SW, SH, null, 6);
        assertEquals(0, r.x);
        assertEquals(60, r.y);
        assertTrue(r.snappedX());
        assertFalse(r.snappedY());
    }

    @Test void snappedPositionIsAFixedPoint() {
        SnapEngine.Result once = SnapEngine.snap(5, 5, 40, 16, SW, SH, null, 6);
        SnapEngine.Result twice = SnapEngine.snap(once.x, once.y, 40, 16, SW, SH, null, 6);
        assertEquals(once.x, twice.x);
        assertEquals(once.y, twice.y);
    }
}
