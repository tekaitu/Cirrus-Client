package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.mod.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import dev.cirrus.client.ui.CirrusButton;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;
import java.util.*;
import dev.cirrus.client.ui.CirrusTheme;

/** Responsive registry-backed Cirrus mod library. */
public final class CirrusMenuScreen extends Screen {
 private final Screen parent; private ModCategory category=ModCategory.ALL; private String query=""; private boolean favoritesOnly;
 private EditBox search; private int scroll;
 public CirrusMenuScreen(Screen parent){super(Component.literal("Cirrus Client"));this.parent=parent;}
 protected void init(){
  int rail=Math.min(104,Math.max(74,width/5)); int left=12+rail+10; int content=Math.max(120,width-left-14);
  addRenderableWidget(CirrusButton.of(10,10,32,20,Component.literal("‹"),b->minecraft.setScreen(parent)));
  search=new EditBox(font,left,34,content,20,Component.literal("Search mods"));search.setValue(query);search.setResponder(v->query=v);addRenderableWidget(search);
  addRenderableWidget(CirrusButton.of(10,38,rail,22,Component.literal("Dashboard"),b->minecraft.setScreen(new CirrusDashboardScreen(this))));
  int y=64; for(ModCategory c:ModCategory.values()){final ModCategory choice=c; if(c==ModCategory.ALL||ModRegistry.all().stream().anyMatch(m->m.category()==c)){
   addRenderableWidget(CirrusButton.of(10,y,rail,22,Component.literal((category==c?"◆  ":"   ")+c.label),b->{category=choice;scroll=0;rebuildWidgets();}));y+=25;}}
  addRenderableWidget(CirrusButton.of(left,10,Math.min(110,content),20,Component.literal(favoritesOnly?"★ Favorites":"☆ Favorites"),b->{favoritesOnly=!favoritesOnly;rebuildWidgets();}));
  addRenderableWidget(CirrusButton.of(Math.max(left,width-150),10,140,20,Component.literal("Minecraft settings"),b->minecraft.setScreen(new OptionsScreen(this,minecraft.options))));
  addRenderableWidget(CirrusButton.of(left,Math.max(86,height-34),Math.min(120,content),22,Component.literal("HUD Editor"),b->minecraft.setScreen(new HudEditorScreen(this))));
  addRenderableWidget(CirrusButton.of(10,Math.max(92,height-64),rail,22,Component.literal("Themes"),b->minecraft.setScreen(new CirrusThemesScreen(this))));
  addRenderableWidget(CirrusButton.of(Math.max(left+content-70,left),Math.max(86,height-34),70,22,Component.literal("Done"),b->minecraft.setScreen(parent)));
 }
 public void render(GuiGraphics g,int mx,int my,float d){
  renderBackground(g,mx,my,d);var theme=CirrusTheme.current(config());g.fill(0,0,width,height,theme.overlay);g.fill(0,0,width,30,theme.panel);g.fill(0,30,Math.min(width/5,116),height,theme.surface);g.fill(0,29,width,30,theme.border);
  CirrusWelcomeScreen.brand(g,24,15,theme);g.drawString(font,"CIRRUS",48,10,theme.text);g.drawString(font,"MOD LIBRARY",Math.min(150,width/4),15,theme.cyan);
  int rail=Math.min(104,Math.max(74,width/5)),left=22+rail, right=width-12, y=61;
  List<CirrusMod> entries=ModRegistry.all().stream().filter(m->category==ModCategory.ALL||m.category()==category).filter(m->!favoritesOnly||m.favorite(config())).filter(m->(m.name()+" "+m.description()).toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT))).toList();
  int cardW=Math.max(110,right-left), cardH=55, gap=7;g.drawString(font,category.label+"  /  "+entries.size()+" available",left,y,theme.muted); y+=17;
  g.enableScissor(left,y,right,Math.max(y,height-38)); int idx=0;
  for(CirrusMod m:entries){int cy=y+idx*(cardH+gap)-scroll;if(cy+cardH<y||cy>height-38){idx++;continue;}
   boolean hover=mx>=left&&mx<right&&my>=cy&&my<=cy+cardH;g.fill(left,cy,right,cy+cardH,hover?theme.panel:theme.surface);g.renderOutline(left,cy,cardW,cardH,hover?theme.accent:theme.border);
   // Compact bespoke glyph tile with accent strokes; no external texture dependencies.
   int ax=left+7,ay=cy+9;g.fill(ax,ay,ax+28,ay+28,theme.accent);g.renderOutline(ax,ay,28,28,theme.cyan);g.fill(ax+7,ay+7,ax+21,ay+9,theme.text);g.fill(ax+7,ay+13,ax+17,ay+15,theme.text);g.fill(ax+7,ay+19,ax+19,ay+21,theme.text);
   int tx=left+42;g.drawString(font,m.name(),tx,cy+7,theme.text);g.drawString(font,m.category().label,tx,cy+19,theme.cyan);g.drawString(font,Component.literal(m.description()),tx,cy+32,theme.muted);
   g.drawString(font,m.favorite(config())?"★":"☆",right-49,cy+9,0xFFF5B942);
   g.drawString(font,m.enabled(config())?"ON":"OFF",right-22,cy+9,m.enabled(config())?0xFF3DDC97:0xFF929DB2);
   if(m.hasSettings())g.drawString(font,"SETTINGS  ›",right-75,cy+34,theme.accent);
   idx++;
  }
  g.disableScissor();if(entries.isEmpty())g.drawCenteredString(font,"No registered mods match these filters.",(left+right)/2,y+28,theme.muted);
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
