package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.mod.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;
import java.util.*;

/** Responsive registry-backed Cirrus mod library. */
public final class CirrusMenuScreen extends Screen {
 private final Screen parent; private ModCategory category=ModCategory.ALL; private String query=""; private boolean favoritesOnly;
 private EditBox search; private int scroll;
 public CirrusMenuScreen(Screen parent){super(Component.literal("Cirrus Client"));this.parent=parent;}
 protected void init(){
  int rail=Math.min(104,Math.max(74,width/5)); int left=12+rail+10; int content=Math.max(120,width-left-14);
  addRenderableWidget(Button.builder(Component.literal("‹"),b->minecraft.setScreen(parent)).bounds(10,10,32,20).build());
  search=new EditBox(font,left,34,content,20,Component.literal("Search mods"));search.setValue(query);search.setResponder(v->query=v);addRenderableWidget(search);
  int y=64; for(ModCategory c:ModCategory.values()){final ModCategory choice=c; if(c==ModCategory.ALL||ModRegistry.all().stream().anyMatch(m->m.category()==c)){
   addRenderableWidget(Button.builder(Component.literal((category==c?"◆  ":"   ")+c.label),b->{category=choice;scroll=0;rebuildWidgets();}).bounds(10,y,rail,22).build());y+=25;}}
  addRenderableWidget(Button.builder(Component.literal(favoritesOnly?"★ Favorites":"☆ Favorites"),b->{favoritesOnly=!favoritesOnly;rebuildWidgets();}).bounds(left,10,Math.min(110,content),20).build());
  addRenderableWidget(Button.builder(Component.literal("Minecraft settings"),b->minecraft.setScreen(new OptionsScreen(this,minecraft.options))).bounds(Math.max(left,width-150),10,140,20).build());
  addRenderableWidget(Button.builder(Component.literal("HUD Editor"),b->minecraft.setScreen(new HudEditorScreen(this))).bounds(left,Math.max(86,height-34),Math.min(120,content),22).build());
  addRenderableWidget(Button.builder(Component.literal("Done"),b->minecraft.setScreen(parent)).bounds(Math.max(left+content-70,left),Math.max(86,height-34),70,22).build());
 }
 public void render(GuiGraphics g,int mx,int my,float d){
  renderBackground(g,mx,my,d);g.fill(0,0,width,height,0xBB080D18);g.fill(0,0,width,30,0xE6101724);
  g.drawString(font,"CIRRUS",12,15,0xFFF2F5FF);g.drawString(font,"MOD LIBRARY",Math.min(120,width/4),15,0xFF42C8F5);
  int rail=Math.min(104,Math.max(74,width/5)),left=22+rail, right=width-12, y=61;
  List<CirrusMod> entries=ModRegistry.all().stream().filter(m->category==ModCategory.ALL||m.category()==category).filter(m->!favoritesOnly||m.favorite(config())).filter(m->(m.name()+" "+m.description()).toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT))).toList();
  int cardW=Math.max(110,right-left), cardH=55, gap=7;g.drawString(font,category.label+"  /  "+entries.size()+" available",left,y,0xFF9CAABD); y+=17;
  g.enableScissor(left,y,right,Math.max(y,height-38)); int idx=0;
  for(CirrusMod m:entries){int cy=y+idx*(cardH+gap)-scroll;if(cy+cardH<y||cy>height-38){idx++;continue;}
   g.fill(left,cy,right,cy+cardH,0xD8101724);g.renderOutline(left,cy,cardW,cardH,0x285B98DE);
   // Compact bespoke glyph tile with accent strokes; no external texture dependencies.
   int ax=left+7,ay=cy+9;g.fill(ax,ay,ax+28,ay+28,0x44368BFF);g.renderOutline(ax,ay,28,28,0x805B98DE);g.fill(ax+7,ay+7,ax+21,ay+9,0xFF42C8F5);g.fill(ax+7,ay+13,ax+17,ay+15,0xFF7BB4FF);g.fill(ax+7,ay+19,ax+19,ay+21,0xFF42C8F5);
   int tx=left+42;g.drawString(font,m.name(),tx,cy+7,0xFFF2F5FF);g.drawString(font,m.category().label,tx,cy+19,0xFF42C8F5);g.drawString(font,Component.literal(m.description()),tx,cy+32,0xFFB9C5D8);
   g.drawString(font,m.favorite(config())?"★":"☆",right-49,cy+9,0xFFF5B942);
   g.drawString(font,m.enabled(config())?"ON":"OFF",right-22,cy+9,m.enabled(config())?0xFF3DDC97:0xFF929DB2);
   if(m.hasSettings())g.drawString(font,"SETTINGS  ›",right-75,cy+34,0xFF7BB4FF);
   idx++;
  }
  g.disableScissor();if(entries.isEmpty())g.drawCenteredString(font,"No registered mods match these filters.",(left+right)/2,y+28,0xFF929DB2);
  super.render(g,mx,my,d);
 }
 public boolean mouseClicked(MouseButtonEvent event,boolean doubleClick){
  double mx=event.x(),my=event.y();int button=event.button();
  int rail=Math.min(104,Math.max(74,width/5)),left=22+rail,right=width-12,y=78,cardH=55,gap=7;
  if(button==0&&mx>=left&&mx<right&&my>=y){int row=(int)(my-y+scroll)/(cardH+gap);var list=filtered();if(row>=0&&row<list.size()){var mod=list.get(row);int cardTop=y+row*(cardH+gap)-scroll;
   if(mx>right-30){if(my<cardTop+23)mod.setEnabled(config(),!mod.enabled(config()));else mod.setFavorite(config(),!mod.favorite(config()));return true;}
   if(mod.hasSettings())mod.openSettings(this);return true;}}
  return super.mouseClicked(event,doubleClick);
 }
 public boolean mouseScrolled(double x,double y,double h,double v){scroll=Math.max(0,scroll-(int)(v*22));return true;}
 private List<CirrusMod> filtered(){return ModRegistry.all().stream().filter(m->category==ModCategory.ALL||m.category()==category).filter(m->!favoritesOnly||m.favorite(config())).filter(m->(m.name()+" "+m.description()).toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT))).toList();}
 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
