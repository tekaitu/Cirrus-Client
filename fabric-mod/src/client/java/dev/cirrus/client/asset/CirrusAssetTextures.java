package dev.cirrus.client.asset;

import com.mojang.blaze3d.platform.NativeImage;
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

    public static void drawPanelFrame(GuiGraphics g,int x,int y,int width,int height,int radius) {
        nineSlice(g,texture("glass-panel-frame"),x,y,width,height,96,96,24,Math.min(radius,Math.min(width,height)/2),0,96);
    }

    public static void drawButtonFrame(GuiGraphics g,int x,int y,int width,int height,float hover,boolean enabled) {
        int state=hover>.94f?2:hover>.08f?1:0;
        nineSlice(g,texture("button-states"),x,y,width,height,128,384,20,Math.min(10,Math.min(width,height)/2),state*128,64);
    }

    public static void drawIcon(GuiGraphics g,int x,int y,int size,int kind,int color) {
        int row=colorRow(color),icon=Math.floorMod(kind,16),cell=64;
        float u0=(float)(icon*cell)/(ICONS_WIDTH),u1=(float)((icon+1)*cell)/ICONS_WIDTH;
        float v0=(float)(row*cell)/256f,v1=(float)((row+1)*cell)/256f;
        g.blit(texture("cirrus-icons"),x,y,size,size,u0,v0,u1,v1);
    }

    public static void drawLoadingFrame(GuiGraphics g,int x,int y,int size,long frame) {
        int index=Math.floorMod((int)frame,8);
        g.blit(texture("loading-ring"),x,y,size,size,(float)index/8f,0f,(float)(index+1)/8f,1f);
    }

    public static void drawEmptyLibrary(GuiGraphics g,int x,int y,int width,int height) {
        g.blit(texture("empty-library"),x,y,width,height,0f,0f,1f,1f);
    }

    private static final int ICONS_WIDTH=1024;
    private static int colorRow(int color) {
        int r=(color>>>16)&255,g=(color>>>8)&255,b=color&255;
        if(r>190&&g>120&&b<130)return 3;
        if(Math.max(r,Math.max(g,b))<150)return 2;
        if(b>r*1.2&&g>r*1.15)return 1;
        return 0;
    }

    private static void drawCover(GuiGraphics g,Identifier texture,int width,int height,int textureWidth,int textureHeight) {
        if(width<=0||height<=0)return;
        float imageAspect=(float)textureWidth/textureHeight,viewAspect=(float)width/height;
        float u0=0f,v0=0f,u1=1f,v1=1f;
        if(viewAspect>imageAspect){float visible=imageAspect/viewAspect;v0=(1f-visible)/2f;v1=v0+visible;}
        else{float visible=viewAspect/imageAspect;u0=(1f-visible)/2f;u1=u0+visible;}
        g.blit(texture,0,0,width,height,u0,v0,u1,v1);
    }

    private static void nineSlice(GuiGraphics g,Identifier texture,int x,int y,int width,int height,int sourceSize,
                                  int textureWidth,int border,int corner,int sourceX,int sourceHeight) {
        if(width<=0||height<=0)return;
        int dx=Math.min(corner,width/2),dy=Math.min(corner,height/2);
        int[] sx={sourceX,sourceX+border,sourceX+sourceSize-border};
        int[] sw={border,sourceSize-border*2,border};
        int[] sy={0,border,sourceHeight-border};
        int[] sh={border,sourceHeight-border*2,border};
        int[] tx={x,x+dx,x+width-dx};
        int[] tw={dx,width-dx*2,dx};
        int[] ty={y,y+dy,y+height-dy};
        int[] th={dy,height-dy*2,dy};
        for(int row=0;row<3;row++)for(int column=0;column<3;column++){
            if(sw[column]<=0||sh[row]<=0||tw[column]<=0||th[row]<=0)continue;
            float u0=(float)sx[column]/textureWidth,u1=(float)(sx[column]+sw[column])/textureWidth;
            float v0=(float)sy[row]/sourceHeight,v1=(float)(sy[row]+sh[row])/sourceHeight;
            g.blit(texture,tx[column],ty[row],tw[column],th[row],u0,v0,u1,v1);
        }
    }
}

