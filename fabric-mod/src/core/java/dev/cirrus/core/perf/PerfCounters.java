package dev.cirrus.core.perf;

/** Counts Cirrus draw operations on the render thread. Cheap increments; read by {@link PerfMeter}. Single-threaded by design. */
public final class PerfCounters {
    public static int fills, masks, icons, texts, clips;
    private PerfCounters() { }

    public static int total() { return fills + masks + icons + texts + clips; }

    public static void reset() { fills = masks = icons = texts = clips = 0; }
}
