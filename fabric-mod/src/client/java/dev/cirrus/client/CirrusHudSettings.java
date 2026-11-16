package dev.cirrus.client;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Properties;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.network.chat.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

final class CirrusHudSettings {
    private static final Logger LOGGER = LoggerFactory.getLogger("Cirrus Client");
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("cirrus-client.properties");
    private static boolean enabled;
    private static boolean rightAligned;

    static {
        load();
    }

    private CirrusHudSettings() {}

    static boolean isEnabled() {
        return enabled;
    }

    static boolean isRightAligned() {
        return rightAligned;
    }

    static void toggleEnabled() {
        enabled = !enabled;
        save();
    }

    static void toggleAlignment() {
        rightAligned = !rightAligned;
        save();
    }

    static void render(GuiGraphics graphics) {
        Minecraft client = Minecraft.getInstance();
        if (!enabled || client.player == null || client.level == null) {
            return;
        }

        int width = 132;
        int height = 30;
        int x = rightAligned ? client.getWindow().getGuiScaledWidth() - width - 8 : 8;
        int y = 8;

        graphics.fill(x, y, x + width, y + height, 0xD8101724);
        graphics.renderOutline(x, y, width, height, 0x805B98DE);
        graphics.drawString(client.font, Component.literal("CIRRUS"), x + 8, y + 6, 0xFFF2F6FC, false);
        graphics.drawString(client.font, Component.literal("LOCAL HUD"), x + 8, y + 18, 0xFF9CAABD, false);
    }

    private static void load() {
        if (!Files.isRegularFile(FILE)) {
            return;
        }

        Properties properties = new Properties();
        try (var input = Files.newInputStream(FILE)) {
            properties.load(input);
            enabled = Boolean.parseBoolean(properties.getProperty("enabled", "false"));
            rightAligned = Boolean.parseBoolean(properties.getProperty("rightAligned", "false"));
        } catch (IOException error) {
            LOGGER.warn("Could not read Cirrus HUD settings; using defaults.", error);
        }
    }

    private static void save() {
        Path temporary = FILE.resolveSibling("cirrus-client.properties.tmp");
        Properties properties = new Properties();
        properties.setProperty("enabled", Boolean.toString(enabled));
        properties.setProperty("rightAligned", Boolean.toString(rightAligned));

        try {
            Files.createDirectories(FILE.getParent());
            try (var output = Files.newOutputStream(temporary)) {
                properties.store(output, "Cirrus local HUD settings");
            }
            try {
                Files.move(temporary, FILE, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException error) {
                Files.move(temporary, FILE, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException error) {
            LOGGER.warn("Could not save Cirrus HUD settings.", error);
        }
    }
}
