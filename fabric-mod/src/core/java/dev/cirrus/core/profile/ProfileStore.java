package dev.cirrus.core.profile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;

/** Profiles saved as small text files in one folder (config/cirrus-client/profiles). */
public final class ProfileStore {
    public static final int MAX_PROFILES = 50;
    private final Path dir;
    public ProfileStore(Path dir) { this.dir = dir; }

    private Path fileFor(String name) { return dir.resolve(ProfileCodec.cleanName(name).toLowerCase(Locale.ROOT).replace(' ', '-') + ".profile"); }

    /** Profile names, sorted, as they were typed. */
    public List<String> names() {
        List<String> out = new ArrayList<>();
        if (!Files.isDirectory(dir)) return out;
        try (Stream<Path> files = Files.list(dir)) {
            files.filter(f -> f.getFileName().toString().endsWith(".profile")).forEach(f -> {
                try {
                    String base = f.getFileName().toString().replace(".profile", "");
                    out.add(ProfileCodec.fromText(read(f), base).name());
                } catch (IOException ignored) { }
            });
        } catch (IOException ignored) { }
        out.sort(String.CASE_INSENSITIVE_ORDER);
        return out;
    }

    private static String read(Path file) throws IOException { return new String(Files.readAllBytes(file), StandardCharsets.UTF_8); }

    public boolean exists(String name) { return Files.isRegularFile(fileFor(name)); }

    public Map<String, String> load(String name) throws IOException {
        return ProfileCodec.fromText(read(fileFor(name)), name).values();
    }

    public void save(String name, Map<String, String> values) throws IOException {
        Files.createDirectories(dir);
        Path target = fileFor(name), temp = target.resolveSibling(target.getFileName() + ".tmp");
        Files.write(temp, ProfileCodec.toText(name, values).getBytes(StandardCharsets.UTF_8));
        try { Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
        catch (AtomicMoveNotSupportedException e) { Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING); }
    }

    public void delete(String name) throws IOException { Files.deleteIfExists(fileFor(name)); }

    /** "Name", or "Name 2", "Name 3"... when taken. */
    public String uniqueName(String wanted) {
        String base = ProfileCodec.cleanName(wanted);
        if (base.isEmpty()) base = "Profile";
        String candidate = base;
        for (int i = 2; exists(candidate); i++) candidate = ProfileCodec.cleanName(base.length() > 20 ? base.substring(0, 20) : base) + " " + i;
        return candidate;
    }
}
