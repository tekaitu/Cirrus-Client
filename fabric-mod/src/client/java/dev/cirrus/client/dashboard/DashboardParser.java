package dev.cirrus.client.dashboard;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;

import java.net.URI;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.function.Function;
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
    public static final int MAX_PARTNERS = 12, MAX_BANNERS = 6, MAX_PROMOS = 4, MAX_GIVEAWAYS = 4, MAX_NEWS = 8, MAX_FEATURED = 6, MAX_SOCIALS = 8, MAX_UPDATES = 4;
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

        DashboardConfig.Store store = parseStore(object(root, "store"));
        List<DashboardConfig.Partner> partners = list(root, "partners", MAX_PARTNERS, DashboardParser::parsePartner, DashboardConfig.Partner::id, Comparator.comparingInt(DashboardConfig.Partner::order));
        DashboardConfig.Advertised advertised = parseAdvertised(object(root, "advertised"), partners);
        return new DashboardConfig(schema, longOf(root, "revision", 0), store, partners, advertised,
            list(root, "banners", MAX_BANNERS, DashboardParser::parseBanner, DashboardConfig.Banner::id, Comparator.comparingInt(DashboardConfig.Banner::order)),
            parseDiscord(object(root, "discord")),
            list(root, "giveaways", MAX_GIVEAWAYS, DashboardParser::parseGiveaway, DashboardConfig.Giveaway::id, Comparator.comparingInt(DashboardConfig.Giveaway::order)),
            list(root, "news", MAX_NEWS, DashboardParser::parseNews, DashboardConfig.News::id, Comparator.comparingInt(DashboardConfig.News::order)),
            list(root, "storePromos", MAX_PROMOS, DashboardParser::parsePromo, DashboardConfig.StorePromo::id, Comparator.comparingInt(DashboardConfig.StorePromo::order)),
            list(root, "featured", MAX_FEATURED, DashboardParser::parseFeatured, DashboardConfig.Featured::id, Comparator.comparingInt(DashboardConfig.Featured::order)),
            list(root, "socials", MAX_SOCIALS, DashboardParser::parseSocial, DashboardConfig.Social::id, Comparator.comparing(DashboardConfig.Social::id)),
            list(root, "updates", MAX_UPDATES, DashboardParser::parseUpdate, DashboardConfig.Update::id, Comparator.comparing(DashboardConfig.Update::date, Comparator.nullsLast(Comparator.reverseOrder()))));
    }

    /** Parses an array of objects: bad entries are dropped, duplicate ids dropped, the result capped and sorted. */
    private static <T> List<T> list(JsonObject root, String key, int max, Function<JsonObject, T> parser, Function<T, String> id, Comparator<T> order) {
        List<T> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonObject o : objects(root, key)) {
            T item = parser.apply(o);
            if (item != null && seen.add(id.apply(item)) && out.size() < max) out.add(item);
        }
        out.sort(order);
        return List.copyOf(out);
    }

    private static DashboardConfig.Store parseStore(JsonObject o) {
        String url = httpsOrEmpty(str(o, "url", 300));
        return new DashboardConfig.Store(clean(str(o, "label", 24), "STORE"), url, boolOf(o, "enabled", true) && !url.isEmpty());
    }

    private static DashboardConfig.Partner parsePartner(JsonObject o) {
        String id = id(o);
        String name = clean(str(o, "name", 32), "");
        String address = str(o, "address", 260).trim();
        if (id.isEmpty() || name.isEmpty() || !validAddress(address)) return null;
        return new DashboardConfig.Partner(id, name, address, clean(str(o, "tagline", 80), ""), color(o, "color", 0x286FE8), httpsOrEmpty(str(o, "iconUrl", 300)), intOf(o, "order", 100));
    }

    /** The advertised server only counts when it names a partner that survived validation. */
    private static DashboardConfig.Advertised parseAdvertised(JsonObject o, List<DashboardConfig.Partner> partners) {
        String partnerId = str(o, "partnerId", 40).toLowerCase(Locale.ROOT);
        if (partnerId.isEmpty() || partners.stream().noneMatch(p -> p.id().equals(partnerId))) return null;
        return new DashboardConfig.Advertised(partnerId, boolOf(o, "startButton", true), clean(str(o, "label", 12), "START"));
    }

    private static DashboardConfig.Banner parseBanner(JsonObject o) {
        String id = id(o), title = clean(str(o, "title", 40), "");
        if (id.isEmpty() || title.isEmpty()) return null;
        return new DashboardConfig.Banner(id, title, clean(str(o, "subtitle", 90), ""), clean(str(o, "cta", 24), ""), httpsOrEmpty(str(o, "url", 300)),
            color(o, "colorA", 0x0B1E4A), color(o, "colorB", 0x1B8FFF), httpsOrEmpty(str(o, "imageUrl", 300)), instant(o, "startsAt"), instant(o, "endsAt"), intOf(o, "order", 100));
    }

    private static DashboardConfig.Discord parseDiscord(JsonObject o) {
        return new DashboardConfig.Discord(boolOf(o, "enabled", false), clean(str(o, "title", 40), ""), clean(str(o, "subtitle", 90), ""), clean(str(o, "badge", 20), ""),
            clean(str(o, "cta", 24), ""), httpsOrEmpty(str(o, "url", 300)), httpsOrEmpty(str(o, "imageUrl", 300)), clean(str(o, "rewardText", 120), ""));
    }

    private static DashboardConfig.Giveaway parseGiveaway(JsonObject o) {
        String id = id(o), title = clean(str(o, "title", 60), "");
        if (id.isEmpty() || title.isEmpty()) return null;
        return new DashboardConfig.Giveaway(id, title, clean(str(o, "description", 160), ""), httpsOrEmpty(str(o, "imageUrl", 300)), httpsOrEmpty(str(o, "url", 300)),
            instant(o, "startsAt"), instant(o, "endsAt"), intOf(o, "order", 100));
    }

    private static DashboardConfig.News parseNews(JsonObject o) {
        String id = id(o), title = clean(str(o, "title", 80), "");
        if (id.isEmpty() || title.isEmpty()) return null;
        return new DashboardConfig.News(id, title, clean(str(o, "body", 300), ""), httpsOrEmpty(str(o, "imageUrl", 300)), httpsOrEmpty(str(o, "url", 300)), instant(o, "date"), intOf(o, "order", 100));
    }

    private static DashboardConfig.StorePromo parsePromo(JsonObject o) {
        String id = id(o), text = clean(str(o, "text", 80), "");
        if (id.isEmpty() || text.isEmpty()) return null;
        return new DashboardConfig.StorePromo(id, text, httpsOrEmpty(str(o, "url", 300)), httpsOrEmpty(str(o, "imageUrl", 300)), instant(o, "startsAt"), instant(o, "endsAt"), intOf(o, "order", 100));
    }

    private static DashboardConfig.Featured parseFeatured(JsonObject o) {
        String id = id(o), title = clean(str(o, "title", 60), "");
        if (id.isEmpty() || title.isEmpty()) return null;
        return new DashboardConfig.Featured(id, title, clean(str(o, "subtitle", 90), ""), httpsOrEmpty(str(o, "imageUrl", 300)), httpsOrEmpty(str(o, "url", 300)), intOf(o, "order", 100));
    }

    private static final Set<String> SOCIAL_KINDS = Set.of("discord", "youtube", "x", "tiktok", "instagram", "twitch", "github", "website");

    private static DashboardConfig.Social parseSocial(JsonObject o) {
        String id = id(o), kind = str(o, "kind", 16).toLowerCase(Locale.ROOT), url = httpsOrEmpty(str(o, "url", 300));
        if (id.isEmpty() || !SOCIAL_KINDS.contains(kind) || url.isEmpty()) return null;
        return new DashboardConfig.Social(id, kind, clean(str(o, "label", 24), kind), url);
    }

    private static final Set<String> SEVERITIES = Set.of("info", "recommended", "required");

    private static DashboardConfig.Update parseUpdate(JsonObject o) {
        String id = id(o), title = clean(str(o, "title", 80), "");
        if (id.isEmpty() || title.isEmpty()) return null;
        String severity = str(o, "severity", 16).toLowerCase(Locale.ROOT);
        return new DashboardConfig.Update(id, clean(str(o, "version", 24), ""), title, clean(str(o, "body", 300), ""), httpsOrEmpty(str(o, "url", 300)),
            SEVERITIES.contains(severity) ? severity : "info", instant(o, "date"));
    }

    private static String id(JsonObject o) {
        String id = str(o, "id", 40).toLowerCase(Locale.ROOT);
        return ID.matcher(id).matches() ? id : "";
    }

    /** ISO-8601 instant (e.g. 2026-12-01T00:00:00Z); anything else is treated as absent. */
    private static Instant instant(JsonObject o, String key) {
        String v = str(o, key, 40);
        if (v.isEmpty()) return null;
        try { return Instant.parse(v); } catch (DateTimeParseException e) { return null; }
    }

    private static JsonObject object(JsonObject root, String key) {
        return root.has(key) && root.get(key).isJsonObject() ? root.getAsJsonObject(key) : new JsonObject();
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
