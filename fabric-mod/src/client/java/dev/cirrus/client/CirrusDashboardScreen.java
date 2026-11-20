package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusButton;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.network.chat.Component;

/** Click GUI landing page with live instance and game information. */
public final class CirrusDashboardScreen extends Screen {
 private final Screen parent;
 public CirrusDashboardScreen(Screen parent){super(Component.literal("Cirrus Dashboard"));this.parent=parent;}

 /**
  * The rail is anchored to the bottom, so the links and Close never meet in a
  * short window, and the page rows tighten instead of running past the edge.
  */
 private record Frame(int rail,int contentX,int top,int navH,int navStep,int closeY,int closeH,int rowTop,int rowStep,int rowH,int sectionY,boolean compact){
  static Frame of(int width,int height){
   int rail=Math.min(158,Math.max(132,width/3));
   boolean compact=height<300;
   int navH=compact?20:22, navStep=compact?21:28, closeH=compact?18:22, margin=compact?6:8;
   int closeY=height-margin-closeH;
   return new Frame(rail,rail+26,16,navH,navStep,closeY,closeH,compact?88:104,compact?28:38,compact?24:32,compact?68:74,compact);
  }
 }

 protected void init(){
  Frame f=Frame.of(width,height);
  int y=52;
  addRenderableWidget(CirrusButton.rail(18,y,f.rail-28,f.navH(),Component.literal("Mods"),CirrusUi.ICON_MODS,false,b->minecraft.setScreen(new CirrusMenuScreen(this))));y+=f.navStep();
  addRenderableWidget(CirrusButton.rail(18,y,f.rail-28,f.navH(),Component.literal("HUD Editor"),CirrusUi.ICON_HUD,false,b->minecraft.setScreen(new HudEditorScreen(this))));y+=f.navStep();
  addRenderableWidget(CirrusButton.rail(18,y,f.rail-28,f.navH(),Component.literal("Themes"),CirrusUi.ICON_THEMES,false,b->minecraft.setScreen(new CirrusThemesScreen(this))));y+=f.navStep();
  addRenderableWidget(CirrusButton.rail(18,y,f.rail-28,f.navH(),Component.literal("Settings"),CirrusUi.ICON_SETTINGS,false,b->minecraft.setScreen(new OptionsScreen(this,minecraft.options))));
  addRenderableWidget(CirrusButton.of(18,f.closeY(),f.rail-28,f.closeH(),Component.literal("Close"),b->minecraft.setScreen(parent)));
 }

 public void render(GuiGraphics g,int mx,int my,float d){
  renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());CirrusUi.page(g,width,height,t);
  Frame f=Frame.of(width,height);

  // the rail and the content share one page, divided by a hairline
  g.fill(f.rail+8,f.top+2,f.rail+9,height-18,t.border);
  g.fill(16,54,width-16,55,t.border);

  CirrusUi.brand(g,20,18,20,t);
  CirrusUi.headingText(g,font,"DASHBOARD",f.contentX,20,t.text);
  CirrusUi.smallText(g,font,"INSTANCE AND GAME",f.contentX,36,t.cyan,false);

  int w=width-f.contentX-20;
  CirrusUi.section(g,f.contentX,f.sectionY,w,"YOUR GAME",t);
  int rowY=f.rowTop();
  row(g,font,f.contentX,rowY,w,"MINECRAFT","Minecraft  "+Minecraft.getInstance().getLaunchedVersion(),t,f.compact());rowY+=f.rowStep();
  if(rowY+f.rowH()<=height-6){row(g,font,f.contentX,rowY,w,"INSTANCE",Minecraft.getInstance().gameDirectory.toPath().toString(),t,f.compact());rowY+=f.rowStep();}
  if(rowY+f.rowH()<=height-6)row(g,font,f.contentX,rowY,w,"APPEARANCE","Theme  "+(t.name().equals("LIGHT")?"Frost":"Midnight"),t,f.compact());
  super.render(g,mx,my,d);
 }

 private static void row(GuiGraphics g,Font font,int x,int y,int w,String label,String value,CirrusTheme t,boolean compact){
  int valueOffset=compact?10:15, ruleOffset=compact?22:31;
  CirrusUi.smallText(g,font,label,x,y,t.muted,false);
  CirrusUi.text(g,font,CirrusUi.fit(font,value,w,false),x,y+valueOffset,t.text,true);
  g.fill(x,y+ruleOffset,x+w,y+ruleOffset+1,t.border);
 }

 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
