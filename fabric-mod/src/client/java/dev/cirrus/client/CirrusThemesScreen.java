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

 /** Short windows get a lower, shallower preview pair so both controls still fit on the page. */
 private boolean compact(){return height<260;}
 private int tileW(){return Math.min(190,Math.max(90,(width-64)/2));}
 private int tileY(){return compact()?48:52;}
 private int tileH(){return compact()?54:78;}
 private int choiceY(){return tileY()+tileH()+(compact()?8:10);}
 private int backY(){return choiceY()+(compact()?26:32);}

 protected void init(){
  int w=tileW(), left=Math.max(6,width/2-w-6), right=left+w+12, y=choiceY();
  addRenderableWidget(CirrusButton.of(left,y,w,22,Component.literal("Dark  ·  Midnight"),b->CirrusTheme.set(config(),CirrusTheme.DARK)));
  addRenderableWidget(CirrusButton.of(right,y,w,22,Component.literal("Light  ·  Frost"),b->CirrusTheme.set(config(),CirrusTheme.LIGHT)));
  addRenderableWidget(CirrusButton.of(width/2-70,backY(),140,22,Component.literal("Back"),b->minecraft.setScreen(parent)));
 }

 public void render(GuiGraphics g,int mx,int my,float d){
  renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());CirrusUi.page(g,width,height,t);

  CirrusUi.centeredHeading(g,font,"APPEARANCE",width/2,22,t.text);
  g.fill(20,44,width-20,45,t.border);

  int w=tileW(), h=tileH(), y=tileY();
  int left=Math.max(6,width/2-w-6), right=left+w+12;
  CirrusUi.panel(g,left,y,w,h,12,CirrusTheme.DARK);CirrusUi.panel(g,right,y,w,h,12,CirrusTheme.LIGHT);
  CirrusUi.centeredHeading(g,font,"Aa",left+w/2,y+16,CirrusTheme.DARK.text);
  CirrusUi.centeredSmall(g,font,"Cirrus Client",left+w/2,y+46,CirrusTheme.DARK.muted);
  CirrusUi.centeredHeading(g,font,"Aa",right+w/2,y+16,CirrusTheme.LIGHT.text);
  CirrusUi.centeredSmall(g,font,"Cirrus Client",right+w/2,y+46,CirrusTheme.LIGHT.muted);

  // the chosen appearance gets one short white rule, not a filled tile
  if(t==CirrusTheme.DARK)g.fill(left,y+h+3,left+w,y+h+5,t.accent);
  else g.fill(right,y+h+3,right+w,y+h+5,t.accent);
  super.render(g,mx,my,d);
 }

 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
