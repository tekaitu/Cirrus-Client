package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusButton;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.network.chat.Component;

/** Click GUI landing page with live instance and game information. */
public final class CirrusDashboardScreen extends Screen {
 private final Screen parent;
 public CirrusDashboardScreen(Screen parent){super(Component.literal("Cirrus Dashboard"));this.parent=parent;}
 protected void init(){int x=Math.max(140,width/4),w=Math.min(230,width-x-24),y=height/2-12;
  addRenderableWidget(CirrusButton.nav(18,45,112,22,Component.literal("Mods"),CirrusUi.ICON_MODS,b->minecraft.setScreen(new CirrusMenuScreen(this))));
  addRenderableWidget(CirrusButton.nav(18,73,112,22,Component.literal("HUD Editor"),CirrusUi.ICON_HUD,b->minecraft.setScreen(new HudEditorScreen(this))));
  addRenderableWidget(CirrusButton.nav(18,101,112,22,Component.literal("Themes"),CirrusUi.ICON_THEMES,b->minecraft.setScreen(new CirrusThemesScreen(this))));
  addRenderableWidget(CirrusButton.nav(18,129,112,22,Component.literal("Settings"),CirrusUi.ICON_SETTINGS,b->minecraft.setScreen(new OptionsScreen(this,minecraft.options))));
  addRenderableWidget(CirrusButton.of(18,height-34,112,22,Component.literal("Close"),b->minecraft.setScreen(parent)));
  addRenderableWidget(CirrusButton.nav(x,y,w,24,Component.literal("Open Mods Library  ›"),CirrusUi.ICON_MODS,b->minecraft.setScreen(new CirrusMenuScreen(this))));
  addRenderableWidget(CirrusButton.nav(x,y+34,w,24,Component.literal("Edit HUD  ›"),CirrusUi.ICON_HUD,b->minecraft.setScreen(new HudEditorScreen(this))));
 }
 public void render(GuiGraphics g,int mx,int my,float d){
  var t=CirrusTheme.current(config());
  CirrusUi.panel(g,8,8,width-16,height-16,18,t);CirrusUi.panel(g,14,14,134,height-28,16,t);CirrusUi.brand(g,25,21,28,t);
  int headerX=Math.max(158,width/4);CirrusUi.panel(g,headerX,16,Math.max(120,width-headerX-20),36,12,t);CirrusUi.headingText(g,font,"DASHBOARD",headerX+16,27,t.cyan);
  int x=Math.max(174,width/4+12);CirrusUi.panel(g,x-12,height/2-82,Math.max(140,width-x-24),166,16,t);
  CirrusUi.section(g,x,height/2-64,Math.max(120,width-x-48),"YOUR GAME",t);
  CirrusUi.text(g,font,"Minecraft  "+Minecraft.getInstance().getLaunchedVersion(),x,height/2-40,t.text,true);
  CirrusUi.smallText(g,font,"Instance",x,height/2+52,t.muted,false);
  CirrusUi.smallText(g,font,Minecraft.getInstance().gameDirectory.toPath().toString(),x,height/2+66,t.text,false);
  CirrusUi.smallText(g,font,"Theme  "+t.name(),x,height/2+88,t.muted,false);super.render(g,mx,my,d);
 }
 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}

 @Override public void renderBackground(GuiGraphics bg,int bmx,int bmy,float bd){CirrusUi.dashboardBackdrop(bg,width,height,CirrusTheme.current(CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath())));}
}

