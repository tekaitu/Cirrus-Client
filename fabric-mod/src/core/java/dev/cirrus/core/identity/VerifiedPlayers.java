package dev.cirrus.core.identity;

import java.util.UUID;

/**
 * Answers one question: is this player a verified Maple Client user? The answer must come from the Maple backend (through the
 * launcher), never from anything the player or another client can claim in-game. This interface is the seam where that data plugs in.
 */
public interface VerifiedPlayers {
    boolean isVerified(UUID playerId);
}
