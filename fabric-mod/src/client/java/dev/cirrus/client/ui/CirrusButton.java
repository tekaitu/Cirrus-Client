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
    private CirrusButton(int x,int y,int w,int h,Component text,OnPress action){super(x,y,w,h,text,action,DEFAULT_NARRATION);}
    public static CirrusButton of(int x,int y,int w,int h,Component text,OnPress action){return new CirrusButton(x,y,w,h,text,action);}
    protected void renderContents(GuiGraphics g,int mouseX,int mouseY,float delta){
        var cfg=CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());var t=CirrusTheme.current(cfg);int x=getX(),y=getY();
        long now=System.nanoTime();float elapsed=lastRenderNanos==0?0f:Math.min(0.05f,(now-lastRenderNanos)/1_000_000_000f);lastRenderNanos=now;
        float target=isHoveredOrFocused()&&active?1f:0f;hoverBlend+=(target-hoverBlend)*(1f-(float)Math.exp(-elapsed*16f));
        CirrusUi.button(g,x,y,width,height,hoverBlend,active,t);
        g.drawCenteredString(Minecraft.getInstance().font,getMessage(),x+width/2,y+(height-8)/2,active?t.text:t.muted);
    }
}
