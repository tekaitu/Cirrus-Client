package dev.cirrus.core.identity;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class MapleIdentityTest {
    private static final UUID REAL = UUID.fromString("069a79f4-44e9-4726-a5be-fca90e38aaf5"); // version 4, like a Mojang account id

    @AfterEach void reset() { MapleIdentity.setProvider(null); }

    @Test void nobodyIsVerifiedByDefault() {
        assertFalse(MapleIdentity.hasProvider());
        assertFalse(MapleIdentity.isVerified(REAL));
        assertFalse(MapleIdentity.isVerified(null));
    }

    @Test void onlyPlayersTheProviderVouchesForAreVerified() {
        final UUID other = UUID.fromString("8667ba71-b85a-4004-af54-457a9734eed7");
        MapleIdentity.setProvider(new VerifiedPlayers() { @Override public boolean isVerified(UUID id) { return id.equals(REAL); } });
        assertTrue(MapleIdentity.hasProvider());
        assertTrue(MapleIdentity.isVerified(REAL));
        assertFalse(MapleIdentity.isVerified(other));
    }

    @Test void offlineModeUuidsAreNeverVerifiedEvenIfTheProviderSaysYes() {
        MapleIdentity.setProvider(new VerifiedPlayers() { @Override public boolean isVerified(UUID id) { return true; } });
        UUID offline = UUID.nameUUIDFromBytes("OfflinePlayer:Steve".getBytes(StandardCharsets.UTF_8));
        assertEquals(3, offline.version());
        assertFalse(MapleIdentity.isVerified(offline));
        assertTrue(MapleIdentity.isVerified(REAL));
    }

    @Test void aFailingProviderMeansNotVerified() {
        MapleIdentity.setProvider(new VerifiedPlayers() { @Override public boolean isVerified(UUID id) { throw new IllegalStateException("backend unreachable"); } });
        assertFalse(MapleIdentity.isVerified(REAL));
    }

    @Test void removingTheProviderRestoresTheDefault() {
        MapleIdentity.setProvider(new VerifiedPlayers() { @Override public boolean isVerified(UUID id) { return true; } });
        MapleIdentity.setProvider(null);
        assertFalse(MapleIdentity.hasProvider());
        assertFalse(MapleIdentity.isVerified(REAL));
    }
}
