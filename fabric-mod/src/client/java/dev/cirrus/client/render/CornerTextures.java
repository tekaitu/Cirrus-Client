package dev.cirrus.client.render;

import com.mojang.blaze3d.platform.NativeImage;
import dev.cirrus.core.render.CornerMask;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;

import java.util.HashMap;
import java.util.Map;

/** Uploads {@link CornerMask} coverage as white textures, once per (radius, thickness), and remembers them. */
final class CornerTextures {
    private static final Map<Integer, Identifier> CACHE = new HashMap<>();
    private CornerTextures() { }

    static Identifier get(int r, int t) {
        int key = r * 1024 + t;
        Identifier cached = CACHE.get(key);
        if (cached != null) return cached;
        int size = r * 2;
        int[] alpha = CornerMask.alpha(r, t);
        NativeImage image = new NativeImage(size, size, false);
        for (int j = 0; j < size; j++) for (int i = 0; i < size; i++) image.setPixel(i, j, (alpha[j * size + i] << 24) | 0xFFFFFF);
        Identifier id = Identifier.fromNamespaceAndPath("cirrus_fabric", "generated/corner_" + r + "_" + t);
        Minecraft.getInstance().getTextureManager().register(id, new DynamicTexture(() -> "Cirrus corner " + id.getPath(), image));
        CACHE.put(key, id);
        return id;
    }
}
