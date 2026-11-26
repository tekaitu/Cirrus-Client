package dev.cirrus.core.profile;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.hud.TestContextHolder;
import dev.cirrus.core.module.CirrusMod;
import dev.cirrus.core.module.ModCategory;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.module.ModRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ProfilesTest {
    private static final class Probe implements CirrusMod {
        final String id; int enables, disables;
        Probe(String id) { this.id = id; }
        public String id() { return id; }
        public String name() { return id; }
        public String description() { return ""; }
        public ModCategory category() { return ModCategory.UTILITY; }
        @Override public void onEnable(ModContext c) { enables++; }
        @Override public void onDisable(ModContext c) { disables++; }
    }

    private Probe a, b;

    @BeforeEach void setUp() {
        ModRegistry.reset();
        a = new Probe("alpha"); b = new Probe("beta");
        ModRegistry.register(a);
        ModRegistry.register(b);
        ModRegistry.bind(new TestContextHolder().get());
    }
    @AfterEach void tearDown() { ModRegistry.reset(); }

    @Test void applyingAProfileRestoresSettingsAndRunsOnlyTheHooksThatChanged() throws Exception {
        Path game = Files.createTempDirectory("cirrus-profiles");
        Profiles p = new Profiles(game);
        CirrusConfig c = CirrusConfig.get(game);
        a.setEnabled(c, true);                        // alpha on, beta off
        c.put("hud.x.fps", "120");
        String saved = p.create("Duel");
        assertEquals("Duel", saved);
        assertEquals("Duel", p.active());

        a.setEnabled(c, false);                       // change everything afterwards
        b.setEnabled(c, true);
        c.put("hud.x.fps", "5");
        int aOff = a.disables, bOn = b.enables;

        p.apply("Duel");
        assertTrue(a.enabled(c));
        assertFalse(b.enabled(c));
        assertEquals("120", c.getString("hud.x.fps", ""));
        assertEquals(1, a.enables - 1, "alpha was switched back on exactly once by the profile");
        assertEquals(aOff, a.disables, "alpha was not switched off again");
        assertEquals(1, b.disables, "beta was switched off by the profile");
        assertEquals(bOn, b.enables);
    }

    @Test void shareCodesRoundTripIntoANewProfileWithoutApplyingIt() throws Exception {
        Path game = Files.createTempDirectory("cirrus-profiles");
        Profiles p = new Profiles(game);
        CirrusConfig c = CirrusConfig.get(game);
        c.put("hud.y.fps", "77");
        p.create("Base");
        String code = p.share("Base");
        c.put("hud.y.fps", "1");
        String imported = p.importCode(code);
        assertNotEquals("Base", imported, "names stay unique");
        assertEquals("1", c.getString("hud.y.fps", ""), "importing does not change current settings");
        p.apply(imported);
        assertEquals("77", c.getString("hud.y.fps", ""));
    }

    @Test void deletingTheActiveProfileClearsIt() throws Exception {
        Path game = Files.createTempDirectory("cirrus-profiles");
        Profiles p = new Profiles(game);
        p.create("One");
        p.delete("One");
        assertEquals("", p.active());
        assertTrue(p.names().isEmpty());
    }
}
