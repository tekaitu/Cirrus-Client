package dev.cirrus.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.ConfirmLinkScreen;
import net.minecraft.client.gui.screens.Screen;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;

/** Opens links and folders through Minecraft's own helpers so behaviour matches the rest of the game. */
public final class PlatformOpen {
    private PlatformOpen() { }

    /** Shows the vanilla "Open link?" confirmation for an https URL. Returns false when the URL is unusable. */
    public static boolean link(Screen from, String url) {
        if (url == null || !url.startsWith("https://")) return false;
        ConfirmLinkScreen.confirmLinkNow(from, URI.create(url));
        return true;
    }

    public static void folder(Path dir) {
        try {
            Files.createDirectories(dir);
            net.minecraft.util.Util.getPlatform().openPath(dir);
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger("Cirrus Client").warn("Could not open {}: {}", dir, e.toString());
        }
    }

    public static Path screenshots() { return Minecraft.getInstance().gameDirectory.toPath().resolve("screenshots"); }
}
