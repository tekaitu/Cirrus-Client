package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.module.CirrusMod;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.module.ModRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class HudModelTest {
    private TestContext ctx;

    @BeforeEach void setUp() { ModRegistry.reset(); HudElementRegistry.reset(); ctx = new TestContext(); ModRegistry.bind(ctx); }
    @AfterEach void tearDown() { ModRegistry.reset(); HudElementRegistry.reset(); }

    /** A bare widget with a fixed size, not tied to a module. */
    private static HudElement box(final String id, final int w, final int h) {
        return new HudElement() {
            @Override public String id() { return id; }
            @Override public String label() { return id; }
            @Override public int width() { return w; }
            @Override public int height() { return h; }
            @Override public void render(dev.cirrus.core.render.Canvas canvas, int x, int y, float tick, ModContext c) { }
        };
    }

    @Test void removedWidgetsKeepTheirPositionAndComeBackWhereTheyWere() {
        CirrusConfig c = ctx.config();
        HudElement e = box("a", 40, 16);
        e.setPosition(c, 100, 60, 427, 240);
        assertTrue(HudLayout.isActive(e, c));
        HudLayout.remove(e, c);
        assertFalse(HudLayout.isActive(e, c));
        assertEquals(Arrays.asList(e), HudLayout.removed(Arrays.asList(e), c));
        assertTrue(HudLayout.active(Arrays.asList(e), c).isEmpty());
        HudLayout.restore(e, c);
        assertTrue(HudLayout.isActive(e, c));
        assertEquals(100, e.x(c, 427));
        assertEquals(60, e.y(c, 240));
    }

    @Test void positionsAreClampedToTheScreenAndPersist() {
        CirrusConfig c = ctx.config();
        HudElement e = box("a", 40, 16);
        e.setPosition(c, -50, 9999, 427, 240);
        assertEquals(0, e.x(c, 427));
        assertEquals(224, e.y(c, 240));
        assertEquals("0", c.getString("hud.x.a", ""));
        assertEquals("224", c.getString("hud.y.a", ""));
    }

    @Test void resetPositionReturnsToTheDefault() {
        CirrusConfig c = ctx.config();
        HudElement e = box("a", 40, 16);
        e.setPosition(c, 200, 100, 427, 240);
        HudLayout.resetPosition(e, c, 427, 240);
        assertEquals(8, e.x(c, 427));
        assertEquals(8, e.y(c, 240));
    }

    @Test void hitFindsTheTopmostActiveWidget() {
        CirrusConfig c = ctx.config();
        HudElement under = box("under", 40, 16), over = box("over", 40, 16);
        under.setPosition(c, 50, 50, 427, 240);
        over.setPosition(c, 60, 55, 427, 240);
        List<HudElement> all = Arrays.asList(under, over);
        assertSame(over, HudLayout.hit(all, c, 427, 240, 65, 58, 0));
        assertSame(under, HudLayout.hit(all, c, 427, 240, 52, 51, 0));
        assertNull(HudLayout.hit(all, c, 427, 240, 300, 200, 0));
        assertSame(under, HudLayout.hit(all, c, 427, 240, 48, 48, 3), "the padding makes the edge easier to grab");
        HudLayout.remove(over, c);
        assertSame(under, HudLayout.hit(all, c, 427, 240, 65, 58, 0), "a removed widget cannot be grabbed");
    }

    @Test void dragKeepsTheGrabOffsetAndPersistsEveryStep() {
        CirrusConfig c = ctx.config();
        HudElement e = box("a", 40, 16);
        e.setPosition(c, 100, 100, 427, 240);
        HudDrag drag = new HudDrag();
        assertFalse(drag.update(c, 427, 240, 0, 0), "nothing to drag yet");
        drag.begin(e, c, 427, 240, 110, 104);           // grabbed 10 right and 4 below the corner
        assertTrue(drag.active());
        drag.update(c, 427, 240, 210, 154);
        assertEquals(200, e.x(c, 427));
        assertEquals(150, e.y(c, 240));
        drag.update(c, 427, 240, 5000, -5000);          // off screen: clamped
        assertEquals(387, e.x(c, 427));
        assertEquals(0, e.y(c, 240));
        drag.end();
        assertFalse(drag.active());
        assertFalse(drag.update(c, 427, 240, 0, 0));
    }

    @Test void centeredDragPlacesTheMiddleUnderThePointer() {
        CirrusConfig c = ctx.config();
        HudElement e = box("a", 40, 16);
        HudDrag drag = new HudDrag();
        drag.beginCentered(e);
        drag.update(c, 427, 240, 200, 100);
        assertEquals(180, e.x(c, 427));
        assertEquals(92, e.y(c, 240));
    }

    @Test void registriesRejectDuplicatesAndDoNotAllocateOnRead() {
        HudElementRegistry.register(box("a", 1, 1));
        assertThrows(IllegalArgumentException.class, () -> HudElementRegistry.register(box("a", 2, 2)));
        assertSame(HudElementRegistry.all(), HudElementRegistry.all(), "the snapshot is reused until something registers");
        assertTrue(HudElementRegistry.find("a").isPresent());
        assertFalse(HudElementRegistry.find("zzz").isPresent());
    }

    // ---- the shipped widgets, driven through the context ---------------------------------------------------------------

    @Test void fpsDrawsTheCurrentFramerate() {
        FpsMod fps = new FpsMod();
        ModRegistry.register(fps);
        ctx.fps = 87;
        TestContext.Rec canvas = new TestContext.Rec();
        fps.render(canvas, 10, 10, 0, ctx);
        assertEquals(Arrays.asList("FPS: 87"), canvas.texts);
        assertEquals(0, canvas.fills + canvas.masks, "plain text by default: no background drawn");
        assertEquals(("FPS: 000".length() * 5) + 10, fps.width());
        assertEquals(16, fps.height());
    }

    @Test void backgroundOptionAddsASurface() {
        FpsMod fps = new FpsMod();
        ModRegistry.register(fps);
        ctx.config().put("mod.fps.background", "true");
        TestContext.Rec canvas = new TestContext.Rec();
        fps.render(canvas, 10, 10, 0, ctx);
        assertTrue(canvas.fills + canvas.masks > 0);
    }

    @Test void pingShowsASampleInMenusDashesWithoutDataAndTheRealValueInGame() {
        PingMod ping = new PingMod();
        ModRegistry.register(ping);
        TestContext.Rec canvas = new TestContext.Rec();
        ctx.inWorld = false;
        ping.render(canvas, 0, 0, 0, ctx);
        ctx.inWorld = true; ctx.ping = -1;
        ping.render(canvas, 0, 0, 0, ctx);
        ctx.ping = 57;
        ping.render(canvas, 0, 0, 0, ctx);
        assertEquals(Arrays.asList("Ping: 42 ms", "Ping: --", "Ping: 57 ms"), canvas.texts);
    }

    @Test void scaleIsAppliedAsABalancedTransformAndChangesTheSize() {
        FpsMod fps = new FpsMod();
        ModRegistry.register(fps);
        ctx.config().put("mod.fps.scale", "200");
        TestContext.Rec canvas = new TestContext.Rec();
        fps.render(canvas, 30, 40, 0, ctx);
        assertEquals(Arrays.asList("30.0,40.0,2.0"), canvas.transforms);
        assertEquals(0, canvas.depth);
        assertEquals(32, fps.height());
    }

    @Test void keystrokesFollowTheContextsKeyBindingsAndOptions() {
        KeystrokesMod keys = new KeystrokesMod();
        ModRegistry.register(keys);
        TestContext.Rec canvas = new TestContext.Rec();
        keys.render(canvas, 0, 0, 0, ctx);
        assertEquals(Arrays.asList("W", "A", "S", "D", "LMB", "RMB", "SPACE"), canvas.texts);
        int full = keys.height();
        ctx.config().put("mod.keystrokes.mouse", "false");
        ctx.config().put("mod.keystrokes.space", "false");
        TestContext.Rec small = new TestContext.Rec();
        keys.render(small, 0, 0, 0, ctx);
        assertEquals(Arrays.asList("W", "A", "S", "D"), small.texts);
        assertTrue(keys.height() < full);
    }

    @Test void hudModuleSwitchControlsTheWidgetAndRunsLifecycleOnce() {
        final int[] enabled = {0}, disabled = {0};
        HudMod m = new HudMod() {
            public String id() { return "probe"; }
            public String name() { return "Probe"; }
            public String description() { return ""; }
            public dev.cirrus.core.module.ModCategory category() { return dev.cirrus.core.module.ModCategory.HUD; }
            @Override protected int baseWidth(ModContext c) { return 10; }
            @Override protected int baseHeight(ModContext c) { return 10; }
            @Override protected void draw(dev.cirrus.core.render.Canvas canvas, int x, int y, float tick, ModContext c) { }
            @Override public void onEnable(ModContext c) { enabled[0]++; }
            @Override public void onDisable(ModContext c) { disabled[0]++; }
        };
        ModRegistry.register(m);
        CirrusConfig c = ctx.config();
        assertTrue(HudLayout.isActive(m, c), "HUD modules are on by default");
        HudLayout.remove(m, c);
        HudLayout.remove(m, c);
        assertFalse(HudLayout.isActive(m, c));
        assertEquals(1, disabled[0]);
        HudLayout.restore(m, c);
        assertEquals(1, enabled[0]);
        assertTrue(((CirrusMod) m).enabled(c));
    }
}
