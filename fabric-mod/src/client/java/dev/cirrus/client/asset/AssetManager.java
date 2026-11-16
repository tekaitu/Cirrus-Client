package dev.cirrus.client.asset;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.Minecraft;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

/** Instance-local, content-verified visual assets. Downloads never run on the render thread. */
public final class AssetManager {
    private static final Logger LOG = LoggerFactory.getLogger("Cirrus Assets");
    private static final String MANIFEST_URL = "https://raw.githubusercontent.com/tekaitu/Cirrus-Client/codex/cirrus-fabric-foundation/assets/cirrus-client/v1/manifest.json";
    private static final String TRUSTED_PREFIX = "https://raw.githubusercontent.com/tekaitu/Cirrus-Client/codex/cirrus-fabric-foundation/assets/cirrus-client/v1/";
    private static final String FALLBACK_MANIFEST = "/assets/cirrus_fabric/asset-manifest.json";
    private static final int MAX_MANIFEST_BYTES = 256 * 1024;
    private static final int MAX_ASSET_BYTES = 16 * 1024 * 1024;
    private static final Set<String> CATEGORIES = Set.of("textures", "icons", "backgrounds", "fonts", "animations", "illustrations");
    private static final Set<String> FORBIDDEN_EXTENSIONS = Set.of(".jar", ".class", ".exe", ".dll", ".so", ".bat", ".cmd", ".ps1", ".sh", ".zip", ".7z", ".rar", ".js", ".py");

    private static final AtomicReference<AssetManager> INSTANCE = new AtomicReference<>();
    private final Path root;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "Cirrus asset downloads");
        thread.setDaemon(true);
        return thread;
    });
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8))
        .followRedirects(HttpClient.Redirect.NEVER).build();
    private volatile Snapshot snapshot = new Snapshot(State.STARTING, "Preparing", 0, 0, "Checking local assets");
    private volatile CompletableFuture<Void> initialization;

    private AssetManager(Path gameDirectory) {
        this.root = gameDirectory.toAbsolutePath().normalize().resolve("cirrus").resolve("assets");
    }

    public static AssetManager get(Path gameDirectory) {
        Path normalized = gameDirectory.toAbsolutePath().normalize();
        AssetManager current = INSTANCE.get();
        if (current != null && current.root.equals(normalized.resolve("cirrus").resolve("assets"))) return current;
        AssetManager created = new AssetManager(normalized);
        if (INSTANCE.compareAndSet(current, created)) return created;
        return get(normalized);
    }

    public Path root() { return root; }
    public Snapshot snapshot() { return snapshot; }
    public CompletableFuture<Void> initialize() {
        synchronized (this) {
            if (initialization == null) initialization = CompletableFuture.runAsync(this::initializeOnWorker, executor);
            return initialization;
        }
    }

    /** Returns a checked, installed file or null if the optional resource is unavailable. */
    public Path installed(String id) {
        Snapshot state = snapshot;
        if (state.assets == null) return null;
        return state.assets.stream().filter(asset -> asset.id.equals(id)).findFirst()
            .map(asset -> safeResolve(asset.path)).filter(path -> path != null && Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS))
            .orElse(null);
    }

    private void initializeOnWorker() {
        try {
            createCategoryDirectories();
            List<Asset> manifest;
            byte[] manifestBytes;
            try {
                manifestBytes = fetch(MANIFEST_URL, MAX_MANIFEST_BYTES);
                manifest = readManifest(manifestBytes);
            } catch (Exception networkError) {
                LOG.info("Cirrus asset manifest unavailable; using bundled fallback manifest.");
                manifestBytes = bundledManifestBytes();
                manifest = manifestBytes == null ? List.of() : readManifest(manifestBytes);
                if (manifest.isEmpty()) throw networkError;
            }
            installAtomically(root.resolve("manifest.json"), manifestBytes);
            int required = (int) manifest.stream().filter(Asset::required).count();
            snapshot = new Snapshot(State.DOWNLOADING, "Preparing", 0, required, "Verifying local assets", manifest);
            int finished = 0;
            for (Asset asset : manifest) {
                snapshot = new Snapshot(State.DOWNLOADING, category(asset.path), finished, required,
                    "Checking " + asset.id, manifest);
                Path destination = safeResolve(asset.path);
                if (destination == null) throw new IOException("Rejected unsafe asset path: " + asset.path);
                if (validInstalled(destination, asset)) {
                    if (asset.required) finished++;
                    continue;
                }
                try {
                    byte[] bytes = fetch(asset.url, (int) Math.min(MAX_ASSET_BYTES, asset.size + 1));
                    if (bytes.length != asset.size || !sha256(bytes).equals(asset.sha256)) {
                        throw new IOException("Size or SHA-256 check failed for " + asset.id);
                    }
                    installAtomically(destination, bytes);
                } catch (Exception downloadError) {
                    Path fallback = bundledFallback(asset);
                    if (asset.required && fallback == null) LOG.warn("Required asset {} unavailable; bundled UI fallback will be used.", asset.id);
                    LOG.info("Asset {} was not updated; retaining any previously verified copy.", asset.id);
                }
                if (asset.required) finished++;
                snapshot = new Snapshot(State.DOWNLOADING, category(asset.path), finished, required,
                    "Processed " + asset.id, manifest);
            }
            snapshot = new Snapshot(State.READY, "Complete", required, required, "Cirrus is ready", manifest);
        } catch (Exception e) {
            LOG.warn("Asset initialization failed safely; Cirrus will use bundled resources.", e);
            snapshot = new Snapshot(State.OFFLINE, "Offline", 0, 0, "Using built-in resources", List.of());
        }
    }

    private void createCategoryDirectories() throws IOException {
        Files.createDirectories(root);
        for (String category : CATEGORIES) Files.createDirectories(root.resolve(category));
    }

    private byte[] fetch(String value, int maxBytes) throws Exception {
        URI uri = URI.create(value);
        if (!isTrustedUri(uri)) throw new IOException("Untrusted asset URL");
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(25))
            .header("User-Agent", "Cirrus-Client-Fabric/1").GET().build();
        HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() != 200) {
            response.body().close();
            throw new IOException("Asset server returned HTTP " + response.statusCode());
        }
        try (InputStream in = response.body()) {
            byte[] data = in.readNBytes(maxBytes + 1);
            if (data.length > maxBytes) throw new IOException("Asset exceeds configured size limit");
            return data;
        }
    }

    private List<Asset> readManifest(byte[] bytes) throws IOException {
        try {
            JsonObject json = JsonParser.parseString(new String(bytes, java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
            int version = json.get("manifestVersion").getAsInt();
            if (version != 1) throw new IOException("Unsupported asset manifest version");
            JsonArray entries = json.getAsJsonArray("assets");
            if (entries == null || entries.size() > 256) throw new IOException("Invalid asset list");
            var result = new java.util.ArrayList<Asset>();
            var ids = new java.util.HashSet<String>();
            for (JsonElement element : entries) {
                JsonObject item = element.getAsJsonObject();
                Asset asset = new Asset(item.get("id").getAsString(), item.get("path").getAsString(),
                    item.get("version").getAsString(), item.get("url").getAsString(), item.get("sha256").getAsString().toLowerCase(),
                    item.get("size").getAsLong(), item.get("required").getAsBoolean());
                validateAsset(asset);
                if (!ids.add(asset.id)) throw new IOException("Duplicate asset id");
                result.add(asset);
            }
            return List.copyOf(result);
        } catch (RuntimeException e) {
            throw new IOException("Invalid asset manifest", e);
        }
    }

    private byte[] bundledManifestBytes() throws IOException {
        try (InputStream in = AssetManager.class.getResourceAsStream(FALLBACK_MANIFEST)) {
            if (in == null) return null;
            byte[] bytes = in.readNBytes(MAX_MANIFEST_BYTES + 1);
            if (bytes.length > MAX_MANIFEST_BYTES) throw new IOException("Bundled manifest exceeds size limit");
            return bytes;
        }
    }

    private Path bundledFallback(Asset asset) {
        String classpath = "/assets/cirrus_fabric/external/" + asset.path;
        try (InputStream in = AssetManager.class.getResourceAsStream(classpath)) {
            if (in == null) return null;
            byte[] bytes = in.readNBytes(MAX_ASSET_BYTES + 1);
            if (bytes.length != asset.size || !sha256(bytes).equals(asset.sha256)) return null;
            Path destination = safeResolve(asset.path);
            if (destination == null) return null;
            installAtomically(destination, bytes);
            return destination;
        } catch (IOException e) {
            return null;
        }
    }

    private boolean validInstalled(Path path, Asset asset) {
        try {
            if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS) || Files.size(path) != asset.size) return false;
            try (InputStream input = Files.newInputStream(path)) { return sha256(input.readAllBytes()).equals(asset.sha256); }
        } catch (IOException e) { return false; }
    }

    private void installAtomically(Path destination, byte[] bytes) throws IOException {
        Files.createDirectories(destination.getParent());
        Path part = destination.resolveSibling(destination.getFileName() + ".part");
        Files.write(part, bytes);
        try { Files.move(part, destination, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
        catch (AtomicMoveNotSupportedException e) { Files.move(part, destination, StandardCopyOption.REPLACE_EXISTING); }
        finally { Files.deleteIfExists(part); }
    }

    private Path safeResolve(String relative) {
        try {
            validateRelativePath(relative);
            Path resolved = root.resolve(relative).normalize();
            if (!resolved.startsWith(root)) return null;
            Path current = root;
            for (Path component : root.relativize(resolved)) {
                current = current.resolve(component);
                if (Files.isSymbolicLink(current)) return null;
            }
            return resolved;
        } catch (IOException | IllegalArgumentException e) { return null; }
    }

    private static void validateAsset(Asset asset) throws IOException {
        validateRelativePath(asset.path);
        if (asset.id.isBlank() || !asset.id.matches("[a-z0-9][a-z0-9._-]{0,63}")) throw new IOException("Invalid asset id");
        if (asset.version.isBlank() || asset.version.length() > 32) throw new IOException("Invalid asset version");
        if (asset.sha256 == null || !asset.sha256.matches("[a-fA-F0-9]{64}")) throw new IOException("Invalid asset checksum");
        if (asset.size < 1 || asset.size > MAX_ASSET_BYTES) throw new IOException("Invalid asset size");
        if (!isTrustedUri(URI.create(asset.url))) throw new IOException("Untrusted asset URL");
        if (!asset.url.equals(TRUSTED_PREFIX + asset.path)) throw new IOException("URL does not match manifest path");
    }

    public static void validateRelativePath(String path) throws IOException {
        if (path == null || path.isBlank() || path.startsWith("/") || path.contains("\\") || path.contains(":") || path.contains("..")) {
            throw new IOException("Unsafe relative asset path");
        }
        String[] parts = path.split("/", -1);
        if (parts.length < 2 || !CATEGORIES.contains(parts[0])) throw new IOException("Unknown asset category");
        for (String part : parts) if (part.isBlank() || part.equals(".") || part.equals("..")) throw new IOException("Unsafe path component");
        String lower = path.toLowerCase();
        for (String extension : FORBIDDEN_EXTENSIONS) if (lower.endsWith(extension)) throw new IOException("Executable or archive assets are forbidden");
        if (!(lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".ttf") || lower.endsWith(".otf") || lower.endsWith(".json") || lower.endsWith(".mcmeta") || lower.endsWith(".gif"))) {
            throw new IOException("Unsupported asset file type");
        }
    }

    private static boolean isTrustedUri(URI uri) {
        return "https".equalsIgnoreCase(uri.getScheme()) && "raw.githubusercontent.com".equalsIgnoreCase(uri.getHost())
            && uri.getUserInfo() == null && uri.getPort() == -1 && uri.getPath() != null
            && uri.getPath().startsWith("/tekaitu/Cirrus-Client/codex/cirrus-fabric-foundation/assets/cirrus-client/v1/");
    }
    private static String category(String path) { int slash = path.indexOf('/'); return slash > 0 ? path.substring(0, slash) : "Assets"; }
    private static String sha256(byte[] data) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data)); }
        catch (Exception impossible) { throw new IllegalStateException("SHA-256 unavailable", impossible); }
    }
    private record Asset(String id, String path, String version, String url, String sha256, long size, boolean required) { }
    public enum State { STARTING, DOWNLOADING, READY, OFFLINE }
    public record Snapshot(State state, String category, int downloadedRequired, int totalRequired, String message, List<Asset> assets) {
        public Snapshot(State state, String category, int downloadedRequired, int totalRequired, String message) {
            this(state, category, downloadedRequired, totalRequired, message, List.of());
        }
        public Snapshot { assets = List.copyOf(assets); }
        public boolean finished() { return state == State.READY || state == State.OFFLINE; }
    }
}

