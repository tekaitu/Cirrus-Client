package dev.cirrus.client.profile;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class ProfileCodecTest {
    private static Map<String, String> sample() {
        Map<String, String> m = new TreeMap<>();
        m.put("enabled.fps", "true");
        m.put("mod.fps.scale", "120");
        m.put("hud.x.fps", "12");
        m.put("hud.anchor.ping", "TOP_RIGHT");
        return m;
    }

    @Test void shareCodeRoundTrips() {
        String code = ProfileCodec.encode("My PvP", sample());
        assertTrue(code.startsWith("CIRRUS1:"));
        var p = ProfileCodec.decode(code);
        assertEquals("My PvP", p.name());
        assertEquals(sample(), new TreeMap<>(p.values()));
    }

    @Test void onlyModuleKeysAreEverEncodedOrAccepted() {
        Map<String, String> m = sample();
        m.put("ui.menu.w", "400");
        m.put("onboarding.complete", "true");
        m.put("favorite.fps", "true");
        m.put("enabled.fps/../x", "true");
        var p = ProfileCodec.decode(ProfileCodec.encode("x", m));
        assertEquals(sample(), new TreeMap<>(p.values()));
        var parsed = ProfileCodec.fromText("name=a\nui.menu.w=3\nschema=9\nenabled.ping=true\n", "a");
        assertEquals(Map.of("enabled.ping", "true"), parsed.values());
    }

    @Test void badCodesAreRejectedWithAMessage() {
        for (String bad : new String[] {null, "", "hello", "CIRRUS1:", "CIRRUS1:!!!", "CIRRUS1:AAAA", "CIRRUS2:abc"})
            assertThrows(IllegalArgumentException.class, () -> ProfileCodec.decode(bad), String.valueOf(bad));
        assertThrows(IllegalArgumentException.class, () -> ProfileCodec.decode("CIRRUS1:" + "A".repeat(100_000)));
    }

    @Test void compressionBombIsRefused() {
        Map<String, String> big = new TreeMap<>();
        // 1000 allowed entries with long values compress hugely but stay below limits; a text over the limit must be refused.
        StringBuilder text = new StringBuilder("name=x\n");
        for (int i = 0; i < 3000; i++) text.append("mod.a.k").append(i).append('=').append("v".repeat(150)).append('\n');
        var bytes = new java.io.ByteArrayOutputStream();
        try (var gz = new java.util.zip.GZIPOutputStream(bytes)) { gz.write(text.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)); } catch (java.io.IOException e) { fail(e); }
        String code = ProfileCodec.PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes.toByteArray());
        assertThrows(IllegalArgumentException.class, () -> ProfileCodec.decode(code));
        assertTrue(big.isEmpty());
    }

    @Test void namesAreCleaned() {
        assertEquals("My PvP 2", ProfileCodec.cleanName("  My  PvP<>/ 2 "));
        assertEquals("", ProfileCodec.cleanName("///"));
        assertTrue(ProfileCodec.cleanName("x".repeat(100)).length() <= 24);
    }

    @Test void storeSavesListsLoadsAndDeletes(@TempDir Path dir) throws Exception {
        var store = new ProfileStore(dir.resolve("profiles"));
        assertTrue(store.names().isEmpty());
        store.save("Zeta Run", sample());
        store.save("alpha", Map.of("enabled.ping", "true"));
        assertEquals(List.of("alpha", "Zeta Run"), store.names());
        assertEquals(sample(), new TreeMap<>(store.load("zeta run")));
        assertEquals("Zeta Run 2", store.uniqueName("Zeta Run"));
        assertEquals("Profile", store.uniqueName("///"));
        store.delete("alpha");
        assertEquals(List.of("Zeta Run"), store.names());
    }
}
