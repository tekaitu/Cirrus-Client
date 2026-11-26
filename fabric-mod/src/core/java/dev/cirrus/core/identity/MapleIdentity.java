package dev.cirrus.core.identity;

import java.util.UUID;

/**
 * The client's view of which players are verified Maple users, used to show the Maple glyph beside their names.
 * <p>
 * Nothing in this client decides who is verified. By default nobody is, so no glyph is ever shown. A source of verified identities
 * (backed by the Maple backend, delivered by the launcher) can be installed with {@link #setProvider}; until one exists the feature
 * is only the rendering foundation. Two rules hold whatever the provider says:
 * <ul>
 * <li>Offline-mode UUIDs (version 3, derived from the player name) are never verified: they prove nothing about the account.</li>
 * <li>A provider that throws is treated as "not verified".</li>
 * </ul>
 */
public final class MapleIdentity {
    private MapleIdentity() { }

    /** The default: nobody is verified. */
    public static final VerifiedPlayers NOBODY = new VerifiedPlayers() {
        @Override public boolean isVerified(UUID playerId) { return false; }
    };

    private static volatile VerifiedPlayers provider = NOBODY;

    /** Installs the source of verified identities; null restores the default. */
    public static void setProvider(VerifiedPlayers source) { provider = source == null ? NOBODY : source; }

    public static boolean hasProvider() { return provider != NOBODY; }

    public static boolean isVerified(UUID playerId) {
        if (playerId == null || playerId.version() == 3) return false;
        try {
            return provider.isVerified(playerId);
        } catch (RuntimeException e) {
            return false;
        }
    }
}
