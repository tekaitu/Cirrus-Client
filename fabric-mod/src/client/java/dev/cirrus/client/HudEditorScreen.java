package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.mod.HudElement;
import dev.cirrus.client.mod.HudElementRegistry;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Stage 1 HUD registry browser; Stage 2 adds canvas manipulation for every registered element. */
public final class HudEditorScreen extends Screen {
 private final Screen parent;
 public HudEditorScreen(Screen parent){super(Component.literal("Cirrus HUD Editor"));this.parent=parent;}
 protected void init(){int x=Math.max(12,width/8),y=48,w=Math.min(240,width-24);var cfg=config();
  for(HudElement element:HudElementRegistry.all()){
   int row=y;
   addRenderableWidget(Button.builder(Component.literal(element.label()+": "+(element.enabled(cfg)?"ON":"OFF")),b->{element.setEnabled(cfg,!element.enabled(cfg));rebuildWidgets();}).bounds(x,row,w,22).build());
   y+=28;
  }
  addRenderableWidget(Button.builder(Component.literal("Back"),b->minecraft.setScreen(parent)).bounds(Math.max(12,width/2-60),height-34,120,22).build());
 }
 public void render(GuiGraphics g,int mx,int my,float d){renderBackground(g,mx,my,d);g.fill(0,0,width,height,0xBB080D18);g.fill(12,12,width-12,38,0xD8101724);g.drawString(font,"HUD ELEMENTS",22,22,0xFF42C8F5);super.render(g,mx,my,d);}
 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
