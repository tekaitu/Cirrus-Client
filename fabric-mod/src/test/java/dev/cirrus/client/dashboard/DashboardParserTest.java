package dev.cirrus.client.dashboard;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class DashboardParserTest {
    private static final String FULL = """
        {"schema":1,"revision":9,
         "store":{"label":"SHOP","url":"https://cirrus.example/store","enabled":true},
         "partners":[
           {"id":"alpha","name":"Alpha Network","address":"play.alpha.example:25570","tagline":"Official","color":"#1B8FFF","iconUrl":"https://cdn.example/alpha.png","order":2},
           {"id":"beta","name":"Beta","address":"beta.example","order":1}],
         "advertised":{"partnerId":"alpha","startButton":true,"label":"PLAY"},
         "banners":[{"id":"b1","title":"Launch","startsAt":"2026-01-01T00:00:00Z","endsAt":"2026-02-01T00:00:00Z"}],
         "discord":{"enabled":true,"title":"Link your Discord","url":"https://discord.example/link","rewardText":"Reward shown by the dashboard"},
         "giveaways":[{"id":"g1","title":"Cape giveaway","endsAt":"2026-03-01T00:00:00Z"}],
         "news":[{"id":"n1","title":"News","date":"2026-01-05T00:00:00Z"}],
         "storePromos":[{"id":"s1","text":"20% off"}],
         "featured":[{"id":"f1","title":"Featured"}],
         "socials":[{"id":"yt","kind":"youtube","url":"https://youtube.example/c"},{"id":"bad","kind":"myspace","url":"https://x.example"},{"id":"nourl","kind":"x","url":"http://insecure.example"}],
         "updates":[{"id":"u1","version":"0.2.0","title":"Update","severity":"weird"}]}
        """;

    @Test void bundledFallbackIsEmptyAndSafe() {
        DashboardConfig c = DashboardRepository.loadBundled();
        assertEquals(1, c.schema());
        assertTrue(c.partners().isEmpty() && c.banners().isEmpty() && c.news().isEmpty() && c.giveaways().isEmpty() && c.socials().isEmpty());
        assertNull(c.advertised());
        assertFalse(c.store().enabled(), "store stays disabled until the dashboard provides a url");
        assertFalse(c.discord().enabled());
    }

    @Test void parsesEveryContentType() {
        DashboardConfig c = DashboardParser.parse(FULL);
        assertEquals(9, c.revision());
        assertEquals("SHOP", c.store().label());
        assertTrue(c.store().enabled());
        assertEquals("beta", c.partners().get(0).id(), "partners are ordered by 'order'");
        assertEquals("https://cdn.example/alpha.png", c.partner("alpha").iconUrl());
        assertEquals("alpha", c.advertisedPartner().id());
        assertEquals("PLAY", c.advertised().label());
        assertTrue(c.advertised().startButton());
        assertEquals(1, c.banners().size());
        assertTrue(c.discord().enabled());
        assertEquals("Reward shown by the dashboard", c.discord().rewardText());
        assertEquals(1, c.giveaways().size());
        assertEquals(1, c.news().size());
        assertEquals(1, c.storePromos().size());
        assertEquals(1, c.featured().size());
        assertEquals(1, c.socials().size(), "unknown kinds and non-https urls are dropped");
        assertEquals("info", c.updates().get(0).severity(), "unknown severity falls back to info");
    }

    @Test void advertisedServerMustNameAListedPartner() {
        DashboardConfig c = DashboardParser.parse("{\"schema\":1,\"partners\":[{\"id\":\"a\",\"name\":\"A\",\"address\":\"a.example\"}],\"advertised\":{\"partnerId\":\"ghost\"}}");
        assertNull(c.advertised());
        assertNull(c.advertisedPartner());
        DashboardConfig noPartners = DashboardParser.parse("{\"schema\":1,\"advertised\":{\"partnerId\":\"a\"}}");
        assertNull(noPartners.advertised());
    }

    @Test void startButtonCanBeHiddenByTheDashboard() {
        DashboardConfig c = DashboardParser.parse("{\"schema\":1,\"partners\":[{\"id\":\"a\",\"name\":\"A\",\"address\":\"a.example\"}],\"advertised\":{\"partnerId\":\"a\",\"startButton\":false}}");
        assertNotNull(c.advertisedPartner());
        assertFalse(c.advertised().startButton());
    }

    @Test void timeWindowsAreRespected() {
        DashboardConfig c = DashboardParser.parse(FULL);
        DashboardConfig.Banner b = c.banners().get(0);
        assertFalse(b.activeAt(Instant.parse("2025-12-31T23:59:59Z")));
        assertTrue(b.activeAt(Instant.parse("2026-01-15T00:00:00Z")));
        assertFalse(b.activeAt(Instant.parse("2026-02-01T00:00:00Z")));
        DashboardConfig.StorePromo open = c.storePromos().get(0);
        assertTrue(open.activeAt(Instant.parse("2030-01-01T00:00:00Z")), "no window means always active");
        DashboardConfig bad = DashboardParser.parse("{\"schema\":1,\"banners\":[{\"id\":\"x\",\"title\":\"T\",\"startsAt\":\"not a date\"}]}");
        assertNull(bad.banners().get(0).startsAt());
    }

    @Test void rejectsWrongSchemaGarbageAndOversizedDocuments() {
        assertThrows(IllegalArgumentException.class, () -> DashboardParser.parse("{\"schema\":2}"));
        assertThrows(IllegalArgumentException.class, () -> DashboardParser.parse("not json"));
        assertThrows(IllegalArgumentException.class, () -> DashboardParser.parse("[]"));
        assertThrows(IllegalArgumentException.class, () -> DashboardParser.parse("x".repeat(DashboardParser.MAX_BYTES + 1)));
        assertThrows(IllegalArgumentException.class, () -> DashboardParser.parse(null));
    }

    @Test void dropsBadEntriesButKeepsGoodOnes() {
        String json = "{\"schema\":1,\"partners\":["
            + "{\"id\":\"ok\",\"name\":\"Good\",\"address\":\"mc.example.com:25570\"},"
            + "{\"id\":\"BAD ID\",\"name\":\"x\",\"address\":\"mc.example.com\"},"
            + "{\"id\":\"noaddr\",\"name\":\"x\",\"address\":\"not a host!\"},"
            + "{\"id\":\"port\",\"name\":\"x\",\"address\":\"a.example.com:99999\"},"
            + "{\"id\":\"ok\",\"name\":\"Dup\",\"address\":\"dup.example.com\"},"
            + "\"junk\",42]}";
        DashboardConfig c = DashboardParser.parse(json);
        assertEquals(1, c.partners().size());
        assertEquals("Good", c.partners().get(0).name());
        assertEquals(0x286FE8, c.partners().get(0).color(), "default colour when none given");
    }

    @Test void urlsMustBeHttpsWithAHostAndNoCredentials() {
        assertEquals("https://cirrus.example/store", DashboardParser.httpsOrEmpty("https://cirrus.example/store"));
        for (String bad : new String[]{"http://cirrus.example", "javascript:alert(1)", "file:///etc/passwd", "https://user:pw@cirrus.example", "https://", "", " ", "ftp://x.example"})
            assertEquals("", DashboardParser.httpsOrEmpty(bad), bad);
        DashboardConfig c = DashboardParser.parse("{\"schema\":1,\"store\":{\"url\":\"http://insecure.example\",\"enabled\":true}}");
        assertFalse(c.store().enabled(), "an unusable url disables the button instead of linking somewhere unsafe");
        DashboardConfig d = DashboardParser.parse("{\"schema\":1,\"partners\":[{\"id\":\"p\",\"name\":\"P\",\"address\":\"p.example\",\"iconUrl\":\"http://insecure.example/i.png\"}]}");
        assertEquals("", d.partners().get(0).iconUrl(), "image urls follow the same https rule");
    }

    @Test void textIsCleanedAndLimited() {
        String json = "{\"schema\":1,\"banners\":[{\"id\":\"b\",\"title\":\"§cRed\\u0007 Title " + "x".repeat(100) + "\"}]}";
        DashboardConfig.Banner b = DashboardParser.parse(json).banners().get(0);
        assertTrue(b.title().length() <= 40);
        assertFalse(b.title().contains("§"));
        assertFalse(b.title().contains("\u0007"));
    }

    @Test void countsAreCappedAndOrdered() {
        StringBuilder sb = new StringBuilder("{\"schema\":1,\"partners\":[");
        for (int i = 0; i < 30; i++) sb.append(i > 0 ? "," : "").append("{\"id\":\"p").append(i).append("\",\"name\":\"N").append(i).append("\",\"address\":\"h").append(i).append(".example.com\",\"order\":").append(30 - i).append("}");
        DashboardConfig c = DashboardParser.parse(sb.append("]}").toString());
        assertEquals(DashboardParser.MAX_PARTNERS, c.partners().size());
        assertTrue(c.partners().get(0).order() <= c.partners().get(1).order());
    }

    @Test void addressValidation() {
        assertTrue(DashboardParser.validAddress("play.example.com"));
        assertTrue(DashboardParser.validAddress("localhost:25565"));
        assertTrue(DashboardParser.validAddress("127.0.0.1"));
        assertFalse(DashboardParser.validAddress("play.example.com:0"));
        assertFalse(DashboardParser.validAddress("bad host"));
        assertFalse(DashboardParser.validAddress("-bad.example.com"));
        assertFalse(DashboardParser.validAddress(""));
        assertFalse(DashboardParser.validAddress(null));
    }

    @Test void repositoryPrefersAValidCacheAndIgnoresACorruptOne(@TempDir Path dir) throws Exception {
        Path cache = dir.resolve("config/cirrus-client/dashboard-cache.json");
        Files.createDirectories(cache.getParent());
        Files.writeString(cache, "{\"schema\":1,\"revision\":7,\"partners\":[{\"id\":\"c\",\"name\":\"Cached\",\"address\":\"c.example.com\"}]}");
        DashboardConfig cached = new DashboardRepository(dir).get();
        assertEquals(7, cached.revision());
        assertEquals("Cached", cached.partners().get(0).name());

        Files.writeString(cache, "{ corrupt");
        assertTrue(new DashboardRepository(dir).get().partners().isEmpty(), "corrupt cache falls back to the (empty) bundled data");
    }

    @Test void refreshWithoutAUsableUrlDoesNothing(@TempDir Path dir) throws Exception {
        DashboardRepository repo = new DashboardRepository(dir);
        assertFalse(repo.refresh("").get());
        assertFalse(repo.refresh("http://insecure.example/dashboard.json").get());
        assertFalse(Files.exists(dir.resolve("config")), "no network or disk activity without a configured https url");
    }
}
