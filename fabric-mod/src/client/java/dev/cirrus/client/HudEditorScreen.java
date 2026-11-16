package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.mod.HudElement;
import dev.cirrus.client.mod.HudElementRegistry;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import dev.cirrus.client.ui.CirrusButton;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

/** Generic editor: every registered HUD element is selectable, toggleable and draggable. */
public final class HudEditorScreen extends Screen {
 private final Screen parent; private String selected=""; private boolean dragging; private int dragDx,dragDy;
 public HudEditorScreen(Screen parent){super(Component.literal("Cirrus HUD Editor"));this.parent=parent;}
 protected void init(){int panel=Math.min(176,Math.max(126,width/3));int y=52,w=panel-22;var cfg=config();
  for(HudElement e:HudElementRegistry.all()){
   int row=y;
   int toggleW=44;
   addRenderableWidget(CirrusButton.of(10,row,Math.max(64,w-toggleW-4),22,Component.literal((e.id().equals(selected)?"◆  ":"   ")+e.label()),b->{selected=e.id();rebuildWidgets();}));
   addRenderableWidget(CirrusButton.of(10+Math.max(64,w-toggleW-4)+4,row,toggleW,22,Component.literal(e.enabled(cfg)?"ON":"OFF"),b->{e.setEnabled(cfg,!e.enabled(cfg));b.setMessage(Component.literal(e.enabled(cfg)?"ON":"OFF"));}));y+=27;
  }
  addRenderableWidget(CirrusButton.of(10,height-34,w,22,Component.literal("Back"),b->minecraft.setScreen(parent)));
 }
 public void render(GuiGraphics g,int mx,int my,float d){renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());CirrusUi.backdrop(g,width,height,t);int rail=Math.min(176,Math.max(126,width/3));CirrusUi.panel(g,8,8,width-16,height-16,18,t);CirrusUi.panel(g,14,14,rail-20,height-28,16,t);CirrusUi.brand(g,20,20,22,t);g.drawString(font,"HUD ELEMENTS",18,53,t.cyan,true);g.drawString(font,"Drag elements to position them",rail+18,18,t.text,true);g.drawString(font,"Positions save automatically per instance",rail+18,32,t.muted);
  int sw=minecraft.getWindow().getGuiScaledWidth(),sh=minecraft.getWindow().getGuiScaledHeight();
  for(HudElement e:HudElementRegistry.all())if(e.enabled(config())){int x=e.x(config(),sw),y=e.y(config(),sh);e.render(g,x,y,0,config());CirrusUi.outline(g,x-3,y-3,e.width()+6,e.height()+6,6,e.id().equals(selected)?t.cyan:t.border);if(e.id().equals(selected)){CirrusUi.panel(g,rail+8,56,Math.min(160,width-rail-24),34,9,t);g.drawString(font,e.label(),rail+16,63,t.text,true);g.drawString(font,"X "+x+"   Y "+y,rail+16,76,t.muted);}}
  super.render(g,mx,my,d);
 }
 public boolean mouseClicked(MouseButtonEvent event,boolean doubleClick){
  if(super.mouseClicked(event,doubleClick))return true;
  if(event.button()!=0)return false;
  int sw=minecraft.getWindow().getGuiScaledWidth(),sh=minecraft.getWindow().getGuiScaledHeight();
  int rail=Math.min(176,Math.max(126,width/3));
  if(!selected.isEmpty()&&event.x()>=rail){var chosen=HudElementRegistry.find(selected);if(chosen.isPresent()){HudElement e=chosen.get();dragging=true;dragDx=e.width()/2;dragDy=e.height()/2;e.setPosition(config(),(int)event.x()-dragDx,(int)event.y()-dragDy,sw,sh);setDragging(true);return true;}}
  for(HudElement e:HudElementRegistry.all())if(e.enabled(config())){int x=e.x(config(),sw),y=e.y(config(),sh);if(event.x()>=x-3&&event.x()<=x+e.width()+3&&event.y()>=y-3&&event.y()<=y+e.height()+3){selected=e.id();dragging=true;dragDx=(int)event.x()-x;dragDy=(int)event.y()-y;setDragging(true);return true;}}
  return false;
 }
 public boolean mouseDragged(MouseButtonEvent event,double dx,double dy){
  if(!dragging)return super.mouseDragged(event,dx,dy);
  HudElementRegistry.find(selected).ifPresent(e->e.setPosition(config(),(int)event.x()-dragDx,(int)event.y()-dragDy,minecraft.getWindow().getGuiScaledWidth(),minecraft.getWindow().getGuiScaledHeight()));return true;
 }
 public boolean mouseReleased(MouseButtonEvent event){dragging=false;setDragging(false);return super.mouseReleased(event);}
 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
