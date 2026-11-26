package dev.cirrus.client.gametest;


import dev.cirrus.core.input.Keys;
import dev.cirrus.client.CirrusDashboardScreen;
import dev.cirrus.client.CirrusMenuScreen;
import dev.cirrus.client.CirrusJoinMultiplayerScreen;
import dev.cirrus.client.CirrusTitleScreen;
import dev.cirrus.client.HudEditorScreen;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Runs the real Minecraft client and photographs every Cirrus screen at several window sizes and GUI scales.
 * Only used by CI (runClientGameTest); it never runs for players.
 */
public final class CirrusScreenshotTest implements FabricClientGameTest {
    private static final int[][] WINDOWS = {{854, 480}, {1280, 720}, {1920, 1080}};
    private static final int[][] SCALES = {{854, 480, 2}, {854, 480, 3}, {1280, 720, 1}, {1280, 720, 2}, {1280, 720, 3}, {1920, 1080, 2}, {1920, 1080, 3}, {1920, 1080, 4}};

    @Override
    public void runTest(ClientGameTestContext context) {
        Map<String, Supplier<Screen>> screens = new LinkedHashMap<>();
        screens.put("title", CirrusTitleScreen::new);
        screens.put("multiplayer", () -> new CirrusJoinMultiplayerScreen(null));
        screens.put("menu", () -> new CirrusMenuScreen(null));
        screens.put("menu-profiles", () -> new CirrusMenuScreen(null, true));
        screens.put("menu-fps", () -> new CirrusMenuScreen(null).withModule("fps"));
        screens.put("menu-armor_status", () -> new CirrusMenuScreen(null).withModule("armor_status"));
        screens.put("menu-planned", () -> new CirrusMenuScreen(null).withModule("zoom"));
        screens.put("dashboard", () -> new CirrusDashboardScreen(null));
        screens.put("hud-editor", () -> new HudEditorScreen(null));
        screens.put("hud-editor-fps", () -> new HudEditorScreen(null, "fps"));
        for (String id : new String[] {"armor_status", "keystrokes", "fps", "ping"})
            screens.put("settings-" + id, () -> new dev.cirrus.client.ModSettingsScreen(null, dev.cirrus.core.module.ModRegistry.find(id).orElseThrow()));

        context.waitTicks(40);
        context.takeScreenshot("boot");
        // A labelled test-only dashboard so the partner features can be photographed. These servers do not exist (127.0.0.1 has no
        // Minecraft server in CI), so their rows honestly show as unreachable; nothing here ships in the mod.
        context.runOnClient(mc -> {
            try {
                var cache = mc.gameDirectory.toPath().resolve("config/cirrus-client/dashboard-cache.json");
                java.nio.file.Files.createDirectories(cache.getParent());
                java.nio.file.Files.writeString(cache, FIXTURE);
            } catch (java.io.IOException e) { throw new IllegalStateException(e); }
            dev.cirrus.client.dashboard.CirrusDashboard.reloadForTest();
        });
        context.runOnClient(mc -> dev.cirrus.core.config.CirrusConfig.get(mc.gameDirectory.toPath()).put("onboarding.complete", "true"));
        context.runOnClient(mc -> {      // a couple of saved servers so the Multiplayer screenshots show real rows
            var list = new net.minecraft.client.multiplayer.ServerList(mc);
            list.load();
            if (list.size() == 0) {
                list.add(new net.minecraft.client.multiplayer.ServerData("My Survival World", "survival.example.com", net.minecraft.client.multiplayer.ServerData.Type.OTHER), false);
                list.add(new net.minecraft.client.multiplayer.ServerData("Friends Realm", "friends.example.com:25570", net.minecraft.client.multiplayer.ServerData.Type.OTHER), false);
                list.save();
            }
        });
        for (int[] combo : SCALES) {
            context.getInput().resizeWindow(combo[0], combo[1]);
            int scale = combo[2];
            context.runOnClient(mc -> {
                mc.options.guiScale().set(scale);
                mc.resizeDisplay();
            });
            context.waitTicks(5);
            for (Map.Entry<String, Supplier<Screen>> entry : screens.entrySet()) {
                context.setScreen(entry.getValue());
                context.waitTicks(25);
                context.takeScreenshot(entry.getKey() + "-" + combo[0] + "x" + combo[1] + "-gui" + scale);
            }
        }
        // Enable the HUD elements at the most common setup.
        context.getInput().resizeWindow(1280, 720);
        context.runOnClient(mc -> {
            mc.options.guiScale().set(2);
            mc.resizeDisplay();
            var cfg = dev.cirrus.core.config.CirrusConfig.get(mc.gameDirectory.toPath());
            cfg.put("enabled.armor_status", "true");
        });
        context.waitTicks(5);
        // Multiplayer states that need interaction: a selected personal row, the advertised partner row, a plain partner row.
        context.setScreen(() -> new CirrusJoinMultiplayerScreen(null));
        context.waitTicks(20);
        context.getInput().pressKey(Keys.DOWN);
        context.waitTicks(10);
        context.takeScreenshot("multiplayer-selected-personal-1280x720-gui2");
        context.getInput().pressKey(Keys.DOWN);
        context.getInput().pressKey(Keys.DOWN);
        context.waitTicks(10);
        context.takeScreenshot("multiplayer-selected-advertised-1280x720-gui2");
        context.getInput().pressKey(Keys.DOWN);
        context.waitTicks(10);
        context.takeScreenshot("multiplayer-selected-partner-1280x720-gui2");
        // Non-default options, to prove the settings change what is drawn: armor as percentages, side by side, no background.
        context.runOnClient(mc -> {
            var cfg = dev.cirrus.core.config.CirrusConfig.get(mc.gameDirectory.toPath());
            var armor = dev.cirrus.core.module.ModRegistry.find("armor_status").orElseThrow();
            for (var st : armor.settings()) {
                String v = switch (st.key()) { case "display" -> "Percentage"; case "layout" -> "Horizontal"; case "background" -> "false"; case "shadow" -> "true"; case "scale" -> "130"; default -> st.defaultValue(); };
                dev.cirrus.core.settings.ModSettings.set(cfg, "armor_status", st, v);
            }
            var keys = dev.cirrus.core.module.ModRegistry.find("keystrokes").orElseThrow();
            for (var st : keys.settings()) {
                String v = switch (st.key()) { case "mouse" -> "false"; case "background" -> "false"; default -> st.defaultValue(); };
                dev.cirrus.core.settings.ModSettings.set(cfg, "keystrokes", st, v);
            }
        });
        for (String id : new String[] {"armor_status", "keystrokes"}) {
            context.setScreen(() -> new dev.cirrus.client.ModSettingsScreen(null, dev.cirrus.core.module.ModRegistry.find(id).orElseThrow()));
            context.waitTicks(15);
            context.takeScreenshot("settings-" + id + "-custom-1280x720-gui2");
        }
        context.setScreen(() -> new HudEditorScreen(null, "armor_status"));
        context.waitTicks(15);
        context.takeScreenshot("hud-editor-custom-1280x720-gui2");
        // Real profile round trip: save two setups, switch between them, share one as a code and import it again.
        context.runOnClient(mc -> {
            var cfg = dev.cirrus.core.config.CirrusConfig.get(mc.gameDirectory.toPath());
            var profiles = new dev.cirrus.core.profile.Profiles(mc.gameDirectory.toPath());
            var fps = dev.cirrus.core.module.ModRegistry.find("fps").orElseThrow();
            var scale = fps.settings().stream().filter(st -> st.key().equals("scale")).findFirst().orElseThrow();
            try {
                dev.cirrus.core.settings.ModSettings.set(cfg, "fps", scale, "150");
                fps.setEnabled(cfg, true);
                profiles.create("PvP");
                dev.cirrus.core.settings.ModSettings.set(cfg, "fps", scale, "80");
                fps.setEnabled(cfg, false);
                profiles.create("Casual");
                profiles.apply("PvP");
                check("PvP restores scale", dev.cirrus.core.settings.ModSettings.get(cfg, "fps", fps.settings(), "scale").equals("150"));
                check("PvP restores the switch", fps.enabled(cfg));
                String code = profiles.share("Casual");
                String imported = profiles.importCode(code);
                check("import is a new profile", imported.equals("Casual 2"));
                profiles.apply(imported);
                check("imported profile restores scale", dev.cirrus.core.settings.ModSettings.get(cfg, "fps", fps.settings(), "scale").equals("80"));
                check("imported profile restores the switch", !fps.enabled(cfg));
                profiles.apply("PvP");
            } catch (java.io.IOException e) { throw new IllegalStateException(e); }
        });
        context.setScreen(() -> new CirrusMenuScreen(null).withProfileMenu());
        context.waitTicks(20);
        context.takeScreenshot("menu-profile-dropdown-1280x720-gui2");
        for (String shot : new String[] {"menu-profiles", "menu-fps"}) {
            context.setScreen(screens.get(shot));
            context.waitTicks(20);
            context.takeScreenshot(shot + "-with-profiles-1280x720-gui2");
        }
        dumpSignatures(context);
        verifyArchitecture(context);
        verifyHudEditor(context, screens);
        measurePerformance(context, screens);
        context.setScreen(CirrusTitleScreen::new);
        context.waitTicks(10);
    }

    /** Phase 2 integration checks on the real 1.21.11 game: Core input events, ModContext and the Core HUD model. */
    private static void verifyArchitecture(ClientGameTestContext context) {
        context.runOnClient(mc -> {
            var ctx = dev.cirrus.client.mod.ClientModContext.INSTANCE;
            var cfg = ctx.config();
            check("ModContext reports a GUI size", ctx.screenWidth() > 0 && ctx.screenHeight() > 0);
            check("ModContext reports fps", ctx.fps() >= 0);
            check("ModContext measures text", ctx.text().width("FPS: 000", dev.cirrus.core.text.TextStyle.BODY) > 0);
            check("no world: not in world and no ping", !ctx.inWorld() && ctx.pingMillis() == -1);
            var input = dev.cirrus.client.render.McInput.INSTANCE;
            check("input polling: nothing held", !input.isKeyDown(Keys.SPACE) && !input.isMouseDown(dev.cirrus.core.input.MouseButtons.LEFT)
                && !input.isMouseDown(dev.cirrus.core.input.MouseButtons.RIGHT) && !input.isMouseDown(dev.cirrus.core.input.MouseButtons.MIDDLE) && input.modifiers() == 0);
            var fps = dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow();
            fps.setPosition(cfg, 100, 60, ctx.screenWidth(), ctx.screenHeight());
            dev.cirrus.core.hud.HudLayout.remove(fps, cfg);
            check("removed widget leaves the active list", !dev.cirrus.core.hud.HudLayout.isActive(fps, cfg)
                && dev.cirrus.core.hud.HudLayout.removed(dev.cirrus.core.hud.HudElementRegistry.all(), cfg).contains(fps));
            dev.cirrus.core.hud.HudLayout.restore(fps, cfg);
            check("restored widget is back where it was", dev.cirrus.core.hud.HudLayout.isActive(fps, cfg)
                && fps.x(cfg, ctx.screenWidth()) == 100 && fps.y(cfg, ctx.screenHeight()) == 60);
            var drag = new dev.cirrus.core.hud.HudDrag();
            drag.begin(fps, cfg, ctx.screenWidth(), ctx.screenHeight(), 105, 63);
            drag.update(cfg, ctx.screenWidth(), ctx.screenHeight(), 205, 93);
            drag.end();
            check("dragging moves and persists the widget", fps.x(cfg, ctx.screenWidth()) == 200 && fps.y(cfg, ctx.screenHeight()) == 90);
            dev.cirrus.core.hud.HudLayout.resetPosition(fps, cfg, ctx.screenWidth(), ctx.screenHeight());
        });
        // Real key events through a Cirrus screen must reach the Core input model.
        final int[] pressed = {0};
        final dev.cirrus.core.input.InputAdapter counter = new dev.cirrus.core.input.InputAdapter() {
            @Override public void onKeyPressed(int key, int modifiers) { if (key == Keys.DOWN) pressed[0]++; }
        };
        context.runOnClient(mc -> dev.cirrus.client.render.McInput.INSTANCE.events().addListener(counter));
        context.setScreen(() -> new CirrusMenuScreen(null));
        context.waitTicks(10);
        context.getInput().pressKey(Keys.DOWN);
        context.waitTicks(5);
        context.runOnClient(mc -> {
            dev.cirrus.client.render.McInput.INSTANCE.events().removeListener(counter);
            check("a real key press reaches the Core input listeners", pressed[0] >= 1);
        });
    }

    /**
     * Logs the real method signatures of the 1.21.11 classes the Maple glyph hooks into, as "[maple-dump]" lines. The hooks are written
     * against these names; this keeps them checkable on every run instead of guessed.
     */
    private static void dumpSignatures(ClientGameTestContext context) {
        context.runOnClient(mc -> {
            String[] names = {"net.minecraft.client.gui.components.PlayerTabOverlay", "net.minecraft.client.renderer.entity.EntityRenderer",
                "net.minecraft.client.renderer.entity.player.AvatarRenderer", "net.minecraft.client.renderer.entity.player.PlayerRenderer",
                "net.minecraft.client.renderer.entity.LivingEntityRenderer", "net.minecraft.client.renderer.entity.state.EntityRenderState",
                "net.minecraft.client.renderer.entity.state.AvatarRenderState", "net.minecraft.client.renderer.entity.state.PlayerRenderState",
                "net.minecraft.client.multiplayer.PlayerInfo"};
            for (String n : names) {
                try {
                    Class<?> c = Class.forName(n);
                    System.out.println("[maple-dump] class " + n + " extends " + c.getSuperclass().getName());
                    for (var f : c.getDeclaredFields()) if (n.contains("State")) System.out.println("[maple-dump]   field " + f.getType().getName() + " " + f.getName());
                    for (var ctor : c.getDeclaredConstructors()) System.out.println("[maple-dump]   ctor " + java.util.Arrays.toString(ctor.getParameterTypes()));
                    for (var me : c.getDeclaredMethods()) {
                        String name = me.getName().toLowerCase(java.util.Locale.ROOT);
                        if (name.contains("name") || name.contains("display") || name.contains("extract") || name.contains("tag") || name.contains("render") && n.endsWith("TabOverlay"))
                            System.out.println("[maple-dump]   method " + me.getReturnType().getName() + " " + me.getName() + java.util.Arrays.toString(me.getParameterTypes()));
                    }
                } catch (Throwable t) { System.out.println("[maple-dump] missing " + n + " (" + t.getClass().getSimpleName() + ")"); }
            }
        });
    }

    @SuppressWarnings("unchecked")
    private static <T> T onEditor(ClientGameTestContext context, java.util.function.Function<HudEditorScreen, T> fn) {
        Object[] out = new Object[1];
        context.runOnClient(mc -> out[0] = fn.apply((HudEditorScreen) mc.screen));
        return (T) out[0];
    }

    /** Moves the real cursor to a GUI-unit point and presses a real mouse button there (0 = left, 1 = right). */
    private static void clickGui(ClientGameTestContext context, int[] gui, int button) {
        moveGui(context, gui);
        context.getInput().pressMouse(button);
        context.waitTick();
    }

    private static void moveGui(ClientGameTestContext context, int[] gui) {
        double[] px = new double[2];
        context.runOnClient(mc -> { double scale = mc.getWindow().getGuiScale(); px[0] = gui[0] * scale; px[1] = gui[1] * scale; });
        context.getInput().setCursorPos(px[0], px[1]);
        context.waitTick();
    }

    private static boolean hideGui(ClientGameTestContext context) {
        boolean[] out = new boolean[1];
        context.runOnClient(mc -> out[0] = mc.options.hideGui);
        return out[0];
    }

    /**
     * Redesign checks on the real game, driven with real mouse and keyboard input: the editor hides the vanilla HUD, the right-click menu
     * disables, enables and removes a widget, the Widgets list restores it where it was, Customize changes and resets options, dragging
     * moves and persists, Mods opens the Click GUI and Esc returns to the same editor, and Done restores the vanilla HUD.
     */
    private static void verifyHudEditor(ClientGameTestContext context, Map<String, Supplier<Screen>> screens) {
        context.runOnClient(mc -> {
            var ctx = dev.cirrus.client.mod.ClientModContext.INSTANCE;
            var cfg = ctx.config();
            var fps = dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow();
            check("FPS format defaults to parentheses with no label", dev.cirrus.core.settings.ModSettings.get(cfg, "fps", ((dev.cirrus.core.module.CirrusMod) fps).settings(), "format").equals("Parentheses"));
            for (var e : dev.cirrus.core.hud.HudElementRegistry.all()) dev.cirrus.core.hud.HudLayout.restore(e, cfg);
            fps.setPosition(cfg, 100, 60, ctx.screenWidth(), ctx.screenHeight());
        });
        boolean hiddenBefore = hideGui(context);
        context.setScreen(screens.get("hud-editor-fps"));
        context.waitTicks(15);
        check("the editor hides the vanilla HUD", hideGui(context));
        context.takeScreenshot("hud-editor-fps-1280x720-gui2");
        context.getInput().pressKey(Keys.RIGHT);
        context.getInput().pressKey(Keys.DOWN);
        context.waitTicks(5);
        context.runOnClient(mc -> {
            var ctx = dev.cirrus.client.mod.ClientModContext.INSTANCE;
            var fps = dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow();
            check("arrow keys nudge the selected widget by one unit", fps.x(ctx.config(), ctx.screenWidth()) == 101 && fps.y(ctx.config(), ctx.screenHeight()) == 61);
            fps.setPosition(ctx.config(), 100, 60, ctx.screenWidth(), ctx.screenHeight());
        });

        // Right-click -> compact menu.
        clickGui(context, onEditor(context, e -> e.widgetCentre("fps")), 1);
        context.waitTicks(3);
        check("right-click opens the context menu", onEditor(context, HudEditorScreen::openPopup).equals("MENU"));
        check("the menu offers Disable, Remove and Customize", onEditor(context, HudEditorScreen::menuLabels).equals(java.util.List.of("Disable widget", "Remove widget", "Customize")));
        context.takeScreenshot("hud-editor-context-menu-1280x720-gui2");

        // Disable: stays configured and in the layout, off the HUD.
        clickGui(context, onEditor(context, e -> e.menuRowCentre(0)), 0);
        context.waitTicks(3);
        context.runOnClient(mc -> {
            var cfg = dev.cirrus.client.mod.ClientModContext.INSTANCE.config();
            var fps = dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow();
            check("Disable switches the widget off but keeps it in the layout", dev.cirrus.core.hud.HudLayout.isDisabled(fps, cfg) && !dev.cirrus.core.hud.HudLayout.isActive(fps, cfg));
        });
        context.takeScreenshot("hud-editor-disabled-1280x720-gui2");

        // Enable it again from the same menu.
        clickGui(context, onEditor(context, e -> e.widgetCentre("fps")), 1);
        check("a disabled widget offers Enable", onEditor(context, HudEditorScreen::menuLabels).get(0).equals("Enable widget"));
        clickGui(context, onEditor(context, e -> e.menuRowCentre(0)), 0);
        context.waitTicks(3);
        context.runOnClient(mc -> {
            var cfg = dev.cirrus.client.mod.ClientModContext.INSTANCE.config();
            check("Enable puts it back on the HUD", dev.cirrus.core.hud.HudLayout.isActive(dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow(), cfg));
        });

        // Remove: leaves the layout.
        clickGui(context, onEditor(context, e -> e.widgetCentre("fps")), 1);
        clickGui(context, onEditor(context, e -> e.menuRowCentre(1)), 0);
        context.waitTicks(3);
        context.runOnClient(mc -> {
            var cfg = dev.cirrus.client.mod.ClientModContext.INSTANCE.config();
            var fps = dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow();
            check("Remove takes the widget out of the layout", dev.cirrus.core.hud.HudLayout.isRemoved(fps, cfg) && !dev.cirrus.core.hud.HudLayout.isPresent(fps, cfg));
        });
        context.takeScreenshot("hud-editor-removed-1280x720-gui2");

        // Restore from the Widgets list, back where it was.
        clickGui(context, onEditor(context, e -> e.clusterButtonCentre(1)), 0);
        context.waitTicks(3);
        check("Widgets opens the list", onEditor(context, HudEditorScreen::openPopup).equals("LIST"));
        context.takeScreenshot("hud-editor-widgets-list-1280x720-gui2");
        int fpsIndex = dev.cirrus.core.hud.HudElementRegistry.all().indexOf(dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow());
        clickGui(context, onEditor(context, e -> e.listChipCentre(fpsIndex)), 0);
        context.waitTicks(3);
        context.runOnClient(mc -> {
            var ctx = dev.cirrus.client.mod.ClientModContext.INSTANCE;
            var fps = dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow();
            check("the list restores a removed widget where it was", dev.cirrus.core.hud.HudLayout.isActive(fps, ctx.config())
                && fps.x(ctx.config(), ctx.screenWidth()) == 100 && fps.y(ctx.config(), ctx.screenHeight()) == 60);
        });
        context.getInput().pressKey(Keys.ESCAPE);
        context.waitTicks(2);
        check("Esc closes the list before leaving the editor", onEditor(context, HudEditorScreen::openPopup).equals("NONE"));

        // Customize: popover with the widget's options; change, then reset with a real click.
        clickGui(context, onEditor(context, e -> e.widgetCentre("fps")), 1);
        clickGui(context, onEditor(context, e -> e.menuRowCentre(2)), 0);
        context.waitTicks(3);
        check("Customize opens the options popover", onEditor(context, HudEditorScreen::openPopup).equals("CUSTOMIZE"));
        context.takeScreenshot("hud-editor-customize-1280x720-gui2");
        context.runOnClient(mc -> {
            var cfg = dev.cirrus.client.mod.ClientModContext.INSTANCE.config();
            var fps = (dev.cirrus.core.module.CirrusMod) dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow();
            for (var st : fps.settings()) {
                String v = switch (st.key()) { case "color" -> "Maple"; case "background" -> "true"; case "bgcolor" -> "Navy"; case "opacity" -> "55"; case "scale" -> "130"; default -> st.defaultValue(); };
                dev.cirrus.core.settings.ModSettings.set(cfg, "fps", st, v);
            }
        });
        context.waitTicks(3);
        context.takeScreenshot("hud-editor-customize-styled-1280x720-gui2");
        clickGui(context, onEditor(context, e -> e.customizeChipCentre(0)), 0);
        context.waitTicks(3);
        context.runOnClient(mc -> {
            var cfg = dev.cirrus.client.mod.ClientModContext.INSTANCE.config();
            var fps = (dev.cirrus.core.module.CirrusMod) dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow();
            check("Reset options restores the defaults", dev.cirrus.core.settings.ModSettings.get(cfg, "fps", fps.settings(), "color").equals("White")
                && dev.cirrus.core.settings.ModSettings.get(cfg, "fps", fps.settings(), "opacity").equals("80")
                && dev.cirrus.core.settings.ModSettings.get(cfg, "fps", fps.settings(), "scale").equals("100"));
        });
        context.getInput().pressKey(Keys.ESCAPE);
        context.waitTicks(2);

        // Drag with the left button: moves and persists.
        int[] from = onEditor(context, e -> e.widgetCentre("fps"));
        moveGui(context, from);
        context.getInput().holdMouse(0);
        context.waitTick();
        moveGui(context, new int[] {from[0] + 90, from[1] + 50});
        context.waitTicks(2);
        context.takeScreenshot("hud-editor-dragging-1280x720-gui2");
        context.getInput().releaseMouse(0);
        context.waitTicks(2);
        context.runOnClient(mc -> {
            var ctx = dev.cirrus.client.mod.ClientModContext.INSTANCE;
            var fps = dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow();
            check("left-drag moves the widget and keeps the new position", fps.x(ctx.config(), ctx.screenWidth()) >= 170 && fps.y(ctx.config(), ctx.screenHeight()) >= 100);
        });

        // Mods opens the Click GUI; Esc comes back to the very same editor with its state.
        HudEditorScreen[] editor = new HudEditorScreen[1];
        context.runOnClient(mc -> editor[0] = (HudEditorScreen) mc.screen);
        clickGui(context, onEditor(context, e -> e.clusterButtonCentre(0)), 0);
        context.waitTicks(10);
        context.runOnClient(mc -> check("the floating Mods button opens the Click GUI", mc.screen instanceof CirrusMenuScreen));
        context.takeScreenshot("hud-editor-to-mods-1280x720-gui2");
        context.getInput().pressKey(Keys.ESCAPE);
        context.waitTicks(10);
        context.runOnClient(mc -> check("closing Mods returns to the same editor, vanilla HUD still hidden", mc.screen == editor[0] && mc.options.hideGui));

        // Done leaves the editor and brings the vanilla HUD back.
        clickGui(context, onEditor(context, e -> e.clusterButtonCentre(2)), 0);
        context.waitTicks(5);
        check("leaving the editor restores the vanilla HUD", hideGui(context) == hiddenBefore);
        context.runOnClient(mc -> {
            var ctx = dev.cirrus.client.mod.ClientModContext.INSTANCE;
            dev.cirrus.core.hud.HudLayout.resetPosition(dev.cirrus.core.hud.HudElementRegistry.find("fps").orElseThrow(), ctx.config(), ctx.screenWidth(), ctx.screenHeight());
        });
        context.setScreen(screens.get("hud-editor"));
        context.waitTicks(10);
        context.takeScreenshot("hud-editor-1280x720-gui2");
    }

    /**
     * Phase 1 performance prototype: times how long Cirrus spends issuing its own draw calls per frame on three screens at 1280x720,
     * GUI scale 2. The numbers are printed to the log as "[cirrus-perf]" lines. They are CPU time on the CI machine's software
     * renderer, so they say nothing about a player's GPU; the draw-operation counts per frame are meaningful on any machine.
     */
    private static void measurePerformance(ClientGameTestContext context, Map<String, Supplier<Screen>> screens) {
        context.runOnClient(mc -> dev.cirrus.core.perf.PerfMeter.setEnabled(true));
        for (String name : new String[] {"menu", "menu-fps", "menu-profiles"}) {
            context.setScreen(screens.get(name));
            context.waitTicks(10);
            context.runOnClient(mc -> dev.cirrus.core.perf.PerfMeter.MENU.clear());
            context.waitTicks(200);
            context.runOnClient(mc -> System.out.println("[cirrus-perf] screen=" + name + " 1280x720 gui2: " + dev.cirrus.core.perf.PerfMeter.MENU.stats()));
        }
        context.runOnClient(mc -> dev.cirrus.core.perf.PerfMeter.setEnabled(false));
    }

    private static void check(String what, boolean ok) { if (!ok) throw new IllegalStateException("Profile check failed: " + what); }

    private static final String FIXTURE = """
        {"schema":1,"revision":1,
         "partners":[
           {"id":"fixture-network","name":"Fixture Network","address":"127.0.0.1:25598","tagline":"CI fixture","order":1},
           {"id":"fixture-minigames","name":"Fixture Minigames","address":"127.0.0.1:25597","tagline":"CI fixture","order":2}],
         "advertised":{"partnerId":"fixture-network","startButton":true,"label":"START"}}
        """;
}
