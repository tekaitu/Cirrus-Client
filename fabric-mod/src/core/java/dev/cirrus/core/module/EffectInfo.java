package dev.cirrus.core.module;

/** One active potion effect as the HUD needs it. Immutable. {@code ticksLeft} is negative for an effect that never runs out. */
public final class EffectInfo {
    private final String name;
    private final int amplifier, ticksLeft;
    private final boolean beneficial;

    public EffectInfo(String name, int amplifier, int ticksLeft, boolean beneficial) {
        this.name = name == null ? "" : name; this.amplifier = Math.max(0, amplifier); this.ticksLeft = ticksLeft; this.beneficial = beneficial;
    }

    public String name() { return name; }
    public int amplifier() { return amplifier; }
    public int ticksLeft() { return ticksLeft; }
    public boolean beneficial() { return beneficial; }
    public boolean infinite() { return ticksLeft < 0; }
}
