package dev.cirrus.client.asset;

import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.resources.Identifier;

import java.io.InputStream;

/** Registers verified downloaded artwork with Minecraft on the client/render thread. */
public final class CirrusAssetTextures {
    private static final Identifier MARK = Identifier.fromNamespaceAndPath("cirrus_fabric", "external/cirrus-mark");
    private static boolean loaded;
    private CirrusAssetTextures() { }

    public static void load(AssetManager assets) {
        Minecraft client = Minecraft.getInstance();
        if (!client.isSameThread()) { client.execute(() -> load(assets)); return; }
        if (loaded) return;
        var path = assets.installed("cirrus-mark");
        if (path == null) return;
        try (InputStream input = java.nio.file.Files.newInputStream(path)) {
            NativeImage image = NativeImage.read(input);
            client.getTextureManager().register(MARK, new DynamicTexture(() -> "Cirrus external mark", image));
            loaded = true;
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger("Cirrus Assets").warn("Could not load downloaded Cirrus mark; using bundled logo.", e);
        }
    }

    public static Identifier mark() { return loaded ? MARK : Identifier.fromNamespaceAndPath("cirrus_fabric", "textures/gui/cirrus-mark.png"); }
}

