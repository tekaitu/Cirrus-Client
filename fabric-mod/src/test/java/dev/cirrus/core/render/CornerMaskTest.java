package dev.cirrus.core.render;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CornerMaskTest {
    @Test void discIsOpaqueInTheMiddleAndTransparentInTheCorner() {
        int r = 8, size = r * 2;
        int[] a = CornerMask.alpha(r, 0);
        assertEquals(size * size, a.length);
        assertEquals(255, a[(r - 1) * size + (r - 1)]);
        assertEquals(255, a[r * size + r]);
        assertEquals(0, a[0]);
        assertEquals(0, a[size - 1]);
    }

    @Test void maskIsSymmetricInBothAxes() {
        int r = 6, size = r * 2;
        int[] a = CornerMask.alpha(r, 0);
        for (int j = 0; j < size; j++) for (int i = 0; i < size; i++) {
            assertEquals(a[j * size + i], a[j * size + (size - 1 - i)], "mirror x at " + i + "," + j);
            assertEquals(a[j * size + i], a[(size - 1 - j) * size + i], "mirror y at " + i + "," + j);
        }
    }

    @Test void discCoverageIsAboutPiRSquared() {
        int r = 10;
        double sum = 0;
        for (int v : CornerMask.alpha(r, 0)) sum += v / 255.0;
        assertEquals(Math.PI * r * r, sum, Math.PI * r * r * 0.02);
    }

    @Test void ringIsHollow() {
        int r = 10, t = 2, size = r * 2;
        int[] ring = CornerMask.alpha(r, t);
        assertEquals(0, ring[r * size + r], "centre of a ring is empty");
        assertEquals(255, ring[r * size + 1], "the band at the edge is solid");
        double filled = 0, disc = 0;
        for (int v : ring) filled += v / 255.0;
        for (int v : CornerMask.alpha(r, 0)) disc += v / 255.0;
        assertTrue(filled < disc);
    }
}
