package dev.cirrus.core.perf;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PerfMeterTest {
    @Test void disabledMeterRecordsNothing() {
        boolean before = PerfMeter.enabled();
        try {
            PerfMeter.setEnabled(false);
            PerfMeter.Timer t = new PerfMeter.Timer("off");
            t.begin(); t.end();
            assertEquals(0, t.stats().samples);
        } finally { PerfMeter.setEnabled(before); }
    }

    @Test void timerRecordsDurationsAndDrawOps() throws Exception {
        boolean before = PerfMeter.enabled();
        try {
            PerfMeter.setEnabled(true);
            PerfCounters.reset();
            PerfMeter.Timer t = new PerfMeter.Timer("on");
            for (int i = 0; i < 10; i++) {
                t.begin();
                PerfCounters.fills += 3; PerfCounters.masks += 4;
                Thread.sleep(2);
                t.end();
            }
            PerfMeter.Stats s = t.stats();
            assertEquals(10, s.samples);
            assertTrue(s.avgMs >= 1.5, "slept 2 ms per frame but measured " + s.avgMs);
            assertTrue(s.maxMs >= s.p99Ms && s.p99Ms >= s.p95Ms && s.p95Ms >= 0);
            assertEquals(7.0, s.avgCalls, 0.0001);
            assertEquals(7, s.maxCalls);
            t.clear();
            assertEquals(0, t.stats().samples);
        } finally { PerfMeter.setEnabled(before); PerfCounters.reset(); }
    }

    @Test void windowKeepsOnlyTheLatestSamples() {
        boolean before = PerfMeter.enabled();
        try {
            PerfMeter.setEnabled(true);
            PerfMeter.Timer t = new PerfMeter.Timer("ring");
            for (int i = 0; i < PerfMeter.WINDOW + 50; i++) { t.begin(); t.end(); }
            assertEquals(PerfMeter.WINDOW, t.stats().samples);
        } finally { PerfMeter.setEnabled(before); }
    }

    @Test void endWithoutBeginIsIgnored() {
        boolean before = PerfMeter.enabled();
        try {
            PerfMeter.setEnabled(true);
            PerfMeter.Timer t = new PerfMeter.Timer("x");
            t.end();
            assertEquals(0, t.stats().samples);
        } finally { PerfMeter.setEnabled(before); }
    }
}
