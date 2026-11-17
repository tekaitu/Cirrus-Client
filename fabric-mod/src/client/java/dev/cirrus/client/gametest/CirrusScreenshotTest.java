package dev.cirrus.client.gametest;

import dev.cirrus.client.CirrusDashboardScreen;
import dev.cirrus.client.CirrusMenuScreen;
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
        screens.put("title", TitleScreen::new);
        screens.put("menu", () -> new CirrusMenuScreen(null));
        screens.put("dashboard", () -> new CirrusDashboardScreen(null));
        screens.put("themes", () -> new CirrusThemesScreen(null));
        screens.put("hud-editor", () -> new HudEditorScreen(null));

        context.waitTicks(20);
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
    }
}
