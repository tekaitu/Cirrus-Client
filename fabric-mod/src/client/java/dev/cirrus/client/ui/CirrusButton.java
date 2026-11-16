package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;

/** Crisp, theme-aware button treatment using Minecraft's scalable GUI coordinates. */
public final class CirrusButton extends Button {
    private float hoverBlend;
    private long lastRenderNanos;
    private final int iconKind;
    private CirrusButton(int x,int y,int w,int h,Component text,OnPress action,int iconKind){super(x,y,w,h,text,action,DEFAULT_NARRATION);this.iconKind=iconKind;}
    public static CirrusButton of(int x,int y,int w,int h,Component text,OnPress action){return new CirrusButton(x,y,w,h,text,action,-1);}
    public static CirrusButton nav(int x,int y,int w,int h,Component text,int iconKind,OnPress action){return new CirrusButton(x,y,w,h,text,action,iconKind);}
    protected void renderContents(GuiGraphics g,int mouseX,int mouseY,float delta){
        var cfg=CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());var t=CirrusTheme.current(cfg);int x=getX(),y=getY();
        long now=System.nanoTime();float elapsed=lastRenderNanos==0?0f:Math.min(0.05f,(now-lastRenderNanos)/1_000_000_000f);lastRenderNanos=now;
        float target=isHoveredOrFocused()&&active?1f:0f;hoverBlend+=(target-hoverBlend)*(1f-(float)Math.exp(-elapsed*16f));
        CirrusUi.button(g,x,y,width,height,hoverBlend,active,t);
        if(iconKind>=0){CirrusUi.icon(g,x+9,y+(height-16)/2,16,iconKind,isHoveredOrFocused()?t.cyan:t.muted);CirrusUi.text(g,Minecraft.getInstance().font,getMessage().getString(),x+32,y+(height-10)/2,active?t.text:t.muted,false);}
        else g.drawCenteredString(Minecraft.getInstance().font,CirrusUi.body(getMessage().getString()),x+width/2,y+(height-10)/2,active?t.text:t.muted);
    }
}
