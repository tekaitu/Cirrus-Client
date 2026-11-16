package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusButton;
import dev.cirrus.client.ui.CirrusTheme;
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
 public void render(GuiGraphics g,int mx,int my,float d){renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());g.fill(0,0,width,height,t.overlay);g.fill(0,0,134,height,t.surface);g.fill(133,0,134,height,t.border);CirrusWelcomeScreen.brand(g,31,22,t);g.drawString(font,"CIRRUS",54,17,t.text);g.drawString(font,"DASHBOARD",Math.max(140,width/4),30,t.cyan);int x=Math.max(140,width/4);g.drawString(font,"Minecraft  "+Minecraft.getInstance().getLaunchedVersion(),x,height/2-64,t.text);g.drawString(font,"Instance",x,height/2+74,t.muted);g.drawString(font,Minecraft.getInstance().gameDirectory.toPath().toString(),x,height/2+88,t.text);g.drawString(font,"Theme  "+t.name(),x,height/2+108,t.muted);super.render(g,mx,my,d);}
 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
