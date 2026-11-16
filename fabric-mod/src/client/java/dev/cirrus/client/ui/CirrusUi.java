package dev.cirrus.client.ui;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.resources.Identifier;

/** Shared scalable glass surfaces and official Cirrus brand assets for Fabric screens. */
public final class CirrusUi {
    private static final Identifier MARK=Identifier.fromNamespaceAndPath("cirrus_fabric","textures/gui/cirrus-mark.png");
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
        rounded(g,x,y,w,h,radius,t.panel);
        rounded(g,x+1,y+1,w-2,Math.min(30,h-2),Math.max(1,radius-1),t.highlight);
        outline(g,x,y,w,h,radius,t.border);
        g.fill(x+radius,y+1,x+w-radius,y+2,0x18FFFFFF);
    }
    public static void button(GuiGraphics g,int x,int y,int w,int h,float hover,boolean active,CirrusTheme t){
        float amount=Math.max(0f,Math.min(1f,hover));
        rounded(g,x,y+2,w,h-2,Math.min(10,h/2),blend(t.glow,active?t.surface:t.panel,amount));
        rounded(g,x,y,w,h,Math.min(10,h/2),blend(blend(t.accent,t.panel,0.62f),t.panel,amount));
        outline(g,x,y,w,h,Math.min(10,h/2),blend(t.cyan,t.border,amount));
        rounded(g,x+2,y+3,2,h-6,1,blend(t.accent,0x00000000,amount));
    }
    public static void section(GuiGraphics g,int x,int y,int w,String label,CirrusTheme t){
        g.drawString(net.minecraft.client.Minecraft.getInstance().font,label,x,y,t.text,true);
        g.fill(x,y+14,x+w,y+15,t.border);
    }
    /** Compact line glyphs drawn from crisp strokes, avoiding the pixelated inventory-icon look. */
    public static void icon(GuiGraphics g,int x,int y,int size,int kind,int color){
        int s=Math.max(10,size),o=Math.max(2,s/5),line=Math.max(1,s/12);
        switch(Math.floorMod(kind,5)){
            case 0->{rounded(g,x+o,y+o,s-2*o,s-2*o,Math.max(2,s/5),color);g.fill(x+s/2-line,y+o*2,x+s/2+line,y+s-o*2,color);g.fill(x+o*2,y+s/2-line,x+s-o*2,y+s/2+line,color);}
            case 1->{g.fill(x+o,y+o,x+s-o,y+o+line,color);g.fill(x+o,y+s/2-line,x+s-o,y+s/2+line,color);g.fill(x+o,y+s-o-line,x+s-o,y+s-o,color);g.fill(x+o,y+o,x+o+line,y+s-o,color);}
            case 2->{g.fill(x+s/2-line,y+o,x+s/2+line,y+s-o,color);g.fill(x+o,y+s/2-line,x+s-o,y+s/2+line,color);rounded(g,x+o,y+o,s-2*o,s-2*o,Math.max(2,s/4),0x00000000);}
            case 3->{g.fill(x+o,y+s-o-line,x+o+line,y+s-o,color);g.fill(x+o,y+s/2,x+o+line,y+s-o,color);g.fill(x+o,y+s/2,x+s/2,y+s/2+line,color);g.fill(x+s/2,y+o,x+s/2+line,y+s/2+line,color);g.fill(x+s/2,y+o,x+s-o,y+o+line,color);g.fill(x+s-o-line,y+o,x+s-o,y+s-o,color);}
            default->{rounded(g,x+o,y+o,s-2*o,s-2*o,Math.max(2,s/4),color);g.fill(x+s/2-line,y+o,x+s/2+line,y+s-o,color);}
        }
    }
    public static void brand(GuiGraphics g,int x,int y,int markSize,CirrusTheme t){
        int markWidth=Math.max(1,(markSize*640+236)/473);
        g.blit(MARK,x,y,markWidth,markSize,0f,0f,1f,1f);
        g.drawString(net.minecraft.client.Minecraft.getInstance().font,"Cirrus Client",x+markWidth+9,y+(markSize-8)/2,t.text,true);
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
