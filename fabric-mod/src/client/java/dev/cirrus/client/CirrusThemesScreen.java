package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusButton;
import dev.cirrus.client.ui.CirrusTheme;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Persistent built-in themes; palette tokens keep additional themes extensible. */
public final class CirrusThemesScreen extends Screen {
 private final Screen parent;
 public CirrusThemesScreen(Screen parent){super(Component.literal("Cirrus Themes"));this.parent=parent;}
 protected void init(){int x=width/2-170,y=height/2-34;addRenderableWidget(CirrusButton.of(x,y,150,28,Component.literal("Dark  ·  Midnight"),b->CirrusTheme.set(config(),CirrusTheme.DARK)));addRenderableWidget(CirrusButton.of(x+190,y,150,28,Component.literal("Light  ·  Frost"),b->CirrusTheme.set(config(),CirrusTheme.LIGHT)));addRenderableWidget(CirrusButton.of(width/2-70,y+58,140,22,Component.literal("Back"),b->minecraft.setScreen(parent)));}
 public void render(GuiGraphics g,int mx,int my,float d){renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());g.fill(0,0,width,height,t.overlay);g.drawCenteredString(font,"THEMES",width/2,height/2-100,t.cyan);int w=150,h=78,y=height/2-1;g.fill(width/2-170,y,width/2-20,y+h,CirrusTheme.DARK.panel);g.renderOutline(width/2-170,y,w,h,CirrusTheme.DARK.accent);g.drawCenteredString(font,"Aa  Midnight Navy",width/2-95,y+28,CirrusTheme.DARK.text);g.fill(width/2+20,y,width/2+170,y+h,CirrusTheme.LIGHT.panel);g.renderOutline(width/2+20,y,w,h,CirrusTheme.LIGHT.accent);g.drawCenteredString(font,"Aa  Frost Light",width/2+95,y+28,CirrusTheme.LIGHT.text);super.render(g,mx,my,d);}
 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
