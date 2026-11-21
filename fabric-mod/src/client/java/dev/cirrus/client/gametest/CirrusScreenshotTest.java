package dev.cirrus.client.gametest;

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
        for (String id : new String[] {"armor_status", "keystrokes", "fps", "ping"})
            screens.put("settings-" + id, () -> new dev.cirrus.client.ModSettingsScreen(null, dev.cirrus.client.mod.ModRegistry.find(id).orElseThrow()));

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
        context.runOnClient(mc -> dev.cirrus.client.config.CirrusConfig.get(mc.gameDirectory.toPath()).put("onboarding.complete", "true"));
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
            var cfg = dev.cirrus.client.config.CirrusConfig.get(mc.gameDirectory.toPath());
            cfg.put("enabled.armor_status", "true");
        });
        context.waitTicks(5);
        // Multiplayer states that need interaction: a selected personal row, the advertised partner row, a plain partner row.
        context.setScreen(() -> new CirrusJoinMultiplayerScreen(null));
        context.waitTicks(20);
        context.getInput().pressKey(org.lwjgl.glfw.GLFW.GLFW_KEY_DOWN);
        context.waitTicks(10);
        context.takeScreenshot("multiplayer-selected-personal-1280x720-gui2");
        context.getInput().pressKey(org.lwjgl.glfw.GLFW.GLFW_KEY_DOWN);
        context.getInput().pressKey(org.lwjgl.glfw.GLFW.GLFW_KEY_DOWN);
        context.waitTicks(10);
        context.takeScreenshot("multiplayer-selected-advertised-1280x720-gui2");
        context.getInput().pressKey(org.lwjgl.glfw.GLFW.GLFW_KEY_DOWN);
        context.waitTicks(10);
        context.takeScreenshot("multiplayer-selected-partner-1280x720-gui2");
        // Non-default options, to prove the settings change what is drawn: armor as percentages, side by side, no background.
        context.runOnClient(mc -> {
            var cfg = dev.cirrus.client.config.CirrusConfig.get(mc.gameDirectory.toPath());
            var armor = dev.cirrus.client.mod.ModRegistry.find("armor_status").orElseThrow();
            for (var st : armor.settings()) {
                String v = switch (st.key()) { case "display" -> "Percentage"; case "layout" -> "Horizontal"; case "background" -> "false"; case "shadow" -> "true"; case "scale" -> "130"; default -> st.defaultValue(); };
                dev.cirrus.client.mod.ModSettings.set(cfg, "armor_status", st, v);
            }
            var keys = dev.cirrus.client.mod.ModRegistry.find("keystrokes").orElseThrow();
            for (var st : keys.settings()) {
                String v = switch (st.key()) { case "mouse" -> "false"; case "background" -> "false"; default -> st.defaultValue(); };
                dev.cirrus.client.mod.ModSettings.set(cfg, "keystrokes", st, v);
            }
        });
        for (String id : new String[] {"armor_status", "keystrokes"}) {
            context.setScreen(() -> new dev.cirrus.client.ModSettingsScreen(null, dev.cirrus.client.mod.ModRegistry.find(id).orElseThrow()));
            context.waitTicks(15);
            context.takeScreenshot("settings-" + id + "-custom-1280x720-gui2");
        }
        context.setScreen(() -> new HudEditorScreen(null, "armor_status"));
        context.waitTicks(15);
        context.takeScreenshot("hud-editor-custom-1280x720-gui2");
        // Real profile round trip: save two setups, switch between them, share one as a code and import it again.
        context.runOnClient(mc -> {
            var cfg = dev.cirrus.client.config.CirrusConfig.get(mc.gameDirectory.toPath());
            var profiles = new dev.cirrus.client.profile.Profiles(mc);
            var fps = dev.cirrus.client.mod.ModRegistry.find("fps").orElseThrow();
            var scale = fps.settings().stream().filter(st -> st.key().equals("scale")).findFirst().orElseThrow();
            try {
                dev.cirrus.client.mod.ModSettings.set(cfg, "fps", scale, "150");
                fps.setEnabled(cfg, true);
                profiles.create("PvP");
                dev.cirrus.client.mod.ModSettings.set(cfg, "fps", scale, "80");
                fps.setEnabled(cfg, false);
                profiles.create("Casual");
                profiles.apply("PvP");
                check("PvP restores scale", dev.cirrus.client.mod.ModSettings.get(cfg, "fps", fps.settings(), "scale").equals("150"));
                check("PvP restores the switch", fps.enabled(cfg));
                String code = profiles.share("Casual");
                String imported = profiles.importCode(code);
                check("import is a new profile", imported.equals("Casual 2"));
                profiles.apply(imported);
                check("imported profile restores scale", dev.cirrus.client.mod.ModSettings.get(cfg, "fps", fps.settings(), "scale").equals("80"));
                check("imported profile restores the switch", !fps.enabled(cfg));
                profiles.apply("PvP");
            } catch (java.io.IOException e) { throw new IllegalStateException(e); }
        });
        for (String shot : new String[] {"menu-profiles", "menu-fps"}) {
            context.setScreen(screens.get(shot));
            context.waitTicks(20);
            context.takeScreenshot(shot + "-with-profiles-1280x720-gui2");
        }
        context.setScreen(CirrusTitleScreen::new);
        context.waitTicks(10);
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
