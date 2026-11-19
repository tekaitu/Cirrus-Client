package dev.cirrus.client.dashboard;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Strict parser for dashboard JSON. Remote data is untrusted: unknown fields are ignored, every string is length
 * limited, URLs must be https, server addresses must look like host[:port], counts are capped, and one bad entry is
 * dropped without losing the rest of the document.
 */
public final class DashboardParser {
    public static final int MAX_BYTES = 128 * 1024;
    public static final int MAX_PARTNERS = 12, MAX_BANNERS = 6, MAX_PROMOS = 4;
    private static final Pattern HOST = Pattern.compile("^(?=.{1,253}(?::\\d{1,5})?$)[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*(:\\d{1,5})?$");
    private static final Pattern ID = Pattern.compile("^[a-z0-9][a-z0-9_-]{0,39}$");
    private static final Pattern COLOR = Pattern.compile("^#?([0-9a-fA-F]{6})$");

    private DashboardParser() { }

    /** @throws IllegalArgumentException when the document is not usable at all (not JSON, wrong schema, too large). */
    public static DashboardConfig parse(String json) {
        if (json == null || json.length() > MAX_BYTES) throw new IllegalArgumentException("dashboard document missing or too large");
        JsonObject root;
        try {
            JsonElement parsed = JsonParser.parseString(json);
            if (!parsed.isJsonObject()) throw new IllegalArgumentException("dashboard root must be an object");
            root = parsed.getAsJsonObject();
        } catch (JsonParseException e) {
            throw new IllegalArgumentException("dashboard is not valid JSON", e);
        }
        int schema = intOf(root, "schema", -1);
        if (schema != DashboardConfig.SCHEMA) throw new IllegalArgumentException("unsupported dashboard schema " + schema);

        DashboardConfig.Store store = parseStore(root.has("store") && root.get("store").isJsonObject() ? root.getAsJsonObject("store") : new JsonObject());
        List<DashboardConfig.Partner> partners = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonObject o : objects(root, "partners")) {
            DashboardConfig.Partner p = parsePartner(o);
            if (p != null && seen.add(p.id()) && partners.size() < MAX_PARTNERS) partners.add(p);
        }
        partners.sort(Comparator.comparingInt(DashboardConfig.Partner::order));

        List<DashboardConfig.Banner> banners = new ArrayList<>();
        seen.clear();
        for (JsonObject o : objects(root, "banners")) {
            DashboardConfig.Banner b = parseBanner(o);
            if (b != null && seen.add(b.id()) && banners.size() < MAX_BANNERS) banners.add(b);
        }
        banners.sort(Comparator.comparingInt(DashboardConfig.Banner::order));

        List<DashboardConfig.StorePromo> promos = new ArrayList<>();
        seen.clear();
        for (JsonObject o : objects(root, "storePromos")) {
            DashboardConfig.StorePromo s = parsePromo(o);
            if (s != null && seen.add(s.id()) && promos.size() < MAX_PROMOS) promos.add(s);
        }
        promos.sort(Comparator.comparingInt(DashboardConfig.StorePromo::order));
        return new DashboardConfig(schema, longOf(root, "revision", 0), store, List.copyOf(partners), List.copyOf(banners), List.copyOf(promos));
    }

    private static DashboardConfig.Store parseStore(JsonObject o) {
        String url = httpsOrEmpty(str(o, "url", 300));
        String label = clean(str(o, "label", 24), "STORE");
        return new DashboardConfig.Store(label, url, boolOf(o, "enabled", true) && !url.isEmpty());
    }

    private static DashboardConfig.Partner parsePartner(JsonObject o) {
        String id = str(o, "id", 40).toLowerCase(Locale.ROOT);
        String name = clean(str(o, "name", 32), "");
        String address = str(o, "address", 260).trim();
        if (!ID.matcher(id).matches() || name.isEmpty() || !validAddress(address)) return null;
        return new DashboardConfig.Partner(id, name, address, clean(str(o, "tagline", 80), ""), color(o, "color", 0x286FE8),
            httpsOrEmpty(str(o, "iconUrl", 300)), boolOf(o, "featured", true), intOf(o, "order", 100));
    }

    private static DashboardConfig.Banner parseBanner(JsonObject o) {
        String id = str(o, "id", 40).toLowerCase(Locale.ROOT);
        String title = clean(str(o, "title", 40), "");
        if (!ID.matcher(id).matches() || title.isEmpty()) return null;
        return new DashboardConfig.Banner(id, title, clean(str(o, "subtitle", 90), ""), clean(str(o, "cta", 24), ""),
            httpsOrEmpty(str(o, "url", 300)), color(o, "colorA", 0x0B1E4A), color(o, "colorB", 0x1B8FFF),
            httpsOrEmpty(str(o, "imageUrl", 300)), intOf(o, "order", 100));
    }

    private static DashboardConfig.StorePromo parsePromo(JsonObject o) {
        String id = str(o, "id", 40).toLowerCase(Locale.ROOT);
        String text = clean(str(o, "text", 80), "");
        if (!ID.matcher(id).matches() || text.isEmpty()) return null;
        return new DashboardConfig.StorePromo(id, text, httpsOrEmpty(str(o, "url", 300)), intOf(o, "order", 100));
    }

    // ---- validation helpers (public so the multiplayer screen can reuse them) ---------------------------------------

    public static boolean validAddress(String address) {
        if (address == null || !HOST.matcher(address).matches()) return false;
        int colon = address.lastIndexOf(':');
        if (colon < 0) return true;
        int port = Integer.parseInt(address.substring(colon + 1));
        return port >= 1 && port <= 65535;
    }

    /** Returns the URL when it is a well-formed https URL with a host, otherwise an empty string. */
    public static String httpsOrEmpty(String value) {
        if (value == null || value.isBlank()) return "";
        try {
            URI uri = new URI(value.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) return "";
            return uri.toString();
        } catch (Exception e) { return ""; }
    }

    private static List<JsonObject> objects(JsonObject root, String key) {
        List<JsonObject> out = new ArrayList<>();
        if (!root.has(key) || !root.get(key).isJsonArray()) return out;
        JsonArray array = root.getAsJsonArray(key);
        for (int i = 0; i < array.size() && i < 64; i++) if (array.get(i).isJsonObject()) out.add(array.get(i).getAsJsonObject());
        return out;
    }

    private static String str(JsonObject o, String key, int max) {
        if (!o.has(key) || !o.get(key).isJsonPrimitive() || !o.get(key).getAsJsonPrimitive().isString()) return "";
        String s = o.get(key).getAsString();
        return s.length() > max ? s.substring(0, max) : s;
    }

    /** Strips control characters and Minecraft formatting sections so remote text cannot inject styling. */
    private static String clean(String value, String fallback) {
        StringBuilder sb = new StringBuilder();
        for (char c : value.toCharArray()) if (c >= 32 && c != 127 && c != '§') sb.append(c);
        String s = sb.toString().trim();
        return s.isEmpty() ? fallback : s;
    }

    private static int color(JsonObject o, String key, int fallback) {
        var m = COLOR.matcher(str(o, key, 7));
        return m.matches() ? Integer.parseInt(m.group(1), 16) : fallback;
    }

    private static int intOf(JsonObject o, String key, int fallback) {
        try { return o.has(key) ? o.get(key).getAsInt() : fallback; } catch (RuntimeException e) { return fallback; }
    }
    private static long longOf(JsonObject o, String key, long fallback) {
        try { return o.has(key) ? o.get(key).getAsLong() : fallback; } catch (RuntimeException e) { return fallback; }
    }
    private static boolean boolOf(JsonObject o, String key, boolean fallback) {
        try { return o.has(key) ? o.get(key).getAsBoolean() : fallback; } catch (RuntimeException e) { return fallback; }
    }
}
