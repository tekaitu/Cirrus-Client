package dev.cirrus.client.mod;

import dev.cirrus.client.ui.Glyphs;

import java.util.List;

/**
 * Every requested feature that is not implemented yet. When one is built, delete its entry here and register the real module;
 * the Click GUI picks it up in the same category with no other change. Nothing in this list does anything in game.
 */
public final class PlannedCatalog {
    private static final String PLATFORM = "Provided by the Cirrus platform, not by an in-game module.";

    public record Entry(String id, String name, String description, ModCategory category, int glyph, String note) { }

    public static final List<Entry> ENTRIES = List.of(
        new Entry("classic_pvp", "Classic PvP", "1.8-style combat feel: blocking pose and swing animations.", ModCategory.COMBAT, Glyphs.SWORD, ""),
        new Entry("hit_color", "Hit Color", "Choose the colour entities flash when you hit them.", ModCategory.COMBAT, Glyphs.DROPLET, ""),
        new Entry("damage_indicator", "Damage Indicator", "Shows how much damage each hit deals.", ModCategory.COMBAT, Glyphs.HEART, ""),
        new Entry("hitboxes", "Hitboxes", "Entity hitbox outlines with adjustable colour and thickness.", ModCategory.COMBAT, Glyphs.CUBE, ""),

        new Entry("toggle_sprint", "Toggle Sprint/Sneak", "Tap once to sprint or sneak instead of holding the key.", ModCategory.MOVEMENT, Glyphs.TOGGLE, ""),
        new Entry("perspective", "Perspective", "Hold a key to look around your character without turning.", ModCategory.MOVEMENT, Glyphs.ORBIT, ""),
        new Entry("zoom", "Zoom", "Hold a key to zoom in, with an adjustable level.", ModCategory.MOVEMENT, Glyphs.ZOOM, ""),

        new Entry("fullbright", "Fullbright", "Full brightness in dark areas.", ModCategory.RENDER, Glyphs.SUN, ""),
        new Entry("item_physics", "Item Physics", "Dropped items lie flat on the ground.", ModCategory.RENDER, Glyphs.FALL, ""),
        new Entry("skin_layers", "3D Skin Layers", "Skin overlay layers rendered with depth.", ModCategory.RENDER, Glyphs.LAYERS, ""),
        new Entry("particles", "Particles", "Control how many particles are shown.", ModCategory.RENDER, Glyphs.SPARKLES, ""),
        new Entry("motion_blur", "Motion Blur", "Blends frames while you turn, with adjustable strength.", ModCategory.RENDER, Glyphs.BLUR, ""),
        new Entry("low_fire", "Low Fire", "Lowers the fire overlay so it blocks less of the view.", ModCategory.RENDER, Glyphs.FLAME, ""),
        new Entry("time_weather", "Time & Weather Changer", "Client-side time of day and weather. The server is not changed.", ModCategory.RENDER, Glyphs.CLOUD, ""),

        new Entry("raw_input", "Raw Mouse Input", "Use unaccelerated mouse movement.", ModCategory.PLAYER, Glyphs.MOUSE, ""),
        new Entry("damage_tilt", "Damage Tilt", "Reduce or remove the screen tilt when you take damage.", ModCategory.PLAYER, Glyphs.TILT, ""),

        new Entry("potion_timer", "Potion Timer", "Compact time left for active potion effects.", ModCategory.HUD, Glyphs.CLOCK, ""),
        new Entry("crosshair", "Custom Crosshair", "Style, colour and size of the crosshair.", ModCategory.HUD, Glyphs.CROSSHAIR, ""),
        new Entry("cps", "CPS", "Clicks per second counter.", ModCategory.HUD, Glyphs.CURSOR, ""),
        new Entry("coordinates", "Coordinates", "Your position and facing direction.", ModCategory.HUD, Glyphs.PIN, ""),
        new Entry("potion_effects", "Potion Effects", "Active effects with icons and time left.", ModCategory.HUD, Glyphs.FLASK, ""),

        new Entry("chat_tools", "Chat Tools", "Chat timestamps, filters and quick copy.", ModCategory.UTILITY, Glyphs.CHAT, ""),
        new Entry("clip_system", "Lightweight Clip System", "Save the last moments as a short clip with low overhead.", ModCategory.UTILITY, Glyphs.FILM, ""),

        new Entry("friends", "Friends", "Friends list and joining friends.", ModCategory.SOCIAL, Glyphs.MULTIPLAYER, PLATFORM),
        new Entry("private_chats", "Private Chats", "Direct messages with friends.", ModCategory.SOCIAL, Glyphs.LOCKCHAT, PLATFORM),
        new Entry("voice_chat", "Voice Chat", "Talk to friends while you play.", ModCategory.SOCIAL, Glyphs.MIC, PLATFORM),
        new Entry("proximity_voice", "3D Proximity Voice Chat", "Hear nearby players from their direction and distance.", ModCategory.SOCIAL, Glyphs.HEADSET, PLATFORM));

    private PlannedCatalog() { }

    public static void registerAll() { for (Entry e : ENTRIES) ModRegistry.register(new PlannedMod(e)); }
}
