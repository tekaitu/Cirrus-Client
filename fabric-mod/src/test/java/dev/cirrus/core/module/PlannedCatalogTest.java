package dev.cirrus.core.module;

import dev.cirrus.core.module.ModCategory;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class PlannedCatalogTest {
    /** Every addon the product brief asks for, by category. */
    private static final Map<ModCategory, List<String>> REQUESTED = Map.of(
        ModCategory.COMBAT, List.of("Classic PvP", "Hit Color", "Damage Indicator", "Hitboxes"),
        ModCategory.MOVEMENT, List.of("Toggle Sprint/Sneak", "Perspective", "Zoom"),
        ModCategory.RENDER, List.of("Fullbright", "Item Physics", "3D Skin Layers", "Particles", "Motion Blur", "Low Fire", "Time & Weather Changer"),
        ModCategory.PLAYER, List.of("Raw Mouse Input", "Damage Tilt"),
        ModCategory.HUD, List.of("Armor Status", "Potion Timer", "Custom Crosshair", "FPS", "Ping", "Keystrokes", "CPS", "Coordinates", "Potion Effects"),
        ModCategory.UTILITY, List.of("Chat Tools", "Lightweight Clip System"),
        ModCategory.SOCIAL, List.of("Friends", "Private Chats", "Voice Chat", "3D Proximity Voice Chat"));
    /** Modules that exist as real classes (see CirrusFabricClient); everything else must be in the catalogue. */
    private static final Set<String> IMPLEMENTED = Set.of("Armor Status", "FPS", "Ping", "Keystrokes");

    @Test void everyRequestedAddonIsAccountedForInItsCategory() {
        int total = 0;
        for (var e : REQUESTED.entrySet()) for (String name : e.getValue()) {
            total++;
            if (IMPLEMENTED.contains(name)) continue;
            boolean found = PlannedCatalog.ENTRIES.stream().anyMatch(p -> p.name().equals(name) && p.category() == e.getKey());
            assertTrue(found, name + " is missing from the catalogue under " + e.getKey());
        }
        assertEquals(31, total);
        assertEquals(31 - IMPLEMENTED.size(), PlannedCatalog.ENTRIES.size(), "no extra or duplicate catalogue entries");
    }

    @Test void entriesAreWellFormed() {
        Set<String> ids = new HashSet<>();
        for (var p : PlannedCatalog.ENTRIES) {
            assertTrue(ids.add(p.id()), "duplicate id " + p.id());
            assertTrue(p.id().matches("[a-z0-9_]+"), p.id());
            assertFalse(p.description().isBlank(), p.id());
            assertTrue(p.description().length() <= 72, p.id() + " description should fit one line");
            assertTrue(p.glyph() >= 0 && p.glyph() < 64, p.id() + " glyph in sheet");
        }
        assertFalse(ids.contains("fps") || ids.contains("ping") || ids.contains("armor_status") || ids.contains("keystrokes"), "implemented ids are not planned");
    }

    @Test void socialEntriesSayTheyBelongToThePlatform() {
        for (var p : PlannedCatalog.ENTRIES) if (p.category() == ModCategory.SOCIAL) assertFalse(p.note().isBlank(), p.id());
    }
}
