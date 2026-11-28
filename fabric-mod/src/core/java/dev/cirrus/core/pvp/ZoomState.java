package dev.cirrus.core.pvp;

import dev.cirrus.core.anim.Anim;

/** The field-of-view multiplier for zoom: 1 when not zoomed, the chosen fraction while the key is held, eased in and out. */
public final class ZoomState {
    private float factor = 1f;

    /** Advances by {@code seconds}; {@code target} is the fraction of the normal field of view while zoomed (0.1 to 0.9). */
    public float update(boolean held, float target, boolean smooth, float seconds) {
        float goal = held ? Math.max(0.1f, Math.min(0.9f, target)) : 1f;
        factor = smooth ? Anim.approach(factor, goal, seconds, 14f) : goal;
        return factor;
    }

    public float factor() { return factor; }
    public boolean active() { return factor < 0.999f; }
    public void reset() { factor = 1f; }
}
