package dev.cirrus.client.gametest;

import dev.cirrus.client.CirrusDashboardScreen;
import dev.cirrus.client.CirrusMenuScreen;
import dev.cirrus.client.CirrusMultiplayerScreen;
import dev.cirrus.client.CirrusServerEditScreen;
import dev.cirrus.client.CirrusTitleScreen;
import dev.cirrus.client.CirrusThemesScreen;
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
        screens.put("multiplayer", () -> new CirrusMultiplayerScreen(null));
        screens.put("server-add", () -> { var mc = net.minecraft.client.Minecraft.getInstance(); return new CirrusServerEditScreen(null, CirrusServerEditScreen.Mode.ADD, new net.minecraft.client.multiplayer.ServerList(mc), null); });
        screens.put("menu", () -> new CirrusMenuScreen(null));
        screens.put("dashboard", () -> new CirrusDashboardScreen(null));
        screens.put("themes", () -> new CirrusThemesScreen(null));
        screens.put("hud-editor", () -> new HudEditorScreen(null));

        context.waitTicks(40);
        context.takeScreenshot("boot");
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
        // Light theme and an enabled HUD element, at the most common setup.
        context.getInput().resizeWindow(1280, 720);
        context.runOnClient(mc -> {
            mc.options.guiScale().set(2);
            mc.resizeDisplay();
            var cfg = dev.cirrus.client.config.CirrusConfig.get(mc.gameDirectory.toPath());
            dev.cirrus.client.ui.CirrusTheme.set(cfg, dev.cirrus.client.ui.CirrusTheme.LIGHT);
            cfg.put("enabled.local_status", "true");
        });
        context.waitTicks(5);
        for (Map.Entry<String, Supplier<Screen>> entry : screens.entrySet()) {
            context.setScreen(entry.getValue());
            context.waitTicks(25);
            context.takeScreenshot("light-" + entry.getKey() + "-1280x720-gui2");
        }
        context.runOnClient(mc -> dev.cirrus.client.ui.CirrusTheme.set(dev.cirrus.client.config.CirrusConfig.get(mc.gameDirectory.toPath()), dev.cirrus.client.ui.CirrusTheme.DARK));
        // Multiplayer states that need interaction: a selected partner row, a selected personal row, the edit dialog.
        context.setScreen(() -> new CirrusMultiplayerScreen(null));
        context.waitTicks(20);
        context.getInput().pressKey(org.lwjgl.glfw.GLFW.GLFW_KEY_DOWN);
        context.getInput().pressKey(org.lwjgl.glfw.GLFW.GLFW_KEY_DOWN);
        context.waitTicks(15);
        context.takeScreenshot("multiplayer-selected-partner-1280x720-gui2");
        for (int i = 0; i < 6; i++) context.getInput().pressKey(org.lwjgl.glfw.GLFW.GLFW_KEY_DOWN);
        context.waitTicks(20);
        context.takeScreenshot("multiplayer-selected-personal-1280x720-gui2");
        context.setScreen(() -> {
            var mc = net.minecraft.client.Minecraft.getInstance();
            var list = new net.minecraft.client.multiplayer.ServerList(mc);
            list.load();
            return new CirrusServerEditScreen(null, CirrusServerEditScreen.Mode.EDIT, list, list.get(0));
        });
        context.waitTicks(15);
        context.takeScreenshot("server-edit-1280x720-gui2");
        context.setScreen(() -> new CirrusServerEditScreen(null, CirrusServerEditScreen.Mode.DIRECT, new net.minecraft.client.multiplayer.ServerList(net.minecraft.client.Minecraft.getInstance()), null));
        context.waitTicks(10);
        context.takeScreenshot("server-direct-1280x720-gui2");
        context.setScreen(CirrusTitleScreen::new);
        context.waitTicks(10);
    }
}
