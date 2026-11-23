package dev.cirrus.core.module;

import dev.cirrus.core.config.CirrusConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;

import static org.junit.jupiter.api.Assertions.*;

class ModRegistryTest {
    @BeforeEach @AfterEach void clean() { ModRegistry.reset(); }

    private static final class Probe implements CirrusMod {
        final String id; final boolean on; int enables, disables;
        Probe(String id, boolean defaultOn) { this.id = id; this.on = defaultOn; }
        public String id() { return id; }
        public String name() { return id; }
        public String description() { return ""; }
        public ModCategory category() { return ModCategory.UTILITY; }
        @Override public boolean defaultEnabled() { return on; }
        @Override public void onEnable(ModContext c) { enables++; }
        @Override public void onDisable(ModContext c) { disables++; }
    }

    private static CirrusConfig config() throws Exception { return CirrusConfig.get(Files.createTempDirectory("cirrus-test")); }

    @Test void contextMustBeBoundBeforeUse() {
        assertFalse(ModRegistry.isBound());
        assertThrows(IllegalStateException.class, ModRegistry::context);
    }

    @Test void registrationKeepsOrderRejectsDuplicatesAndReusesTheSnapshot() {
        ModRegistry.register(new Probe("b", false));
        ModRegistry.register(new Probe("a", false));
        assertEquals("b", ModRegistry.all().get(0).id());
        assertThrows(IllegalArgumentException.class, () -> ModRegistry.register(new Probe("a", false)));
        assertSame(ModRegistry.all(), ModRegistry.all());
        assertTrue(ModRegistry.find("a").isPresent());
        assertFalse(ModRegistry.find("missing").isPresent());
    }

    @Test void initializeStartsOnlyEnabledModulesAndOnlyOnce() throws Exception {
        CirrusConfig c = config();
        Probe on = new Probe("on", true), off = new Probe("off", false);
        ModRegistry.register(on);
        ModRegistry.register(off);
        ModRegistry.bind(new dev.cirrus.core.hud.TestContextHolder().get());
        ModRegistry.initialize(c);
        ModRegistry.initialize(c);
        assertEquals(1, on.enables);
        assertEquals(0, off.enables);
    }

    @Test void setEnabledRunsHooksOnlyOnRealChanges() throws Exception {
        CirrusConfig c = config();
        Probe p = new Probe("p", false);
        ModRegistry.register(p);
        ModRegistry.bind(new dev.cirrus.core.hud.TestContextHolder().get());
        p.setEnabled(c, true);
        p.setEnabled(c, true);
        p.setEnabled(c, false);
        assertEquals(1, p.enables);
        assertEquals(1, p.disables);
    }

    @Test void plannedModulesCanNeverBeSwitchedOn() throws Exception {
        CirrusConfig c = config();
        PlannedMod planned = new PlannedMod(PlannedCatalog.ENTRIES.get(0));
        planned.setEnabled(c, true);
        assertFalse(planned.enabled(c));
        assertFalse(planned.available());
    }

    @Test void modulesWorkWithoutABoundContextWhenOnlyTheSwitchChanges() throws Exception {
        CirrusConfig c = config();
        Probe p = new Probe("p", false);
        p.setEnabled(c, true);
        assertTrue(p.enabled(c));
        assertEquals(0, p.enables, "no context bound: the hook is skipped, the setting still persists");
    }
}
