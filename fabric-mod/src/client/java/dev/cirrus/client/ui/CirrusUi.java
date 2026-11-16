package dev.cirrus.client.ui;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.Font;
import net.minecraft.locale.Language;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.FontDescription;
import net.minecraft.util.FormattedCharSequence;
import net.minecraft.resources.Identifier;

/** Shared scalable glass surfaces and official Cirrus brand assets for Fabric screens. */
public final class CirrusUi {
    private static final Identifier MARK=Identifier.fromNamespaceAndPath("cirrus_fabric","textures/gui/cirrus-mark.png");
    private static final Identifier UI_FONT=Identifier.fromNamespaceAndPath("cirrus_fabric","ui");
    private static final Identifier UI_SMALL=Identifier.fromNamespaceAndPath("cirrus_fabric","ui_small");
    private static final Identifier UI_DISPLAY=Identifier.fromNamespaceAndPath("cirrus_fabric","ui_display");
    private static final FontDescription UI_FONT_DESC=new FontDescription.Resource(UI_FONT);
    private static final FontDescription UI_SMALL_DESC=new FontDescription.Resource(UI_SMALL);
    private static final FontDescription UI_DISPLAY_DESC=new FontDescription.Resource(UI_DISPLAY);
    private CirrusUi(){}

    public static void backdrop(GuiGraphics g,int width,int height,CirrusTheme t){
        g.fill(0,0,width,height,t.overlay);
        rounded(g,Math.max(8,width/2-240),Math.max(6,height/2-170),480,340,72,t.glow);
        g.fill(0,0,width,Math.max(1,height/3),t.highlight);
        g.fill(0,Math.max(0,height-1),width,height,t.border);
    }
    public static void panel(GuiGraphics g,int x,int y,int w,int h,int radius,CirrusTheme t){
        if(w<=0||h<=0)return;
        rounded(g,x+1,y+6,w,h,radius,t.shadow);
        rounded(g,x,y,w,h,radius,t.surface);
        rounded(g,x+1,y+1,w-2,h-2,Math.max(1,radius-1),t.panel);
        rounded(g,x+2,y+2,w-4,Math.min(25,h-4),Math.max(1,radius-2),t.highlight);
        outline(g,x,y,w,h,radius,t.border);
        g.fill(x+radius,y+1,x+w-radius,y+2,0x18FFFFFF);
        g.fill(x+radius,y+h-2,x+w-radius,y+h-1,blend(t.shadow,t.border,0.18f));
    }
    public static void button(GuiGraphics g,int x,int y,int w,int h,float hover,boolean active,CirrusTheme t){
        float amount=Math.max(0f,Math.min(1f,hover));
        rounded(g,x,y+2,w,h-2,Math.min(10,h/2),blend(t.glow,active?t.surface:t.panel,amount));
        rounded(g,x,y,w,h,Math.min(10,h/2),blend(blend(t.accent,t.panel,0.62f),t.panel,amount));
        outline(g,x,y,w,h,Math.min(10,h/2),blend(t.cyan,t.border,amount));
        rounded(g,x+2,y+3,2,h-6,1,blend(t.accent,0x00000000,amount));
    }
    public static void section(GuiGraphics g,int x,int y,int w,String label,CirrusTheme t){
        headingText(g,net.minecraft.client.Minecraft.getInstance().font,label,x,y,t.text);
        g.fill(x,y+14,x+w,y+15,t.border);
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
        int s=Math.max(10,size),o=Math.max(2,s/5),line=Math.max(1,s/12),mid=s/2;
        switch(Math.floorMod(kind,6)){
            case 0->{outline(g,x+o,y+o,s-2*o,s-2*o,Math.max(2,s/5),color);g.fill(x+mid-line,y+o*2,x+mid+line,y+s-o*2,color);g.fill(x+o*2,y+mid-line,x+s-o*2,y+mid+line,color);}
            case 1->{g.fill(x+o,y+o,x+s-o,y+o+line,color);g.fill(x+o,y+mid-line,x+s-o,y+mid+line,color);g.fill(x+o,y+s-o-line,x+s-o,y+s-o,color);rounded(g,x+o+Math.max(0,s/4-1),y+o-line,Math.max(2,line*2),line*3,1,color);rounded(g,x+s/2-line,y+mid-line,Math.max(2,line*2),line*3,1,color);rounded(g,x+s-o-Math.max(2,line*2),y+s-o-line,Math.max(2,line*2),line*3,1,color);}
            case 2->{outline(g,x+o,y+o,s-2*o,s-2*o,3,color);g.fill(x+o+2,y+o+2,x+s-o-2,y+o+2+line,color);}
            case 3->{g.fill(x+o,y+s-o-line,x+o+line,y+s-o,color);g.fill(x+o,y+s-o-line,x+s-o,y+s-o,color);strokeLine(g,x+o+line,y+mid,x+mid,y+mid-line,line,color);strokeLine(g,x+mid,y+mid-line,x+s-o-line,y+o+line,line,color);}
            case 4->{outline(g,x+o,y+o,s-2*o,s-2*o,s/2,color);strokeLine(g,x+s-o,y+s-o,x+s-line,y+s-line,line,color);}
            default->{strokeLine(g,x+mid,y+o,x+s-o,y+mid,line,color);strokeLine(g,x+s-o,y+mid,x+mid,y+s-o,line,color);strokeLine(g,x+mid,y+s-o,x+o,y+mid,line,color);strokeLine(g,x+o,y+mid,x+mid,y+o,line,color);strokeLine(g,x+mid,y+o,x+mid,y+mid,line,color);strokeLine(g,x+mid,y+mid,x+s-o,y+mid,line,color);}
        }
    }
    public static void brand(GuiGraphics g,int x,int y,int markSize,CirrusTheme t){
        int markWidth=Math.max(1,(markSize*640+236)/473);
        g.blit(MARK,x,y,markWidth,markSize,0f,0f,1f,1f);
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
    private static void strokeLine(GuiGraphics g,int x1,int y1,int x2,int y2,int thickness,int color){
        int steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
        for(int i=0;i<=steps;i++){float p=steps==0?0f:(float)i/steps;int x=Math.round(x1+(x2-x1)*p),y=Math.round(y1+(y2-y1)*p);g.fill(x-thickness/2,y-thickness/2,x+(thickness+1)/2,y+(thickness+1)/2,color);}
    }
    private static int blend(int a,int b,float weight){
        float other=1f-weight;
        int aa=(int)(((a>>>24)&255)*weight+((b>>>24)&255)*other),r=(int)(((a>>>16)&255)*weight+((b>>>16)&255)*other),gg=(int)(((a>>>8)&255)*weight+((b>>>8)&255)*other),bb=(int)((a&255)*weight+(b&255)*other);
        return aa<<24|r<<16|gg<<8|bb;
    }
}
