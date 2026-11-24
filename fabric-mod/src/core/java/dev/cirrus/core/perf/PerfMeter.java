package dev.cirrus.core.perf;

import java.util.Arrays;
import java.util.Locale;

/**
 * Frame-time measurement for Cirrus' own drawing. A {@link Timer} wraps one section (the menu, the HUD), keeps the last
 * {@value #WINDOW} samples in a ring buffer without allocating per frame, and reports average, 95th/99th percentile and worst
 * time plus draw operations per frame. Disabled by default (a single boolean check); enable with {@code -Dcirrus.perf=true}
 * or the config key {@code debug.perf}.
 *
 * <p>These numbers are CPU time spent issuing Cirrus draw calls, not GPU time and not Minecraft's total frame time.
 */
public final class PerfMeter {
    public static final int WINDOW = 600;
    private static boolean enabled = Boolean.getBoolean("cirrus.perf");
    private PerfMeter() { }

    public static boolean enabled() { return enabled; }
    public static void setEnabled(boolean on) { enabled = on; }

    /** Summary of a timer's current window. Times are in milliseconds. */
    public static final class Stats {
        public final String name;
        public final int samples;
        public final double avgMs, p95Ms, p99Ms, maxMs, avgCalls;
        public final int maxCalls;
        Stats(String name, int samples, double avgMs, double p95Ms, double p99Ms, double maxMs, double avgCalls, int maxCalls) {
            this.name = name; this.samples = samples; this.avgMs = avgMs; this.p95Ms = p95Ms; this.p99Ms = p99Ms; this.maxMs = maxMs;
            this.avgCalls = avgCalls; this.maxCalls = maxCalls;
        }
        @Override public String toString() {
            return String.format(Locale.ROOT, "%s: n=%d avg %.3f ms, p95 %.3f, p99 %.3f, max %.3f | draw ops/frame avg %.0f, max %d",
                name, samples, avgMs, p95Ms, p99Ms, maxMs, avgCalls, maxCalls);
        }
    }

    public static final class Timer {
        private final String name;
        private final long[] nanos = new long[WINDOW];
        private final int[] calls = new int[WINDOW];
        private int count, next, callsAtStart;
        private long started;
        public Timer(String name) { this.name = name; }

        public void begin() {
            if (!enabled) return;
            callsAtStart = PerfCounters.total();
            started = System.nanoTime();
        }

        public void end() {
            if (!enabled || started == 0) return;
            nanos[next] = System.nanoTime() - started;
            calls[next] = PerfCounters.total() - callsAtStart;
            next = (next + 1) % WINDOW;
            if (count < WINDOW) count++;
            started = 0;
        }

        public void clear() { count = 0; next = 0; started = 0; }

        public Stats stats() {
            int n = count;
            if (n == 0) return new Stats(name, 0, 0, 0, 0, 0, 0, 0);
            long[] sorted = Arrays.copyOf(nanos, n);
            Arrays.sort(sorted);
            double sum = 0, callSum = 0;
            int maxCalls = 0;
            for (int i = 0; i < n; i++) { sum += nanos[i]; callSum += calls[i]; maxCalls = Math.max(maxCalls, calls[i]); }
            return new Stats(name, n, sum / n / 1e6, percentile(sorted, 0.95), percentile(sorted, 0.99), sorted[n - 1] / 1e6, callSum / n, maxCalls);
        }

        private static double percentile(long[] sorted, double p) {
            int idx = (int) Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
            return sorted[Math.max(0, idx)] / 1e6;
        }
    }

    /** Shared timers for the places Cirrus draws every frame. */
    public static final Timer MENU = new Timer("menu");
    public static final Timer HUD = new Timer("hud");

    public static String report() {
        return MENU.stats() + "\n" + HUD.stats();
    }
}
