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
  addRenderableWidget(CirrusButton.of(18,45,112,22,Component.literal("Mods"),b->minecraft.setScreen(new CirrusMenuScreen(this))));
  addRenderableWidget(CirrusButton.of(18,73,112,22,Component.literal("HUD Editor"),b->minecraft.setScreen(new HudEditorScreen(this))));
  addRenderableWidget(CirrusButton.of(18,101,112,22,Component.literal("Themes"),b->minecraft.setScreen(new CirrusThemesScreen(this))));
  addRenderableWidget(CirrusButton.of(18,129,112,22,Component.literal("Minecraft Settings"),b->minecraft.setScreen(new OptionsScreen(this,minecraft.options))));
  addRenderableWidget(CirrusButton.of(18,height-34,112,22,Component.literal("Close"),b->minecraft.setScreen(parent)));
  addRenderableWidget(CirrusButton.of(x,y,w,24,Component.literal("Open Mods Library  ›"),b->minecraft.setScreen(new CirrusMenuScreen(this))));
  addRenderableWidget(CirrusButton.of(x,y+34,w,24,Component.literal("Edit HUD  ›"),b->minecraft.setScreen(new HudEditorScreen(this))));
 }
 public void render(GuiGraphics g,int mx,int my,float d){renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());CirrusUi.backdrop(g,width,height,t);CirrusUi.panel(g,8,8,width-16,height-16,18,t);CirrusUi.panel(g,14,14,134,height-28,16,t);CirrusUi.brand(g,25,21,28,t);CirrusUi.panel(g,Math.max(158,width/4),16,Math.max(120,width-Math.max(158,width/4)-20),36,12,t);g.drawString(font,"DASHBOARD",Math.max(174,width/4+12),29,t.cyan,true);int x=Math.max(174,width/4+12);CirrusUi.panel(g,x-12,height/2-82,Math.max(140,width-x-24),166,16,t);CirrusUi.section(g,x,height/2-64,Math.max(120,width-x-48),"YOUR GAME",t);g.drawString(font,"Minecraft  "+Minecraft.getInstance().getLaunchedVersion(),x,height/2-40,t.text,true);g.drawString(font,"Instance",x,height/2+52,t.muted);g.drawString(font,Minecraft.getInstance().gameDirectory.toPath().toString(),x,height/2+66,t.text);g.drawString(font,"Theme  "+t.name(),x,height/2+88,t.muted);super.render(g,mx,my,d);}
 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
