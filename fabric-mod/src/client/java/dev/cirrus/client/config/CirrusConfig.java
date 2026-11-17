package dev.cirrus.client.config;

import java.io.IOException;
import java.nio.file.*;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Versioned per-game-directory settings. Fabric instances have independent game directories. */
public final class CirrusConfig {
    private static final Logger LOG = LoggerFactory.getLogger("Cirrus Client");
    private static final int VERSION = 1;
    private static CirrusConfig instance;
    private final Path file;
    private final Properties values = new Properties();

    private CirrusConfig(Path gameDir) { file = gameDir.resolve("config/cirrus-client/settings.properties"); }

    public static synchronized CirrusConfig get(Path gameDir) {
        if (instance == null || !instance.file.equals(gameDir.resolve("config/cirrus-client/settings.properties"))) {
            instance = new CirrusConfig(gameDir); instance.load();
        }
        return instance;
    }

    public boolean getBoolean(String key, boolean fallback) {
        String value = values.getProperty(key);
        if (value == null) return fallback;
        if (value.equalsIgnoreCase("true")) return true;
        if (value.equalsIgnoreCase("false")) return false;
        return fallback;
    }
    public int getInt(String key, int fallback) {
        try { return Integer.parseInt(values.getProperty(key, Integer.toString(fallback))); }
        catch (NumberFormatException ignored) { return fallback; }
    }
    public String getString(String key, String fallback) { return values.getProperty(key, fallback); }
    public void put(String key, String value) { values.setProperty(key, value); save(); }
    private void load() {
        if (!Files.isRegularFile(file)) {
            Path legacy = file.getParent().getParent().resolve("cirrus-client.properties");
            if (Files.isRegularFile(legacy)) {
                try (var in = Files.newInputStream(legacy)) {
                    Properties old = new Properties(); old.load(in);
                    values.setProperty("enabled.local_status", old.getProperty("enabled", "false"));
                    values.setProperty("hud.anchor.local_status", Boolean.parseBoolean(old.getProperty("rightAligned", "false")) ? "TOP_RIGHT" : "TOP_LEFT");
                    save();
                } catch (IOException e) { LOG.warn("Could not import existing Cirrus settings.", e); }
            }
            return;
        }
        try (var in = Files.newInputStream(file)) {
            values.load(in);
            int version = Integer.parseInt(values.getProperty("schema", "0"));
            if (version > VERSION) { LOG.warn("Cirrus settings were created by a newer version; using safe defaults."); values.clear(); }
        } catch (IOException | NumberFormatException e) { LOG.warn("Could not load Cirrus settings; using defaults.", e); values.clear(); }
    }
    private void save() {
        values.setProperty("schema", Integer.toString(VERSION));
        Path temp = file.resolveSibling("settings.properties.tmp");
        try {
            Files.createDirectories(file.getParent());
            try (var out = Files.newOutputStream(temp)) { values.store(out, "Cirrus Client settings"); }
            try { Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
            catch (AtomicMoveNotSupportedException e) { Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING); }
        } catch (IOException e) { LOG.warn("Could not save Cirrus settings.", e); }
    }
}
