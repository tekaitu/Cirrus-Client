package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.module.ModRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** The Phase 3 editing model: snapping drag, arrow-key nudge, widget search, and the format/colour options of FPS and Ping. */
class HudEditingTest {
    private static final int SW = 427, SH = 240;
    private TestContext ctx;

    @BeforeEach void setUp() { ModRegistry.reset(); HudElementRegistry.reset(); ctx = new TestContext(); ModRegistry.bind(ctx); }
    @AfterEach void tearDown() { ModRegistry.reset(); HudElementRegistry.reset(); }

    private static HudElement box(final String id, final String label, final int w, final int h) {
        return new HudElement() {
            @Override public String id() { return id; }
            @Override public String label() { return label; }
            @Override public int width() { return w; }
            @Override public int height() { return h; }
            @Override public void render(dev.cirrus.core.render.Canvas canvas, int x, int y, float tick, ModContext c) { }
        };
    }

    // ---- snapping drag -----------------------------------------------------------------------------------------------

    @Test void dragSnapsToTheScreenEdgeAndReportsTheGuide() {
        CirrusConfig c = ctx.config();
        HudElement e = box("a", "A", 40, 16);
        e.setPosition(c, 0, 0, SW, SH);
        HudDrag drag = new HudDrag();
        drag.begin(e, c, SW, SH, 0, 0);
        drag.update(c, SW, SH, 4, 3, Arrays.asList(e), 6);
        assertEquals(0, e.x(c, SW));
        assertEquals(0, e.y(c, SH));
        assertEquals(0, drag.guideX());
        assertEquals(0, drag.guideY());
        drag.update(c, SW, SH, 100, 100, Arrays.asList(e), 6);
        assertEquals(100, e.x(c, SW));
        assertEquals(SnapEngine.NONE, drag.guideX(), "no guide once it is away from every line");
        drag.end();
        assertEquals(SnapEngine.NONE, drag.guideX());
        assertEquals(SnapEngine.NONE, drag.guideY());
    }

    @Test void dragSnapsToAnotherActiveWidgetButNotARemovedOne() {
        CirrusConfig c = ctx.config();
        HudElement mover = box("mover", "Mover", 40, 16), anchor = box("anchor", "Anchor", 60, 20);
        anchor.setPosition(c, 200, 100, SW, SH);
        List<HudElement> all = Arrays.asList(mover, anchor);
        mover.setPosition(c, 0, 0, SW, SH);
        HudDrag drag = new HudDrag();
        drag.begin(mover, c, SW, SH, 0, 0);
        drag.update(c, SW, SH, 203, 150, all, 6);
        assertEquals(200, mover.x(c, SW), "left edges line up");
        assertEquals(200, drag.guideX());
        HudLayout.remove(anchor, c);
        drag.update(c, SW, SH, 203, 150, all, 6);
        assertEquals(203, mover.x(c, SW), "a removed widget is not a snap target");
        assertEquals(SnapEngine.NONE, drag.guideX());
    }

    @Test void plainUpdateStillDoesNotSnap() {
        CirrusConfig c = ctx.config();
        HudElement e = box("a", "A", 40, 16);
        e.setPosition(c, 0, 0, SW, SH);
        HudDrag drag = new HudDrag();
        drag.begin(e, c, SW, SH, 0, 0);
        drag.update(c, SW, SH, 4, 3);
        assertEquals(4, e.x(c, SW));
        assertEquals(3, e.y(c, SH));
        assertEquals(SnapEngine.NONE, drag.guideX());
    }

    @Test void snappedPositionIsPersisted() {
        CirrusConfig c = ctx.config();
        HudElement e = box("a", "A", 40, 16);
        e.setPosition(c, 0, 0, SW, SH);
        HudDrag drag = new HudDrag();
        drag.begin(e, c, SW, SH, 0, 0);
        drag.update(c, SW, SH, 5, 5, Arrays.asList(e), 6);
        assertEquals("0", c.getString("hud.x.a", ""));
        assertEquals("0", c.getString("hud.y.a", ""));
    }

    // ---- nudge ---------------------------------------------------------------------------------------------------------

    @Test void nudgeMovesByTheGivenUnitsAndPersists() {
        CirrusConfig c = ctx.config();
        HudElement e = box("a", "A", 40, 16);
        e.setPosition(c, 100, 100, SW, SH);
        HudLayout.nudge(e, c, 1, 0, SW, SH);
        HudLayout.nudge(e, c, 0, -10, SW, SH);
        assertEquals(101, e.x(c, SW));
        assertEquals(90, e.y(c, SH));
        assertEquals("101", c.getString("hud.x.a", ""));
    }

    @Test void nudgeStopsAtTheScreenEdges() {
        CirrusConfig c = ctx.config();
        HudElement e = box("a", "A", 40, 16);
        e.setPosition(c, 2, 2, SW, SH);
        HudLayout.nudge(e, c, -10, -10, SW, SH);
        assertEquals(0, e.x(c, SW));
        assertEquals(0, e.y(c, SH));
        e.setPosition(c, SW, SH, SW, SH);
        HudLayout.nudge(e, c, 10, 10, SW, SH);
        assertEquals(SW - 40, e.x(c, SW));
        assertEquals(SH - 16, e.y(c, SH));
    }

    @Test void aWidgetPinnedToTheRightEdgeCanBeMovedAndNudged() {
        CirrusConfig c = ctx.config();
        HudElement e = box("a", "A", 40, 16);
        c.put("hud.anchor.a", "TOP_RIGHT");
        assertEquals(SW - 40 - 8, e.x(c, SW));
        HudLayout.nudge(e, c, -10, 0, SW, SH);
        assertEquals(SW - 40 - 8 - 10, e.x(c, SW), "the nudge moves it from where it was drawn");
        assertEquals("TOP_LEFT", c.getString("hud.anchor.a", ""));
        c.put("hud.anchor.a", "TOP_RIGHT");
        e.setPosition(c, 50, 50, SW, SH);
        assertEquals(50, e.x(c, SW), "an explicit position is honoured");
    }

    // ---- search --------------------------------------------------------------------------------------------------------

    @Test void filterMatchesLabelOrIdIgnoringCaseAndSpaces() {
        HudElement fps = box("fps", "FPS", 1, 1), ping = box("ping", "Ping", 1, 1), armor = box("armor_status", "Armor Status", 1, 1);
        List<HudElement> all = Arrays.asList(fps, ping, armor);
        assertEquals(all, HudLayout.filter(all, ""));
        assertEquals(all, HudLayout.filter(all, null));
        assertEquals(all, HudLayout.filter(all, "   "));
        assertEquals(Arrays.asList(ping), HudLayout.filter(all, " PIN "));
        assertEquals(Arrays.asList(armor), HudLayout.filter(all, "status"));
        assertEquals(Arrays.asList(armor), HudLayout.filter(all, "armor_s"), "ids match too");
        assertTrue(HudLayout.filter(all, "zzz").isEmpty());
        assertEquals(Arrays.asList(fps, ping), HudLayout.filter(all, "p"), "keeps registration order");
    }

    // ---- FPS and Ping formats and colours ----------------------------------------------------------------------------------

    @Test void fpsFormatStylesChangeTheTextAndTheWidth() {
        FpsMod fps = new FpsMod();
        ModRegistry.register(fps);
        ctx.fps = 400;
        int base = fps.width();
        String[][] expected = {{"Parentheses", "(400)"}, {"Plain", "400"}, {"Label", "FPS: 400"}, {"Suffix", "400 FPS"}, {"Brackets", "[400]"}};
        for (String[] pair : expected) {
            ctx.config().put("mod.fps.format", pair[0]);
            TestContext.Rec canvas = new TestContext.Rec();
            fps.render(canvas, 0, 0, 0, ctx);
            assertEquals(Arrays.asList(pair[1]), canvas.texts, pair[0]);
            assertEquals(pair[1].replace("400", "000").length() * 5 + 10, fps.width(), pair[0] + " width fits the longest value");
        }
        ctx.config().put("mod.fps.format", "Plain");
        assertTrue(fps.width() < base);
    }

    @Test void pingFormatUsesTheUnitWhereTheStyleCallsForOne() {
        PingMod ping = new PingMod();
        ModRegistry.register(ping);
        ctx.ping = 52;
        String[][] expected = {{"Parentheses", "(52)"}, {"Label", "Ping: 52 ms"}, {"Suffix", "52 ms"}};
        for (String[] pair : expected) {
            ctx.config().put("mod.ping.format", pair[0]);
            TestContext.Rec canvas = new TestContext.Rec();
            ping.render(canvas, 0, 0, 0, ctx);
            assertEquals(Arrays.asList(pair[1]), canvas.texts, pair[0]);
        }
    }

    @Test void anInvalidStoredFormatFallsBackToTheDefault() {
        FpsMod fps = new FpsMod();
        ModRegistry.register(fps);
        ctx.fps = 60;
        ctx.config().put("mod.fps.format", "{value} injected");
        TestContext.Rec canvas = new TestContext.Rec();
        fps.render(canvas, 0, 0, 0, ctx);
        assertEquals(Arrays.asList("(60)"), canvas.texts);
    }

    @Test void fpsAndPingOfferFormatAndColourBeforeTheAppearanceOptions() {
        for (HudMod m : new HudMod[] {new FpsMod(), new PingMod()}) {
            assertEquals("format", m.settings().get(0).key());
            assertEquals("color", m.settings().get(1).key());
            assertEquals("background", m.settings().get(2).key());
            assertEquals("bgcolor", m.settings().get(3).key());
            assertEquals("opacity", m.settings().get(4).key());
            assertEquals("scale", m.settings().get(5).key());
        }
    }

    @Test void textColourIsAppliedToTheDrawnText() {
        FpsMod fps = new FpsMod();
        ModRegistry.register(fps);
        TestContext.Rec canvas = new TestContext.Rec();
        fps.render(canvas, 0, 0, 0, ctx);
        ctx.config().put("mod.fps.color", "Green");
        fps.render(canvas, 0, 0, 0, ctx);
        assertEquals(Arrays.asList(0xFFFFFFFF, HudColors.argb("Green")), canvas.textColors, "white by default, then the chosen colour");
    }

    @Test void formatAndColourTravelInProfilesAsOrdinaryModKeys() {
        assertTrue(dev.cirrus.core.profile.ProfileCodec.allowedKey("mod.fps.format"));
        assertTrue(dev.cirrus.core.profile.ProfileCodec.allowedKey("mod.fps.color"));
    }
}
