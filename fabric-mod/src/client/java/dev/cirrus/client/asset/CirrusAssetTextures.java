package dev.cirrus.client.asset;

import com.mojang.blaze3d.platform.NativeImage;
import dev.cirrus.client.ui.Gfx;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.Map;

/** Verified external art, registered with the texture manager on the render thread. */
public final class CirrusAssetTextures {
    private static final String NS = "cirrus_fabric";
    private static final Map<String, String> FALLBACKS = Map.ofEntries(
        Map.entry("cirrus-mark", "external/icons/cirrus-mark.png"),
        Map.entry("cirrus-icons", "external/icons/ui-symbols.png"),
        Map.entry("main-menu-ambient", "external/backgrounds/main-menu-ambient.png"),
        Map.entry("dashboard-ambient", "external/backgrounds/dashboard-ambient.png"),
        Map.entry("glass-panel-frame", "external/textures/glass-panel-frame.png"),
        Map.entry("button-states", "external/textures/button-states.png"),
        Map.entry("loading-ring", "external/animations/loading-ring.png"),
        Map.entry("empty-library", "external/illustrations/empty-library.png")
    );
    private static final Map<String, Identifier> TEXTURES = new LinkedHashMap<>();
    private CirrusAssetTextures() { }

    public static void load(AssetManager assets) {
        Minecraft client = Minecraft.getInstance();
        if (!client.isSameThread()) { client.execute(() -> load(assets)); return; }
        for (var entry : FALLBACKS.entrySet()) {
            if (TEXTURES.containsKey(entry.getKey())) continue;
            var path = assets.installed(entry.getKey());
            if (path == null) continue;
            try (InputStream input = Files.newInputStream(path)) {
                NativeImage image = NativeImage.read(input);
                Identifier id = Identifier.fromNamespaceAndPath(NS, "dynamic-assets/" + entry.getKey());
                client.getTextureManager().register(id, new DynamicTexture(() -> "Cirrus " + entry.getKey(), image));
                TEXTURES.put(entry.getKey(), id);
            } catch (Exception e) {
                LoggerFactory.getLogger("Cirrus Assets").warn("Could not register Cirrus visual asset {}; bundled fallback will be used.", entry.getKey(), e);
            }
        }
    }

    public static Identifier texture(String assetId) {
        Identifier dynamic = TEXTURES.get(assetId);
        if (dynamic != null) return dynamic;
        String fallback = FALLBACKS.get(assetId);
        if (fallback != null) return Identifier.fromNamespaceAndPath(NS, fallback);
        return Identifier.fromNamespaceAndPath(NS, "textures/gui/cirrus-mark.png");
    }

    public static Identifier mark() { return texture("cirrus-mark"); }

    public static void drawBackdrop(GuiGraphics g, int width, int height) {
        drawCover(g,texture("main-menu-ambient"),width,height,2048,1152);
    }

    public static void drawDashboardAmbient(GuiGraphics g, int width, int height) {
        drawCover(g,texture("dashboard-ambient"),width,height,1600,900);
    }

    /** One 64px cell of the icon sheet (1024x256: 16 icons, 4 colour rows), drawn at size x size GUI units. */
    public static void drawIcon(GuiGraphics g,int x,int y,int size,int kind,int color) {
        int row=colorRow(color),icon=Math.floorMod(kind,16);
        Gfx.region(g,texture("cirrus-icons"),x,y,size,size,icon*64,row*64,64,64,ICONS_WIDTH,256,0xFFFFFFFF);
    }

    public static void drawLoadingFrame(GuiGraphics g,int x,int y,int size,long frame) {
        int index=Math.floorMod((int)frame,8);
        Gfx.region(g,texture("loading-ring"),x,y,size,size,index*64,0,64,64,512,64,0xFFFFFFFF);
    }

    public static void drawEmptyLibrary(GuiGraphics g,int x,int y,int width,int height) {
        Gfx.region(g,texture("empty-library"),x,y,width,height,0,0,640,384,640,384,0xFFFFFFFF);
    }

    public static void drawMark(GuiGraphics g,int x,int y,int width,int height,int color) {
        Gfx.region(g,mark(),x,y,width,height,0,0,640,473,640,473,color);
    }

    private static final int ICONS_WIDTH=1024;
    private static int colorRow(int color) {
        int r=(color>>>16)&255,g=(color>>>8)&255,b=color&255;
        if(r>190&&g>120&&b<130)return 3;
        if(Math.max(r,Math.max(g,b))<150)return 2;
        if(b>r*1.2&&g>r*1.15)return 1;
        return 0;
    }

    /** Fills the whole area with the image, cropping the overflow evenly (like CSS background-size: cover). */
    private static void drawCover(GuiGraphics g,Identifier texture,int width,int height,int tw,int th) {
        if(width<=0||height<=0)return;
        float imageAspect=(float)tw/th,viewAspect=(float)width/height;
        int u=0,v=0,uw=tw,vh=th;
        if(viewAspect>imageAspect){vh=Math.round(tw/viewAspect);v=(th-vh)/2;}
        else{uw=Math.round(th*viewAspect);u=(tw-uw)/2;}
        Gfx.region(g,texture,0,0,width,height,u,v,uw,vh,tw,th,0xFFFFFFFF);
    }
}
