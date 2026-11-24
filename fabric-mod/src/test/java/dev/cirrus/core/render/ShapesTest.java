package dev.cirrus.core.render;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ShapesTest {
    private static final int RED = 0xFFFF0000;

    @Test void filledRoundedRectIsThreeFillsAndFourCornerMasks() {
        RecordingCanvas c = new RecordingCanvas(2);
        Shapes.fillRound(c, 10, 10, 100, 40, 4, RED);
        assertEquals(3, c.fills.size());
        assertEquals(4, c.masks.size());
        assertEquals(7, c.ops());
    }

    @Test void strokedRoundedRectIsFourFillsAndFourCornerMasks() {
        RecordingCanvas c = new RecordingCanvas(2);
        Shapes.strokeRound(c, 10, 10, 100, 40, 4, 0.5f, RED);
        assertEquals(4, c.fills.size());
        assertEquals(4, c.masks.size());
    }

    @Test void squareShapesNeedNoMasks() {
        RecordingCanvas c = new RecordingCanvas(3);
        Shapes.fillRound(c, 0, 0, 20, 20, 0, RED);
        assertEquals(1, c.fills.size());
        assertEquals(0, c.masks.size());
        RecordingCanvas s = new RecordingCanvas(3);
        Shapes.strokeRound(s, 0, 0, 20, 20, 0, 1, RED);
        assertEquals(4, s.fills.size());
        assertEquals(0, s.masks.size());
    }

    @Test void nothingIsDrawnForEmptyOrInvisibleShapes() {
        RecordingCanvas c = new RecordingCanvas(2);
        Shapes.fillRound(c, 0, 0, 0, 10, 2, RED);
        Shapes.fillRound(c, 0, 0, 10, -1, 2, RED);
        Shapes.fillRound(c, 0, 0, 10, 10, 2, 0x00FF0000);
        Shapes.strokeRound(c, 0, 0, 0.1f, 10, 2, 1, RED);   // rounds to zero pixels wide at scale 2
        assertEquals(0, c.ops());
        assertEquals(0, c.begins);
    }

    @Test void pixelSpaceIsAlwaysBalancedAndNeverNested() {
        for (int scale = 1; scale <= 4; scale++) {
            RecordingCanvas c = new RecordingCanvas(scale);
            Shapes.fillRound(c, 3.3f, 4.7f, 50.2f, 20.9f, 5, RED);
            Shapes.strokeRound(c, 3.3f, 4.7f, 50.2f, 20.9f, 5, 0.5f, RED);
            Shapes.shadow(c, 3, 3, 30, 30, 4, 6, RED);
            Shapes.hairline(c, 1, 1, 30, RED);
            assertEquals(c.begins, c.ends, "balanced at scale " + scale);
            assertEquals(1, c.maxDepth, "never nested at scale " + scale);
            assertEquals(0, c.depth);
            assertFalse(c.fillOutsidePixelSpace, "fills must happen in pixel space");
        }
    }

    @Test void filledShapeCoversTheExactPixelRectangleWithoutOverlap() {
        for (int scale = 1; scale <= 4; scale++) {
            RecordingCanvas c = new RecordingCanvas(scale);
            Shapes.fillRound(c, 10, 20, 64, 32, 6, RED);
            int px = 10 * scale, py = 20 * scale, pw = 64 * scale, ph = 32 * scale, r = 6 * scale;
            long area = 0;
            for (RecordingCanvas.Fill f : c.fills) {
                assertTrue(f.x0 >= px && f.y0 >= py && f.x1 <= px + pw && f.y1 <= py + ph, "inside bounds at scale " + scale);
                area += (long) (f.x1 - f.x0) * (f.y1 - f.y0);
            }
            for (RecordingCanvas.Mask m : c.masks) {
                assertEquals(r, m.r);
                assertEquals(0, m.t);
                area += (long) r * r;
            }
            assertEquals((long) pw * ph, area, "fills plus corner masks tile the rectangle at scale " + scale);
        }
    }

    @Test void cornerMasksSitInTheFourCorners() {
        RecordingCanvas c = new RecordingCanvas(2);
        Shapes.fillRound(c, 0, 0, 50, 30, 4, RED);
        int r = 8;
        boolean tl = false, tr = false, bl = false, br = false;
        for (RecordingCanvas.Mask m : c.masks) {
            if (m.qx == 0 && m.qy == 0) tl = m.x == 0 && m.y == 0;
            if (m.qx == 1 && m.qy == 0) tr = m.x == 100 - r && m.y == 0;
            if (m.qx == 0 && m.qy == 1) bl = m.x == 0 && m.y == 60 - r;
            if (m.qx == 1 && m.qy == 1) br = m.x == 100 - r && m.y == 60 - r;
        }
        assertTrue(tl && tr && bl && br);
    }

    @Test void radiusIsClampedToHalfTheShortestSide() {
        RecordingCanvas c = new RecordingCanvas(1);
        Shapes.fillRound(c, 0, 0, 20, 10, 999, RED);
        assertEquals(5, c.masks.get(0).r);
    }

    @Test void strokeThicknessNeverDropsBelowOneRealPixel() {
        RecordingCanvas c = new RecordingCanvas(1);
        Shapes.strokeRound(c, 0, 0, 40, 40, 0, 0.01f, RED);
        RecordingCanvas.Fill top = c.fills.get(0);
        assertEquals(1, top.y1 - top.y0);
    }

    @Test void shadowIsFiveLayers() {
        RecordingCanvas c = new RecordingCanvas(2);
        Shapes.shadow(c, 10, 10, 40, 40, 4, 6, 0xFF000000);
        assertEquals(5 * 7, c.ops());
    }

    @Test void hairlineIsOneFillOnePixelHigh() {
        RecordingCanvas c = new RecordingCanvas(3);
        Shapes.hairline(c, 2, 2, 10, RED);
        assertEquals(1, c.fills.size());
        RecordingCanvas.Fill f = c.fills.get(0);
        assertEquals(1, f.y1 - f.y0);
        assertEquals(30, f.x1 - f.x0);
    }
}
