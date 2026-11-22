package dev.cirrus.client.render;

import dev.cirrus.core.perf.PerfMeter;
import dev.cirrus.core.render.Canvas;
import dev.cirrus.core.text.TextStyle;

/** Developer overlay with the live {@link PerfMeter} numbers. Invisible unless perf measurement is switched on. */
public final class PerfOverlay {
    private static String line1 = "", line2 = "";
    private static long refreshed;
    private PerfOverlay() { }

    public static void draw(Canvas c, int screenHeight) {
        if (!PerfMeter.enabled()) return;
        long now = System.currentTimeMillis();
        if (now - refreshed > 500) {            // formatting allocates, so only refresh twice a second
            refreshed = now;
            PerfMeter.Stats s = PerfMeter.MENU.stats();
            line1 = String.format(java.util.Locale.ROOT, "Cirrus menu  avg %.2f ms  p99 %.2f ms  max %.2f ms", s.avgMs, s.p99Ms, s.maxMs);
            line2 = String.format(java.util.Locale.ROOT, "draw ops/frame avg %.0f  max %d  (n=%d, CPU time only)", s.avgCalls, s.maxCalls, s.samples);
        }
        c.text(line1, TextStyle.SMALL, 4, screenHeight - 22, 0xFFFFFF55, true);
        c.text(line2, TextStyle.SMALL, 4, screenHeight - 12, 0xFFFFFF55, true);
    }
}
