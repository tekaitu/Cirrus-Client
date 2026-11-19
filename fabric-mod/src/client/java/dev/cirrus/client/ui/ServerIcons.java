package dev.cirrus.client.ui;

import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayInputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/** Turns server favicon bytes (64x64 PNG from the status ping) into GUI textures, cached per address and released on close. */
public final class ServerIcons {
    private static final Logger LOG = LoggerFactory.getLogger("Cirrus Client");
    private record Entry(Identifier id, int hash) { }
    private final Map<String, Entry> cache = new HashMap<>();
    private final Map<String, Integer> failed = new HashMap<>();

    /** Returns the favicon texture for the address, or null when the server has none (or it is unreadable). */
    public Identifier get(String address, byte[] bytes) {
        if (bytes == null || bytes.length == 0) return null;
        int hash = Arrays.hashCode(bytes);
        Entry entry = cache.get(address);
        if (entry != null && entry.hash == hash) return entry.id;
        if (failed.getOrDefault(address, 0) == hash) return null;
        NativeImage image = null;
        try {
            image = NativeImage.read(new ByteArrayInputStream(bytes));
            if (image.getWidth() != 64 || image.getHeight() != 64) throw new IllegalArgumentException("favicon must be 64x64");
            Minecraft mc = Minecraft.getInstance();
            if (entry != null) mc.getTextureManager().release(entry.id);
            Identifier id = Identifier.fromNamespaceAndPath("cirrus_fabric", "servericon/" + Integer.toHexString(address.hashCode()) + "_" + Integer.toHexString(hash));
            mc.getTextureManager().register(id, new DynamicTexture(() -> "cirrus server icon", image));   // the texture owns the image now
            cache.put(address, new Entry(id, hash));
            return id;
        } catch (Exception e) {
            if (image != null) image.close();
            LOG.debug("Unusable favicon for {}: {}", address, e.toString());
            failed.put(address, hash);
            return null;
        }
    }

    public void release() {
        Minecraft mc = Minecraft.getInstance();
        for (Entry e : cache.values()) mc.getTextureManager().release(e.id);
        cache.clear();
    }
}
