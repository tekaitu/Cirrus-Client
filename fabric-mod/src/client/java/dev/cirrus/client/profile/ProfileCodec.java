package dev.cirrus.client.profile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * Text and share-code format of a profile. A profile is a name plus module settings (enabled switches, per-module options and
 * HUD positions). Share codes are untrusted input, so decoding only accepts those key families, with size limits.
 */
public final class ProfileCodec {
    public static final String PREFIX = "CIRRUS1:";
    private static final int MAX_CODE = 96_000, MAX_TEXT = 64_000, MAX_ENTRIES = 1_000, MAX_VALUE = 200, MAX_KEY = 80;
    private ProfileCodec() { }

    public record Profile(String name, Map<String, String> values) { }

    /** Keys a profile may carry. UI preferences, account data and everything else stay out. */
    public static boolean allowedKey(String key) {
        if (key == null || key.length() > MAX_KEY || !key.matches("[A-Za-z0-9._-]+")) return false;
        return key.startsWith("enabled.") || key.startsWith("mod.") || key.startsWith("hud.");
    }

    public static String cleanName(String raw) {
        String s = raw == null ? "" : raw.replaceAll("[^A-Za-z0-9 _-]", "").trim().replaceAll("\\s+", " ");
        if (s.length() > 24) s = s.substring(0, 24).trim();
        return s;
    }

    /** Plain text form: a name line followed by key=value lines. Also used for the files on disk. */
    public static String toText(String name, Map<String, String> values) {
        StringBuilder sb = new StringBuilder("name=").append(cleanName(name)).append('\n');
        for (var e : new TreeMap<>(values).entrySet()) {
            if (!allowedKey(e.getKey())) continue;
            String v = e.getValue() == null ? "" : e.getValue().replace('\n', ' ').replace('\r', ' ');
            if (v.length() > MAX_VALUE) continue;
            sb.append(e.getKey()).append('=').append(v).append('\n');
        }
        return sb.toString();
    }

    /** Parses the text form, dropping anything that is not an allowed key. Never throws on odd lines. */
    public static Profile fromText(String text, String fallbackName) {
        Map<String, String> values = new LinkedHashMap<>();
        String name = "";
        int lines = 0;
        for (String line : text.split("\n")) {
            if (++lines > MAX_ENTRIES + 1) break;
            int eq = line.indexOf('=');
            if (eq <= 0) continue;
            String k = line.substring(0, eq).trim(), v = line.substring(eq + 1).replace("\r", "");
            if (k.equals("name")) { name = cleanName(v); continue; }
            if (allowedKey(k) && v.length() <= MAX_VALUE) values.put(k, v);
        }
        if (name.isEmpty()) name = cleanName(fallbackName);
        if (name.isEmpty()) name = "Imported";
        return new Profile(name, values);
    }

    public static String encode(String name, Map<String, String> values) {
        byte[] raw = toText(name, values).getBytes(StandardCharsets.UTF_8);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (GZIPOutputStream gz = new GZIPOutputStream(bytes)) { gz.write(raw); }
        catch (IOException e) { throw new IllegalStateException(e); }
        return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes.toByteArray());
    }

    /** @throws IllegalArgumentException with a message that is safe to show the player */
    public static Profile decode(String code) {
        if (code == null) throw new IllegalArgumentException("Nothing to import.");
        String c = code.trim();
        if (!c.startsWith(PREFIX)) throw new IllegalArgumentException("That is not a Cirrus profile code.");
        if (c.length() > MAX_CODE) throw new IllegalArgumentException("That profile code is too large.");
        byte[] packed;
        try { packed = Base64.getUrlDecoder().decode(c.substring(PREFIX.length())); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("That profile code is damaged."); }
        try (GZIPInputStream gz = new GZIPInputStream(new ByteArrayInputStream(packed))) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = gz.read(buf)) > 0) {
                out.write(buf, 0, n);
                if (out.size() > MAX_TEXT) throw new IllegalArgumentException("That profile code is too large.");
            }
            Profile p = fromText(out.toString(StandardCharsets.UTF_8), "Imported");
            if (p.values().isEmpty()) throw new IllegalArgumentException("That profile has no settings.");
            return p;
        } catch (IOException e) { throw new IllegalArgumentException("That profile code is damaged."); }
    }
}
