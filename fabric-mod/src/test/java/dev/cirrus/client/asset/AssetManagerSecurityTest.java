package dev.cirrus.client.asset;

import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AssetManagerSecurityTest {
    @Test void acceptsCategoryScopedImageAndFontPaths() {
        assertDoesNotThrow(() -> AssetManager.validateRelativePath("icons/cirrus-mark.png"));
        assertDoesNotThrow(() -> AssetManager.validateRelativePath("fonts/inter-regular.ttf"));
    }

    @Test void rejectsTraversalAndAbsolutePaths() {
        assertThrows(IOException.class, () -> AssetManager.validateRelativePath("icons/../outside.png"));
        assertThrows(IOException.class, () -> AssetManager.validateRelativePath("/icons/mark.png"));
        assertThrows(IOException.class, () -> AssetManager.validateRelativePath("icons\\mark.png"));
    }

    @Test void rejectsExecutableArchivesAndUnknownCategories() {
        assertThrows(IOException.class, () -> AssetManager.validateRelativePath("fonts/payload.jar"));
        assertThrows(IOException.class, () -> AssetManager.validateRelativePath("textures/archive.zip"));
        assertThrows(IOException.class, () -> AssetManager.validateRelativePath("scripts/start.png"));
    }

    @Test void rejectsUnsupportedExtensions() {
        assertThrows(IOException.class, () -> AssetManager.validateRelativePath("icons/asset.svg"));
        assertThrows(IOException.class, () -> AssetManager.validateRelativePath("backgrounds/asset.bin"));
    }
}

