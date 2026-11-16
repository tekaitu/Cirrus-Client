package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusButton;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Persistent built-in themes; palette tokens keep additional themes extensible. */
public final class CirrusThemesScreen extends Screen {
 private final Screen parent;
 public CirrusThemesScreen(Screen parent){super(Component.literal("Cirrus Themes"));this.parent=parent;}
 protected void init(){int x=width/2-170,y=height/2-34;addRenderableWidget(CirrusButton.of(x,y,150,28,Component.literal("Dark  ·  Midnight"),b->CirrusTheme.set(config(),CirrusTheme.DARK)));addRenderableWidget(CirrusButton.of(x+190,y,150,28,Component.literal("Light  ·  Frost"),b->CirrusTheme.set(config(),CirrusTheme.LIGHT)));addRenderableWidget(CirrusButton.of(width/2-70,y+58,140,22,Component.literal("Back"),b->minecraft.setScreen(parent)));}
 public void render(GuiGraphics g,int mx,int my,float d){renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());CirrusUi.backdrop(g,width,height,t);int shellW=Math.min(500,width-24),shellX=(width-shellW)/2;CirrusUi.panel(g,shellX,Math.max(20,height/2-126),shellW,Math.min(250,height-40),20,t);g.drawCenteredString(font,"APPEARANCE",width/2,Math.max(34,height/2-102),t.cyan);int w=Math.min(190,(shellW-48)/2),h=82,y=height/2-34;int left=width/2-w-9,right=width/2+9;CirrusUi.panel(g,left,y,w,h,14,CirrusTheme.DARK);CirrusUi.panel(g,right,y,w,h,14,CirrusTheme.LIGHT);g.drawCenteredString(font,"Aa",left+w/2,y+14,CirrusTheme.DARK.text);g.drawCenteredString(font,"Midnight glass",left+w/2,y+42,CirrusTheme.DARK.text);g.drawCenteredString(font,"Aa",right+w/2,y+14,CirrusTheme.LIGHT.text);g.drawCenteredString(font,"Frost glass",right+w/2,y+42,CirrusTheme.LIGHT.text);super.render(g,mx,my,d);}
 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
