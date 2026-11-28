package dev.cirrus.core.hud;

/** Formats a potion effect's remaining time. */
public final class EffectTime {
    private EffectTime() { }

    /** {@code m:ss}, or {@code **:**} for an effect that does not run out. */
    public static String format(int ticksLeft) {
        if (ticksLeft < 0) return "**:**";
        int total = ticksLeft / 20;
        return (total / 60) + ":" + (total % 60 < 10 ? "0" : "") + (total % 60);
    }

    /** Roman numeral for the amplifier as the game shows it: amplifier 0 is level I. Levels beyond ten fall back to digits. */
    public static String level(int amplifier) {
        String[] r = {"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"};
        return amplifier >= 0 && amplifier < r.length ? r[amplifier] : Integer.toString(amplifier + 1);
    }
}
