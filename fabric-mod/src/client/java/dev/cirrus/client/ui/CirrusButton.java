package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;

/**
 * Crisp, theme-aware button treatment using Minecraft's scalable GUI coordinates.
 * Quiet controls keep a hairline; rail items have no plate at all.
 */
public final class CirrusButton extends Button {
    private float hoverBlend;
    private long lastRenderNanos;
    private final int iconKind;
    private final boolean primary;
    private final boolean rail;
    private boolean selected;
    private CirrusButton(int x,int y,int w,int h,Component text,OnPress action,int iconKind,boolean primary,boolean rail,boolean selected){super(x,y,w,h,text,action,DEFAULT_NARRATION);this.iconKind=iconKind;this.primary=primary;this.rail=rail;this.selected=selected;}
    public static CirrusButton of(int x,int y,int w,int h,Component text,OnPress action){return new CirrusButton(x,y,w,h,text,action,-1,false,false,false);}
    public static CirrusButton nav(int x,int y,int w,int h,Component text,int iconKind,OnPress action){return new CirrusButton(x,y,w,h,text,action,iconKind,false,false,false);}
    /** The filled control: highlight fill with type cut out, used once per screen (Singleplayer on the title screen). */
    public static CirrusButton primary(int x,int y,int w,int h,Component text,OnPress action){return new CirrusButton(x,y,w,h,text,action,-1,true,false,false);}
    public static CirrusButton primaryNav(int x,int y,int w,int h,Component text,int iconKind,OnPress action){return new CirrusButton(x,y,w,h,text,action,iconKind,true,false,false);}
    /** A page or category link: no plate, a quiet wash on hover, a short white rule when chosen. */
    public static CirrusButton rail(int x,int y,int w,int h,Component text,int iconKind,boolean selected,OnPress action){return new CirrusButton(x,y,w,h,text,action,iconKind,false,true,selected);}
    public void setSelected(boolean value){selected=value;}
    protected void renderContents(GuiGraphics g,int mouseX,int mouseY,float delta){
        var cfg=CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());var t=CirrusTheme.current(cfg);int x=getX(),y=getY();
        long now=System.nanoTime();float elapsed=lastRenderNanos==0?0f:Math.min(0.05f,(now-lastRenderNanos)/1_000_000_000f);lastRenderNanos=now;
        float target=isHoveredOrFocused()&&active?1f:0f;hoverBlend+=(target-hoverBlend)*(1f-(float)Math.exp(-elapsed*16f));
        if(rail){
            CirrusUi.railButton(g,x,y,width,height,hoverBlend,selected,active,t);
            int labelColor=!active?t.muted:(selected||hoverBlend>0.25f?t.text:t.muted);
            int iconColor=!active?t.muted:(selected?t.accent:(hoverBlend>0.25f?t.text:t.cyan));
            if(iconKind>=0){CirrusUi.icon(g,x+9,y+(height-16)/2,16,iconKind,iconColor);CirrusUi.text(g,Minecraft.getInstance().font,getMessage().getString(),x+32,y+(height-10)/2,labelColor,false);}
            else g.drawCenteredString(Minecraft.getInstance().font,CirrusUi.body(getMessage().getString()),x+width/2,y+(height-10)/2,labelColor);
            return;
        }
        boolean loud=primary&&active;
        if(loud)CirrusUi.primaryButton(g,x,y,width,height,hoverBlend,t);
        else CirrusUi.button(g,x,y,width,height,hoverBlend,active,t);
        int labelColor=loud?t.onAccent:(active?t.text:t.muted);
        int iconColor=loud?t.onAccent:(isHoveredOrFocused()?t.accent:t.muted);
        if(iconKind>=0){CirrusUi.icon(g,x+9,y+(height-16)/2,16,iconKind,iconColor);CirrusUi.text(g,Minecraft.getInstance().font,getMessage().getString(),x+32,y+(height-10)/2,labelColor,false);}
        else g.drawCenteredString(Minecraft.getInstance().font,CirrusUi.body(getMessage().getString()),x+width/2,y+(height-10)/2,labelColor);
    }
}
