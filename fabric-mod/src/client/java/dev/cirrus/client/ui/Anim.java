package dev.cirrus.client.ui;

import net.minecraft.Util;

/** Small time-based animation helpers so motion looks the same at any frame rate. */
public final class Anim {
    private Anim() { }

    public static long now() { return Util.getMillis(); }

    /** Frame-rate independent exponential approach. rate is per second (higher is snappier). */
    public static float approach(float current, float target, float seconds, float rate) {
        float k = 1f - (float) Math.exp(-Math.max(0f, seconds) * rate);
        float next = current + (target - current) * k;
        return Math.abs(next - target) < 0.002f ? target : next;
    }

    public static float easeOut(float t) {
        t = Math.max(0f, Math.min(1f, t));
        float u = 1f - t;
        return 1f - u * u * u;
    }

    /** Tracks seconds elapsed between successive calls on one object. */
    public static final class Clock {
        private long last;
        public float tick() {
            long n = now();
            float dt = last == 0 ? 0f : Math.min(0.05f, (n - last) / 1000f);
            last = n;
            return dt;
        }
    }
}
