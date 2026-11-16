package dev.cirrus.client.config;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CirrusConfigTest {
    @TempDir Path temp;

    @Test void persistsSettingsIndependentlyForEachInstance() throws Exception {
        Path first = temp.resolve("first");
        Path second = temp.resolve("second");
        CirrusConfig.get(first).put("enabled.local_status", "true");
        CirrusConfig.get(second).put("enabled.local_status", "false");
        assertTrue(CirrusConfig.get(first).getBoolean("enabled.local_status", false));
        assertFalse(CirrusConfig.get(second).getBoolean("enabled.local_status", true));
        assertNotEquals(first.resolve("config/cirrus-client/settings.properties"), second.resolve("config/cirrus-client/settings.properties"));
    }

    @Test void missingAndMalformedValuesFallBackSafely() throws Exception {
        Path game = temp.resolve("game");
        Path file = game.resolve("config/cirrus-client/settings.properties");
        Files.createDirectories(file.getParent());
        Files.writeString(file, "schema=1\nhud.x.status=not-a-number\nenabled.status=maybe\n");
        CirrusConfig config = CirrusConfig.get(game);
        assertEquals(8, config.getInt("hud.x.status", 8));
        assertTrue(config.getBoolean("enabled.status", true));
        assertEquals("TOP_LEFT", config.getString("position.status", "TOP_LEFT"));
    }
}
