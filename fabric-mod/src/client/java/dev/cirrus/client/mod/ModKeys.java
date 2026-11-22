package dev.cirrus.client.mod;


import dev.cirrus.core.input.Keys;
import com.mojang.blaze3d.platform.InputConstants;
import dev.cirrus.core.config.CirrusConfig;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.Identifier;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * An optional "toggle" key for every module that works in game, created from the registry so new modules get one automatically.
 * The keys are ordinary Minecraft key mappings (unbound by default): they also appear in vanilla Controls and are saved in options.txt.
 * Add a "key.cirrus.toggle.<id>" entry to the language file so vanilla Controls shows a readable name.
 */
public final class ModKeys {
    private static final KeyMapping.Category CATEGORY = new KeyMapping.Category(Identifier.fromNamespaceAndPath("cirrus_fabric", "modules"));
    private static final Map<String, KeyMapping> KEYS = new LinkedHashMap<>();
    private ModKeys() { }

    /** Call once at client start, after every module is registered. */
    public static void registerAll() {
        for (CirrusMod mod : ModRegistry.all()) {
            if (!mod.available()) continue;
            KEYS.put(mod.id(), KeyBindingHelper.registerKeyBinding(new KeyMapping("key.cirrus.toggle." + mod.id(), InputConstants.Type.KEYSYM, Keys.UNKNOWN, CATEGORY)));
        }
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            CirrusConfig cfg = CirrusConfig.get(client.gameDirectory.toPath());
            for (Map.Entry<String, KeyMapping> e : KEYS.entrySet())
                while (e.getValue().consumeClick())
                    if (client.screen == null) ModRegistry.find(e.getKey()).ifPresent(m -> m.setEnabled(cfg, !m.enabled(cfg)));
        });
    }

    public static boolean supported(String modId) { return KEYS.containsKey(modId); }

    /** The key's name for display, or "None". */
    public static String label(String modId) {
        KeyMapping key = KEYS.get(modId);
        if (key == null || key.isUnbound()) return "None";
        return key.getTranslatedKeyMessage().getString();
    }

    /** Binds a GLFW key code, or clears the binding when the code is negative. Saved to options.txt straight away. */
    public static void bind(String modId, int glfwKey) {
        KeyMapping key = KEYS.get(modId);
        if (key == null) return;
        Minecraft mc = Minecraft.getInstance();
        key.setKey(glfwKey < 0 ? InputConstants.UNKNOWN : InputConstants.Type.KEYSYM.getOrCreate(glfwKey));
        KeyMapping.resetMapping();
        mc.options.save();
    }
}
