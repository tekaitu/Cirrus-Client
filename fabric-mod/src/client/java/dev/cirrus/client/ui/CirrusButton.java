package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.network.chat.Component;

/** Crisp, theme-aware button treatment using Minecraft's scalable GUI coordinates. */
public final class CirrusButton extends Button {
    private CirrusButton(int x,int y,int w,int h,Component text,OnPress action){super(x,y,w,h,text,action,DEFAULT_NARRATION);}
    public static CirrusButton of(int x,int y,int w,int h,Component text,OnPress action){return new CirrusButton(x,y,w,h,text,action);}
    protected void renderContents(GuiGraphics g,int mouseX,int mouseY,float delta){
        var cfg=CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());var t=CirrusTheme.current(cfg);int x=getX(),y=getY();
        int fill=isHoveredOrFocused()?t.accent:(active?t.panel:t.surface);g.fill(x+1,y,x+width-1,y+height,fill);g.fill(x,y+3,x+1,y+height-3,t.border);g.fill(x+width-1,y+3,x+width,y+height-3,t.border);g.fill(x+3,y,x+width-3,y+1,t.border);g.fill(x+3,y+height-1,x+width-3,y+height,t.border);
        if(isHoveredOrFocused())g.fill(x+2,y+3,x+4,y+height-3,t.cyan);
        g.drawCenteredString(Minecraft.getInstance().font,getMessage(),x+width/2,y+(height-8)/2,active?t.text:t.muted);
    }
}
