package dev.cirrus.client.dashboard;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Source of truth for dashboard data on the client. Resolution order, all validated by {@link DashboardParser}:
 * <ol>
 *   <li>the last good copy fetched from the dashboard ({@code config/cirrus-client/dashboard-cache.json}),</li>
 *   <li>the bundled fallback shipped inside the mod.</li>
 * </ol>
 * A remote refresh only happens when a dashboard URL is configured ({@code dashboard.url} in settings or the
 * {@code cirrus.dashboard.url} system property). Without one the client never touches the network for this data, so the
 * website dashboard can be connected later by publishing one JSON file at an https URL.
 */
public final class DashboardRepository {
    private static final Logger LOG = LoggerFactory.getLogger("Cirrus Client");
    public static final String FALLBACK_RESOURCE = "/assets/cirrus_fabric/dashboard/default-dashboard.json";
    private static final Duration TIMEOUT = Duration.ofSeconds(6);

    private final Path cacheFile;
    private final AtomicReference<DashboardConfig> current = new AtomicReference<>();
    private volatile boolean refreshing;

    public DashboardRepository(Path gameDir) { this.cacheFile = gameDir.resolve("config/cirrus-client/dashboard-cache.json"); }

    /** Never null: falls back to the bundled data (or an empty config if even that is unreadable). */
    public DashboardConfig get() {
        DashboardConfig value = current.get();
        if (value == null) { value = loadLocal(); current.compareAndSet(null, value); value = current.get(); }
        return value;
    }

    public boolean isRefreshing() { return refreshing; }

    DashboardConfig loadLocal() {
        if (Files.isRegularFile(cacheFile)) {
            try {
                if (Files.size(cacheFile) <= DashboardParser.MAX_BYTES) return DashboardParser.parse(Files.readString(cacheFile, StandardCharsets.UTF_8));
            } catch (IOException | IllegalArgumentException e) { LOG.warn("Ignoring unusable dashboard cache: {}", e.getMessage()); }
        }
        return loadBundled();
    }

    public static DashboardConfig loadBundled() {
        try (InputStream in = DashboardRepository.class.getResourceAsStream(FALLBACK_RESOURCE)) {
            if (in == null) throw new IOException("bundled dashboard fallback missing");
            return DashboardParser.parse(new String(in.readNBytes(DashboardParser.MAX_BYTES + 1), StandardCharsets.UTF_8));
        } catch (IOException | IllegalArgumentException e) {
            LOG.error("Bundled dashboard fallback unusable; showing an empty dashboard.", e);
            return DashboardConfig.empty();
        }
    }

    /** Fetches {@code url} in the background, validates it, caches it and swaps it in. A failure keeps the current data. */
    public CompletableFuture<Boolean> refresh(String url) {
        String checked = DashboardParser.httpsOrEmpty(url);
        if (checked.isEmpty() || refreshing) return CompletableFuture.completedFuture(false);
        refreshing = true;
        HttpRequest request = HttpRequest.newBuilder(URI.create(checked)).timeout(TIMEOUT).header("Accept", "application/json")
            .header("User-Agent", "CirrusClient-Fabric").GET().build();
        HttpClient client = HttpClient.newBuilder().connectTimeout(TIMEOUT).followRedirects(HttpClient.Redirect.NORMAL).build();
        return client.sendAsync(request, HttpResponse.BodyHandlers.ofInputStream()).thenApply(response -> {
            try (InputStream in = response.body()) {
                if (response.statusCode() != 200) throw new IOException("HTTP " + response.statusCode());
                byte[] bytes = in.readNBytes(DashboardParser.MAX_BYTES + 1);
                String body = new String(bytes, StandardCharsets.UTF_8);
                DashboardConfig parsed = DashboardParser.parse(body);
                store(body);
                current.set(parsed);
                return true;
            } catch (IOException | IllegalArgumentException e) {
                LOG.warn("Dashboard refresh failed, keeping current data: {}", e.getMessage());
                return false;
            }
        }).exceptionally(e -> { LOG.warn("Dashboard refresh failed, keeping current data: {}", e.toString()); return false; })
          .whenComplete((ok, e) -> refreshing = false);
    }

    private void store(String body) throws IOException {
        Files.createDirectories(cacheFile.getParent());
        Path temp = cacheFile.resolveSibling("dashboard-cache.json.tmp");
        Files.writeString(temp, body, StandardCharsets.UTF_8);
        Files.move(temp, cacheFile, StandardCopyOption.REPLACE_EXISTING);
    }
}
