package dev.cirrus.core.hud;

/**
 * Clicks per second: how many presses happened in the last second. Only the player's own presses are counted (a rising edge of the
 * attack or use key), nothing is generated or sent. Fixed-size and allocation free.
 */
public final class ClickCounter {
    private static final int CAPACITY = 64;
    private final long[] stamps = new long[CAPACITY];
    private int head, size;
    private boolean down;

    /** Reports whether the key is held right now; a press is counted when it goes from up to down. */
    public void sample(boolean isDown, long nowMillis) {
        if (isDown && !down) press(nowMillis);
        down = isDown;
    }

    public void press(long nowMillis) {
        stamps[(head + size) % CAPACITY] = nowMillis;
        if (size < CAPACITY) size++; else head = (head + 1) % CAPACITY;
    }

    /** Presses within the last 1000 ms. */
    public int count(long nowMillis) {
        while (size > 0 && nowMillis - stamps[head] >= 1000) { head = (head + 1) % CAPACITY; size--; }
        return size;
    }

    public void reset() { head = size = 0; down = false; }
}
