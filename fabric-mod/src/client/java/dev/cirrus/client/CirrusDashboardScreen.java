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

 private record Frame(int rail,int contentX,int top){
  static Frame of(int width){int rail=Math.min(158,Math.max(132,width/3));return new Frame(rail,rail+26,16);}
 }

 protected void init(){
  Frame f=Frame.of(width);
  addRenderableWidget(CirrusButton.rail(18,52,f.rail-28,22,Component.literal("Mods"),CirrusUi.ICON_MODS,false,b->minecraft.setScreen(new CirrusMenuScreen(this))));
  addRenderableWidget(CirrusButton.rail(18,80,f.rail-28,22,Component.literal("HUD Editor"),CirrusUi.ICON_HUD,false,b->minecraft.setScreen(new HudEditorScreen(this))));
  addRenderableWidget(CirrusButton.rail(18,108,f.rail-28,22,Component.literal("Themes"),CirrusUi.ICON_THEMES,false,b->minecraft.setScreen(new CirrusThemesScreen(this))));
  addRenderableWidget(CirrusButton.rail(18,136,f.rail-28,22,Component.literal("Settings"),CirrusUi.ICON_SETTINGS,false,b->minecraft.setScreen(new OptionsScreen(this,minecraft.options))));
  addRenderableWidget(CirrusButton.of(18,height-36,f.rail-28,22,Component.literal("Close"),b->minecraft.setScreen(parent)));
 }

 public void render(GuiGraphics g,int mx,int my,float d){
  renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());CirrusUi.page(g,width,height,t);
  Frame f=Frame.of(width);

  // the rail and the content share one page, divided by a hairline
  g.fill(f.rail+8,f.top+2,f.rail+9,height-18,t.border);
  g.fill(16,54,width-16,55,t.border);

  CirrusUi.brand(g,20,18,20,t);
  CirrusUi.headingText(g,font,"DASHBOARD",f.contentX,20,t.text);
  CirrusUi.smallText(g,font,"INSTANCE AND GAME",f.contentX,36,t.cyan,false);

  int w=width-f.contentX-20;
  CirrusUi.section(g,f.contentX,74,w,"YOUR GAME",t);
  row(g,font,f.contentX,104,w,"MINECRAFT","Minecraft  "+Minecraft.getInstance().getLaunchedVersion(),t);
  row(g,font,f.contentX,142,w,"INSTANCE",Minecraft.getInstance().gameDirectory.toPath().toString(),t);
  row(g,font,f.contentX,180,w,"APPEARANCE","Theme  "+(t.name().equals("LIGHT")?"Frost":"Midnight"),t);
  super.render(g,mx,my,d);
 }

 private static void row(GuiGraphics g,Font font,int x,int y,int w,String label,String value,CirrusTheme t){
  CirrusUi.smallText(g,font,label,x,y,t.muted,false);
  CirrusUi.text(g,font,CirrusUi.fit(font,value,w,false),x,y+15,t.text,true);
  g.fill(x,y+31,x+w,y+32,t.border);
 }

 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
