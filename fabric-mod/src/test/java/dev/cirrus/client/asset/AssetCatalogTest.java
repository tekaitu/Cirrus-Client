package dev.cirrus.client.asset;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AssetCatalogTest {
    @Test void everyManifestAssetHasMatchingBundledFallbackAndChecksum() throws Exception {
        JsonObject manifest;
        try (InputStream input = getClass().getResourceAsStream("/assets/cirrus_fabric/asset-manifest.json")) {
            assertNotNull(input, "bundled fallback manifest");
            manifest = JsonParser.parseString(new String(input.readAllBytes(), StandardCharsets.UTF_8)).getAsJsonObject();
        }
        assertEquals(1, manifest.get("manifestVersion").getAsInt());
        JsonArray entries = manifest.getAsJsonArray("assets");
        assertEquals(10, entries.size());
        for (var entry : entries) {
            JsonObject asset = entry.getAsJsonObject();
            String relativePath = asset.get("path").getAsString();
            AssetManager.validateRelativePath(relativePath);
            assertTrue(asset.get("url").getAsString().startsWith("https://raw.githubusercontent.com/tekaitu/Cirrus-Client/codex/cirrus-fabric-foundation/assets/cirrus-client/v1/"));
            byte[] bytes;
            String fallbackPath = "/assets/cirrus_fabric/external/" + relativePath;
            try (InputStream fallback = getClass().getResourceAsStream(fallbackPath)) {
                assertNotNull(fallback, "bundled fallback for " + relativePath);
                bytes = fallback.readAllBytes();
            }
            assertEquals(asset.get("size").getAsLong(), bytes.length, "manifest size for " + relativePath);
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            assertEquals(asset.get("sha256").getAsString(), hash, "manifest checksum for " + relativePath);
        }
    }
}

