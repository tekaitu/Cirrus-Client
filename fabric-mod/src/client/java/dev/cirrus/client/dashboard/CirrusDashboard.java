package dev.cirrus.client.dashboard;

import dev.cirrus.client.config.CirrusConfig;
import net.minecraft.client.Minecraft;

/**
 * Entry point for screens: {@code CirrusDashboard.get()} always returns usable data (cache, else bundled fallback).
 * A background refresh runs once per session, and only when a dashboard URL is configured via the
 * {@code dashboard.url} setting or the {@code -Dcirrus.dashboard.url=https://...} JVM property.
 */
public final class CirrusDashboard {
    private static DashboardRepository repository;
    private static boolean refreshStarted;
    private CirrusDashboard() { }

    private static synchronized DashboardRepository repository() {
        if (repository == null) repository = new DashboardRepository(Minecraft.getInstance().gameDirectory.toPath());
        return repository;
    }

    public static DashboardConfig get() { return repository().get(); }

    /** Idempotent; safe to call from the title screen every time it opens. */
    public static synchronized void refreshOnce() {
        if (refreshStarted) return;
        refreshStarted = true;
        String url = System.getProperty("cirrus.dashboard.url", CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath()).getString("dashboard.url", ""));
        if (!url.isBlank()) repository().refresh(url);
    }
}
