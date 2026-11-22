package dev.cirrus.core.anim;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class AnimTest {
    @Test void approachMovesTowardTargetAndSettlesExactly() {
        float v = 0f;
        for (int i = 0; i < 200; i++) v = Anim.approach(v, 1f, 0.016f, 18f);
        assertEquals(1f, v);
        float mid = Anim.approach(0f, 1f, 0.016f, 18f);
        assertTrue(mid > 0f && mid < 1f);
    }

    @Test void approachIsFrameRateIndependent() {
        float coarse = Anim.approach(0f, 1f, 0.032f, 12f);
        float fine = Anim.approach(Anim.approach(0f, 1f, 0.016f, 12f), 1f, 0.016f, 12f);
        assertEquals(coarse, fine, 0.001f);
    }

    @Test void easeOutIsClampedAndMonotonic() {
        assertEquals(0f, Anim.easeOut(-1f));
        assertEquals(1f, Anim.easeOut(2f));
        float last = -1f;
        for (int i = 0; i <= 10; i++) { float e = Anim.easeOut(i / 10f); assertTrue(e >= last); last = e; }
    }
}
