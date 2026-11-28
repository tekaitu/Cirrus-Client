package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.input.GameAction;
import dev.cirrus.core.module.CirrusMod;
import dev.cirrus.core.module.EffectInfo;
import dev.cirrus.core.module.ModRegistry;
import dev.cirrus.core.pvp.*;
import dev.cirrus.core.settings.ModSettings;
import dev.cirrus.core.settings.Setting;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PvpModsTest {
    private TestContext ctx;

    @BeforeEach void setUp() { ModRegistry.reset(); HudElementRegistry.reset(); ctx = new TestContext(); ModRegistry.bind(ctx); }
    @AfterEach void tearDown() { ModRegistry.reset(); HudElementRegistry.reset(); }

    // ---- CPS ----------------------------------------------------------------------------------------------------------------

    @Test void clickCounterCountsPressesInTheLastSecondOnly() {
        ClickCounter c = new ClickCounter();
        c.press(0); c.press(100); c.press(900);
        assertEquals(3, c.count(900));
        assertEquals(2, c.count(1050), "the press at 0 is older than a second");
        assertEquals(0, c.count(3000));
    }

    @Test void holdingTheKeyIsOnePressNotManyAndEachRisingEdgeCounts() {
        ClickCounter c = new ClickCounter();
        for (int i = 0; i < 10; i++) c.sample(true, i * 10);
        assertEquals(1, c.count(100), "a held button is one click");
        c.sample(false, 110); c.sample(true, 120); c.sample(false, 130); c.sample(true, 140);
        assertEquals(3, c.count(150));
    }

    @Test void clickCounterNeverGrowsPastItsCapacity() {
        ClickCounter c = new ClickCounter();
        for (int i = 0; i < 500; i++) c.press(i);
        assertTrue(c.count(500) <= 64);
    }

    @Test void cpsShowsLeftAndOptionallyRight() {
        CpsMod m = new CpsMod();
        ctx.down.add(GameAction.ATTACK);
        assertEquals("1", m.value(ctx, 0));
        ctx.down.clear();
        m.value(ctx, 50);
        ctx.down.add(GameAction.ATTACK); ctx.down.add(GameAction.USE);
        assertEquals("2", m.value(ctx, 100));
        ModSettings.set(ctx.config(), "cps", ModSettings.find(m.settings(), "right"), "true");
        assertEquals("2 | 1", m.value(ctx, 150));
    }

    @Test void cpsHasNoActivityOutsideAWorld() {
        CpsMod m = new CpsMod();
        ctx.inWorld = false;
        ctx.down.add(GameAction.ATTACK);
        assertEquals("0", m.value(ctx, 0));
    }

    // ---- Coordinates ---------------------------------------------------------------------------------------------------------

    @Test void facingNamesTheCompassDirection() {
        assertEquals("S", Facing.of(0)); assertEquals("W", Facing.of(90)); assertEquals("N", Facing.of(180)); assertEquals("E", Facing.of(270));
        assertEquals("E", Facing.of(-90)); assertEquals("N", Facing.of(540)); assertEquals("SW", Facing.of(45)); assertEquals("S", Facing.of(359));
    }

    @Test void coordinatesUseFloorLikeTheGameAndCanShowDecimals() {
        assertEquals("-1", CoordinatesMod.num(-0.5, false));
        assertEquals("12", CoordinatesMod.num(12.9, false));
        assertEquals("-0.5", CoordinatesMod.num(-0.5, true));
        assertEquals("12.9", CoordinatesMod.num(12.99, true));
    }

    @Test void coordinatesLayoutsAndFacing() {
        CoordinatesMod m = new CoordinatesMod();
        ctx.px = 10.5; ctx.py = 64; ctx.pz = -3.2; ctx.yaw = 180f;
        assertEquals(Arrays.asList("10, 64, -4 N"), m.lines(ctx));
        CirrusConfig c = ctx.config();
        ModSettings.set(c, "coordinates", ModSettings.find(m.settings(), "layout"), "Stacked");
        ModSettings.set(c, "coordinates", ModSettings.find(m.settings(), "direction"), "false");
        assertEquals(Arrays.asList("X: 10", "Y: 64", "Z: -4"), m.lines(ctx));
        assertTrue(m.height() > 0 && m.width() > 0);
    }

    @Test void coordinatesShowSampleValuesOutsideAWorld() {
        ctx.inWorld = false;
        assertFalse(new CoordinatesMod().lines(ctx).get(0).isEmpty());
    }

    // ---- Potion effects ------------------------------------------------------------------------------------------------------

    @Test void effectTimeAndLevelFormatting() {
        assertEquals("1:23", EffectTime.format(20 * 83));
        assertEquals("0:07", EffectTime.format(20 * 7 + 5));
        assertEquals("**:**", EffectTime.format(-1));
        assertEquals("I", EffectTime.level(0)); assertEquals("IV", EffectTime.level(3)); assertEquals("12", EffectTime.level(11));
    }

    @Test void potionEffectsListsRealEffectsAndCapsTheRows() {
        PotionEffectsMod m = new PotionEffectsMod();
        for (int i = 0; i < 12; i++) ctx.effects.add(new EffectInfo("E" + i, i, 20 * 30, true));
        assertEquals(8, m.shown(ctx).size());
        assertEquals("E1 II  0:30", m.row(ctx.effects.get(1), false));
        assertEquals("E1 0:30", m.row(ctx.effects.get(1), true));
        ctx.effects.clear();
        assertTrue(m.shown(ctx).isEmpty());
        assertTrue(m.height() > 0, "an empty list still has a size so it can be moved in the editor");
        ctx.inWorld = false;
        assertEquals(3, m.shown(ctx).size(), "sample effects in menus");
    }

    @Test void draggableHudModsAreRealHudElements() {
        for (HudMod m : new HudMod[] {new CpsMod(), new CoordinatesMod(), new PotionEffectsMod()}) {
            ModRegistry.register(m);
            HudElementRegistry.register(m);
        }
        assertTrue(HudElementRegistry.find("cps").isPresent() && HudElementRegistry.find("coordinates").isPresent() && HudElementRegistry.find("potion_effects").isPresent());
        TestContext.Rec rec = new TestContext.Rec();
        for (HudElement e : HudElementRegistry.all()) e.render(rec, 10, 10, 0f, ctx);
        assertEquals(0, rec.depth);
        assertFalse(rec.texts.isEmpty());
    }

    // ---- Crosshair ------------------------------------------------------------------------------------------------------------

    @Test void crosshairDrawsFourArmsAndACentreDotAsChosen() {
        CirrusConfig c = ctx.config();
        List<Setting> s = new CrosshairMod().settings();
        ModSettings.set(c, "crosshair", ModSettings.find(s, "outline"), "false");
        TestContext.Rec cross = new TestContext.Rec();
        CrosshairMod.draw(cross, 100, 100, c);
        assertEquals(4, cross.fills, "four arms");
        ModSettings.set(c, "crosshair", ModSettings.find(s, "style"), CrosshairMod.CROSS_DOT);
        TestContext.Rec both = new TestContext.Rec();
        CrosshairMod.draw(both, 100, 100, c);
        assertEquals(5, both.fills);
        ModSettings.set(c, "crosshair", ModSettings.find(s, "style"), CrosshairMod.DOT);
        TestContext.Rec dot = new TestContext.Rec();
        CrosshairMod.draw(dot, 100, 100, c);
        assertEquals(1, dot.fills);
        ModSettings.set(c, "crosshair", ModSettings.find(s, "outline"), "true");
        TestContext.Rec outlined = new TestContext.Rec();
        CrosshairMod.draw(outlined, 100, 100, c);
        assertEquals(2, outlined.fills, "the outline is drawn under the dot");
        ModSettings.set(c, "crosshair", ModSettings.find(s, "style"), CrosshairMod.CIRCLE);
        TestContext.Rec ring = new TestContext.Rec();
        CrosshairMod.draw(ring, 100, 100, c);
        assertTrue(ring.masks > 0, "the circle is drawn with rounded corners");
    }

    // ---- Zoom -----------------------------------------------------------------------------------------------------------------

    @Test void zoomEasesInHoldsAndReturnsToNormal() {
        ZoomState z = new ZoomState();
        assertFalse(z.active());
        float f = 1f;
        for (int i = 0; i < 60; i++) f = z.update(true, 0.3f, true, 0.016f);
        assertEquals(0.3f, f, 0.01f);
        assertTrue(z.active());
        for (int i = 0; i < 120; i++) f = z.update(false, 0.3f, true, 0.016f);
        assertEquals(1f, f, 0.001f);
        assertFalse(z.active());
    }

    @Test void zoomWithoutSmoothingSnapsAndClampsItsTarget() {
        ZoomState z = new ZoomState();
        assertEquals(0.5f, z.update(true, 0.5f, false, 0.016f), 0.0001f);
        assertEquals(0.1f, z.update(true, 0.0f, false, 0.016f), 0.0001f);
        assertEquals(1f, z.update(false, 0.5f, false, 0.016f), 0.0001f);
    }

    @Test void zoomSettingsComeFromTheConfig() {
        ZoomMod m = new ZoomMod();
        assertEquals(0.3f, m.target(ctx.config()), 0.0001f);
        ModSettings.set(ctx.config(), "zoom", ModSettings.find(m.settings(), "level"), "50");
        assertEquals(0.5f, m.target(ctx.config()), 0.0001f);
        ModSettings.set(ctx.config(), "zoom", ModSettings.find(m.settings(), "level"), "999");
        assertEquals(0.9f, m.target(ctx.config()), 0.0001f, "out-of-range values are clamped");
    }

    // ---- The rest of the PvP set ------------------------------------------------------------------------------------------------

    @Test void lowFireAndToggleSprintReadTheirOptions() {
        LowFireMod fire = new LowFireMod();
        assertEquals(0.25f, fire.offset(ctx.config()), 0.0001f);
        ToggleSprintMod t = new ToggleSprintMod();
        assertTrue(t.sprint(ctx.config()));
        assertFalse(t.sneak(ctx.config()));
        ModSettings.set(ctx.config(), "toggle_sprint", ModSettings.find(t.settings(), "sneak"), "true");
        assertTrue(t.sneak(ctx.config()));
    }

    @Test void everyPvpModuleIsAvailableOffByDefaultAndHasAUniqueId() {
        List<CirrusMod> all = Arrays.<CirrusMod>asList(new CpsMod(), new CoordinatesMod(), new PotionEffectsMod(), new CrosshairMod(), new ZoomMod(),
            new DamageTiltMod(), new LowFireMod(), new RawInputMod(), new ToggleSprintMod(), new HitboxesMod());
        java.util.Set<String> ids = new java.util.HashSet<String>();
        for (CirrusMod m : all) {
            assertTrue(ids.add(m.id()), "duplicate " + m.id());
            assertTrue(m.available(), m.id());
            assertFalse(m.name().isEmpty() || m.description().isEmpty(), m.id());
            if (!(m instanceof HudMod)) assertFalse(m.defaultEnabled(), m.id() + " changes the game, so it must start off");
            for (Setting s : m.settings()) assertEquals(s.defaultValue(), s.normalize("not a value") , m.id() + "." + s.key());
        }
    }
}
