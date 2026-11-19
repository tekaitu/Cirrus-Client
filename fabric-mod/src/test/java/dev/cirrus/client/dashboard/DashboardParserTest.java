package dev.cirrus.client.dashboard;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class DashboardParserTest {
    @Test void bundledFallbackParsesAndHasSixPartnersAndABanner() {
        DashboardConfig c = DashboardRepository.loadBundled();
        assertEquals(1, c.schema());
        assertEquals(6, c.partners().size());
        assertEquals(1, c.banners().size());
        assertFalse(c.store().enabled(), "store stays disabled until the dashboard provides a url");
        assertTrue(c.partners().stream().allMatch(p -> p.tagline().startsWith("Sample")), "fallback partners are labelled as samples");
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
        assertFalse(c.store().enabled(), "an unusable url disables the store button instead of linking somewhere unsafe");
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
        assertEquals(6, new DashboardRepository(dir).get().partners().size(), "corrupt cache falls back to the bundled data");
    }

    @Test void refreshWithoutAUsableUrlDoesNothing(@TempDir Path dir) throws Exception {
        DashboardRepository repo = new DashboardRepository(dir);
        assertFalse(repo.refresh("").get());
        assertFalse(repo.refresh("http://insecure.example/dashboard.json").get());
        assertFalse(Files.exists(dir.resolve("config")), "no network or disk activity without a configured https url");
    }
}
