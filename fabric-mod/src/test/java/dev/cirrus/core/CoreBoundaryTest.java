package dev.cirrus.core;

import org.junit.jupiter.api.Test;

import javax.tools.JavaCompiler;
import javax.tools.ToolProvider;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The architecture boundary. Cirrus Core (src/core/java, package dev.cirrus.core) must not know Minecraft, a loader, a graphics or
 * windowing library, a logging library or the 1.21.11 client code, and must stay buildable at the Java 8 level so it can later be
 * shared with Minecraft 1.8.9. These checks fail the build if someone breaks that.
 */
class CoreBoundaryTest {
    private static final List<String> FORBIDDEN = List.of(
        "net.minecraft", "com.mojang", "net.fabricmc", "net.minecraftforge", "net.neoforged", "org.lwjgl", "org.slf4j",
        "org.apache.logging", "com.google", "dev.cirrus.client");

    private static Path coreRoot() {
        Path p = Paths.get("src/core/java").toAbsolutePath();
        for (int i = 0; i < 4 && !Files.isDirectory(p); i++) p = Paths.get("fabric-mod/src/core/java").toAbsolutePath();
        assertTrue(Files.isDirectory(p), "src/core/java not found from " + Paths.get("").toAbsolutePath());
        return p;
    }

    private static List<Path> sources() throws IOException {
        try (Stream<Path> s = Files.walk(coreRoot())) {
            return s.filter(f -> f.toString().endsWith(".java")).sorted().collect(Collectors.toList());
        }
    }

    @Test void coreHasSources() throws IOException {
        assertTrue(sources().size() >= 20, "expected the Core sources to exist, found " + sources().size());
    }

    @Test void everyCoreFileLivesInTheCorePackage() throws IOException {
        Path root = coreRoot();
        Pattern pkg = Pattern.compile("^package\\s+([\\w.]+);", Pattern.MULTILINE);
        for (Path f : sources()) {
            String text = new String(Files.readAllBytes(f), StandardCharsets.UTF_8);
            Matcher m = pkg.matcher(text);
            assertTrue(m.find(), f + " has no package");
            String expected = root.relativize(f.getParent()).toString().replace('/', '.').replace('\\', '.');
            assertEquals(expected, m.group(1), f + " is in the wrong package");
            assertTrue(m.group(1).startsWith("dev.cirrus.core"), f + " must be in dev.cirrus.core");
        }
    }

    @Test void coreNeverReferencesMinecraftLoadersGraphicsOrTheClientCode() throws IOException {
        List<String> violations = new ArrayList<>();
        for (Path f : sources()) {
            for (String line : Files.readAllLines(f, StandardCharsets.UTF_8)) {
                String code = line.trim();
                if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) continue;   // comments may mention names
                for (String bad : FORBIDDEN) if (code.contains(bad)) violations.add(f.getFileName() + ": " + code);
            }
        }
        assertTrue(violations.isEmpty(), "Core must stay free of Minecraft and loader code:\n" + String.join("\n", violations));
    }

    /** Compiles all of Core alone (empty classpath) at Java 8 level: proves both independence and Java 8 compatibility. */
    @Test void coreCompilesAloneAtJava8() throws IOException {
        JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
        assertNotNull(javac, "tests must run on a JDK");
        Path out = Files.createTempDirectory("core-java8");
        Path emptyClasspath = Files.createTempDirectory("empty-classpath");
        List<String> args = new ArrayList<>(List.of("--release", "8", "-proc:none", "-Xlint:-options", "-implicit:none",
            "-classpath", emptyClasspath.toString(), "-d", out.toString()));
        for (Path f : sources()) args.add(f.toString());
        ByteArrayOutputStream log = new ByteArrayOutputStream();
        int code = javac.run(null, log, log, args.toArray(new String[0]));
        assertEquals(0, code, "Core does not compile alone at Java 8:\n" + new String(log.toByteArray(), StandardCharsets.UTF_8));
    }
}
