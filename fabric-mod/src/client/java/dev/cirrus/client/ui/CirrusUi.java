package dev.cirrus.client.ui;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.Font;
import net.minecraft.locale.Language;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.FontDescription;
import net.minecraft.util.FormattedCharSequence;
import net.minecraft.resources.Identifier;
import dev.cirrus.client.asset.CirrusAssetTextures;

/** Shared scalable glass surfaces and official Cirrus brand assets for Fabric screens. */
public final class CirrusUi {
    private static final Identifier MARK=Identifier.fromNamespaceAndPath("cirrus_fabric","textures/gui/cirrus-mark.png");
    private static final Identifier UI_FONT=Identifier.fromNamespaceAndPath("cirrus_fabric","ui");
    private static final Identifier UI_SMALL=Identifier.fromNamespaceAndPath("cirrus_fabric","ui_small");
    private static final Identifier UI_DISPLAY=Identifier.fromNamespaceAndPath("cirrus_fabric","ui_display");
    private static final FontDescription UI_FONT_DESC=new FontDescription.Resource(UI_FONT);
    private static final FontDescription UI_SMALL_DESC=new FontDescription.Resource(UI_SMALL);
    private static final FontDescription UI_DISPLAY_DESC=new FontDescription.Resource(UI_DISPLAY);
    public static final int ICON_DASHBOARD=0,ICON_LIBRARY=1,ICON_MODS=2,ICON_THEMES=3,ICON_SEARCH=4,ICON_FAVORITE=5,
        ICON_HUD=6,ICON_PVP=7,ICON_VISUALS=8,ICON_PERFORMANCE=9,ICON_UTILITY=10,ICON_SETTINGS=11,
        ICON_SINGLEPLAYER=12,ICON_MULTIPLAYER=13,ICON_BACK=14,ICON_CLOSE=15;
    private CirrusUi(){}

    public static void backdrop(GuiGraphics g,int width,int height,CirrusTheme t){
        CirrusAssetTextures.drawBackdrop(g,width,height);
        g.fill(0,0,width,height,t.overlay);
        // A quiet navy wash instead of a bloom: the picture stays visible, the text stays readable.
        g.fill(0,0,width,Math.max(1,height/4),t.highlight);
        g.fill(0,Math.max(0,height-height/5),width,height,Math.max(t.overlay,t.shadow));
        g.fill(0,Math.max(0,height-1),width,height,t.border);
    }
    public static void dashboardBackdrop(GuiGraphics g,int width,int height,CirrusTheme t){
        backdrop(g,width,height,t);
        CirrusAssetTextures.drawDashboardAmbient(g,width,height);
    }
    /** A flat navy surface with a hairline border and a soft drop shadow. No glass, no frame art. */
    public static void panel(GuiGraphics g,int x,int y,int w,int h,int radius,CirrusTheme t){
        if(w<=0||h<=0)return;
        rounded(g,x,y+2,w,h,radius,t.shadow);
        rounded(g,x,y,w,h,radius,t.panel);
        g.fill(x+radius,y+1,x+w-radius,y+2,t.highlight);
        outline(g,x,y,w,h,radius,t.border);
    }
    /** Quiet control: flat surface, hairline border, accent on hover, one-pixel press. */
    public static void button(GuiGraphics g,int x,int y,int w,int h,float hover,boolean active,CirrusTheme t){
        float amount=Math.max(0f,Math.min(1f,hover));
        int radius=Math.min(9,h/2);
        int fill=blend(active?t.surface:t.panel,t.accentSoft,amount*0.9f);
        rounded(g,x,y,w,h,radius,fill);
        outline(g,x,y,w,h,radius,blend(t.border,t.accent,amount*0.8f));
        if(amount>0.02f)g.fill(x+4,y+5,x+6,y+h-5,blend(t.accent,0x00000000,amount));
    }
    /** The one loud control: solid accent, a light underneath it, nothing else. */
    public static void primaryButton(GuiGraphics g,int x,int y,int w,int h,float hover,CirrusTheme t){
        float amount=Math.max(0f,Math.min(1f,hover));
        int radius=Math.min(9,h/2);
        rounded(g,x,y+2,w,h,radius,t.glow);
        rounded(g,x,y,w,h,radius,blend(t.accent,0xFFFFFFFF,amount*0.16f));
        outline(g,x,y,w,h,radius,blend(t.accent,0xFFFFFFFF,0.35f+amount*0.25f));
        g.fill(x+radius,y+1,x+w-radius,y+2,blend(t.accent,0xFFFFFFFF,0.28f));
    }
    /** A small state badge: ON in green, OFF in muted grey. */
    public static void statusPill(GuiGraphics g,Font font,String label,int x,int y,boolean on,CirrusTheme t){
        int w=Math.max(32,font.width(label)+12),h=13;
        rounded(g,x,y,w,h,6,blend(t.surface,on?t.good:t.muted,0.22f));
        outline(g,x,y,w,h,6,on?blend(t.good,t.border,0.35f):t.border);
        centeredSmall(g,font,label,x+w/2,y+3,on?t.good:t.muted);
    }
    public static void section(GuiGraphics g,int x,int y,int w,String label,CirrusTheme t){
        headingText(g,net.minecraft.client.Minecraft.getInstance().font,label,x,y,t.text);
        g.fill(x,y+14,x+w,y+15,t.border);
        g.fill(x,y+14,x+Math.min(28,w),y+15,t.accent);
    }
    /** Shortens a line with an ellipsis so it never runs past the width it is given. */
    public static String fit(Font font,String value,int maxWidth,boolean small){
        if(value==null||value.isEmpty()||maxWidth<=0)return "";
        if(font.width(small?small(value):body(value))<=maxWidth)return value;
        String dots="…";int low=0,high=value.length();
        while(low<high){int mid=(low+high+1)/2;String cut=value.substring(0,mid)+dots;if(font.width(small?small(cut):body(cut))<=maxWidth)low=mid;else high=mid-1;}
        return low<=0?dots:value.substring(0,low)+dots;
    }
    public static Component body(String value){return Component.literal(value).withStyle(s->s.withFont(UI_FONT_DESC));}
    public static Component small(String value){return Component.literal(value).withStyle(s->s.withFont(UI_SMALL_DESC));}
    public static Component heading(String value){return Component.literal(value).withStyle(s->s.withFont(UI_DISPLAY_DESC));}
    public static FormattedCharSequence formatSearch(String value){return Language.getInstance().getVisualOrder(body(value));}
    public static void text(GuiGraphics g,Font fallback,String value,int x,int y,int color,boolean shadow){g.drawString(fallback,body(value),x,y,color,shadow);}
    public static void smallText(GuiGraphics g,Font fallback,String value,int x,int y,int color,boolean shadow){g.drawString(fallback,small(value),x,y,color,shadow);}
    public static void headingText(GuiGraphics g,Font fallback,String value,int x,int y,int color){g.drawString(fallback,heading(value),x,y,color,true);}
    public static void centered(GuiGraphics g,Font fallback,String value,int x,int y,int color){g.drawCenteredString(fallback,body(value),x,y,color);}
    public static void centeredSmall(GuiGraphics g,Font fallback,String value,int x,int y,int color){g.drawCenteredString(fallback,small(value),x,y,color);}
    public static void centeredHeading(GuiGraphics g,Font fallback,String value,int x,int y,int color){g.drawCenteredString(fallback,heading(value),x,y,color);}

    /** Shared outline icon vocabulary, drawn as scalable strokes in GUI coordinates. */
    public static void icon(GuiGraphics g,int x,int y,int size,int kind,int color){
        CirrusAssetTextures.drawIcon(g,x,y,Math.max(8,size),kind,color);
    }
    public static void emptyLibrary(GuiGraphics g,int x,int y,int width,int height){CirrusAssetTextures.drawEmptyLibrary(g,x,y,width,height);}
    public static void loadingFrame(GuiGraphics g,int x,int y,int size,long frame){CirrusAssetTextures.drawLoadingFrame(g,x,y,size,frame);}
    public static void brand(GuiGraphics g,int x,int y,int markSize,CirrusTheme t){
        int markWidth=Math.max(1,(markSize*640+236)/473);
        Identifier brandMark=dev.cirrus.client.asset.CirrusAssetTextures.mark();
        g.blit(brandMark,x,y,markWidth,markSize,0f,0f,1f,1f);
        headingText(g,net.minecraft.client.Minecraft.getInstance().font,"Cirrus Client",x+markWidth+9,y+(markSize-10)/2,t.text);
    }
    public static void rounded(GuiGraphics g,int x,int y,int w,int h,int radius,int color){
        if(w<=0||h<=0)return;int r=Math.max(0,Math.min(radius,Math.min(w/2,h/2)));
        if(r==0){g.fill(x,y,x+w,y+h,color);return;}
        g.fill(x+r,y,x+w-r,y+h,color);g.fill(x,y+r,x+w,y+h-r,color);
        for(int dy=0;dy<r;dy++){
            int inset=r-(int)Math.floor(Math.sqrt((double)r*r-(double)(r-dy)*(r-dy)));
            g.fill(x+inset,y+dy,x+w-inset,y+dy+1,color);
            g.fill(x+inset,y+h-dy-1,x+w-inset,y+h-dy,color);
        }
    }
    public static void outline(GuiGraphics g,int x,int y,int w,int h,int radius,int color){
        if(w<=0||h<=0)return;int r=Math.max(0,Math.min(radius,Math.min(w/2,h/2)));
        if(r==0){g.fill(x,y,x+w,y+1,color);g.fill(x,y+h-1,x+w,y+h,color);g.fill(x,y,x+1,y+h,color);g.fill(x+w-1,y,x+w,y+h,color);return;}
        for(int dy=0;dy<r;dy++){
            int inset=r-(int)Math.floor(Math.sqrt((double)r*r-(double)(r-dy)*(r-dy)));
            g.fill(x+inset,y+dy,x+w-inset,y+dy+1,color);
            g.fill(x+inset,y+h-dy-1,x+w-inset,y+h-dy,color);
        }
        g.fill(x,y+r,x+1,y+h-r,color);g.fill(x+w-1,y+r,x+w,y+h-r,color);
    }
    private static int blend(int a,int b,float weight){
        float other=1f-weight;
        int aa=(int)(((a>>>24)&255)*weight+((b>>>24)&255)*other),r=(int)(((a>>>16)&255)*weight+((b>>>16)&255)*other),gg=(int)(((a>>>8)&255)*weight+((b>>>8)&255)*other),bb=(int)((a&255)*weight+(b&255)*other);
        return aa<<24|r<<16|gg<<8|bb;
    }
}

