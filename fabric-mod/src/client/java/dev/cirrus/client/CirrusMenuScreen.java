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
import dev.cirrus.client.ui.CirrusUi;

/** Responsive registry-backed Cirrus mod library. */
public final class CirrusMenuScreen extends Screen {
 private final Screen parent; private ModCategory category=ModCategory.ALL; private String query=""; private boolean favoritesOnly;
 private EditBox search; private int scroll;
 public CirrusMenuScreen(Screen parent){super(Component.literal("Cirrus Client"));this.parent=parent;}
 protected void init(){
  int rail=Math.min(104,Math.max(74,width/5)); int left=12+rail+10; int content=Math.max(120,width-left-14);
  addRenderableWidget(CirrusButton.nav(10,10,32,20,Component.literal(""),CirrusUi.ICON_BACK,b->minecraft.setScreen(parent)));
  search=new EditBox(font,left+10,37,Math.max(50,content-20),16,Component.literal("Search mods"));search.setBordered(false);search.setTextShadow(true);search.addFormatter((value,cursor)->CirrusUi.formatSearch(value));search.setHint(CirrusUi.small("Search mods…"));search.setValue(query);search.setResponder(v->query=v);addRenderableWidget(search);
  addRenderableWidget(CirrusButton.nav(10,38,rail,22,Component.literal("Dashboard"),0,b->minecraft.setScreen(new CirrusDashboardScreen(this))));
  int y=64; for(ModCategory c:ModCategory.values()){final ModCategory choice=c; if(c==ModCategory.ALL||ModRegistry.all().stream().anyMatch(m->m.category()==c)){
   addRenderableWidget(CirrusButton.nav(10,y,rail,22,Component.literal(c.label),categoryIcon(c),b->{category=choice;scroll=0;rebuildWidgets();}));y+=25;}}
  addRenderableWidget(CirrusButton.of(left,10,Math.min(110,content),20,Component.literal(favoritesOnly?"★ Favorites":"☆ Favorites"),b->{favoritesOnly=!favoritesOnly;rebuildWidgets();}));
  addRenderableWidget(CirrusButton.of(Math.max(left,width-150),10,140,20,Component.literal("Minecraft settings"),b->minecraft.setScreen(new OptionsScreen(this,minecraft.options))));
  addRenderableWidget(CirrusButton.of(left,Math.max(86,height-34),Math.min(120,content),22,Component.literal("HUD Editor"),b->minecraft.setScreen(new HudEditorScreen(this))));
  addRenderableWidget(CirrusButton.nav(10,Math.max(92,height-64),rail,22,Component.literal("Themes"),3,b->minecraft.setScreen(new CirrusThemesScreen(this))));
  addRenderableWidget(CirrusButton.of(Math.max(left+content-70,left),Math.max(86,height-34),70,22,Component.literal("Done"),b->minecraft.setScreen(parent)));
 }
 public void render(GuiGraphics g,int mx,int my,float d){
  renderBackground(g,mx,my,d);var theme=CirrusTheme.current(config());CirrusUi.backdrop(g,width,height,theme);
  int rail=Math.min(104,Math.max(74,width/5)),left=22+rail, right=width-12, y=61;
  CirrusUi.panel(g,6,6,width-12,height-12,18,theme);CirrusUi.panel(g,12,12,rail+8,height-24,16,theme);CirrusUi.panel(g,left-8,12,right-left+8,38,13,theme);
  CirrusUi.brand(g,20,17,22,theme);CirrusUi.headingText(g,font,"MOD LIBRARY",left,25,theme.cyan);
  CirrusUi.panel(g,left,34,Math.max(70,right-left),22,9,theme);
  CirrusUi.icon(g,left+6,37,14,CirrusUi.ICON_SEARCH,theme.cyan);
  List<CirrusMod> entries=ModRegistry.all().stream().filter(m->category==ModCategory.ALL||m.category()==category).filter(m->!favoritesOnly||m.favorite(config())).filter(m->(m.name()+" "+m.description()).toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT))).toList();
  int cardW=Math.max(110,right-left), cardH=55, gap=7;CirrusUi.smallText(g,font,category.label+"  /  "+entries.size()+" available",left,y,theme.muted,false); y+=17;
  g.enableScissor(left,y,right,Math.max(y,height-38)); int idx=0;
  for(CirrusMod m:entries){int cy=y+idx*(cardH+gap)-scroll;if(cy+cardH<y||cy>height-38){idx++;continue;}
   boolean hover=mx>=left&&mx<right&&my>=cy&&my<=cy+cardH;CirrusUi.panel(g,left,cy,cardW,cardH,12,theme);if(hover)CirrusUi.outline(g,left,cy,cardW,cardH,12,theme.accent);
   int ax=left+7,ay=cy+9;CirrusUi.rounded(g,ax,ay,28,28,9,theme.glow);CirrusUi.icon(g,ax+3,ay+3,22,categoryIcon(m.category()),theme.cyan);
   int tx=left+42;CirrusUi.headingText(g,font,m.name(),tx,cy+6,theme.text);CirrusUi.smallText(g,font,m.category().label,tx,cy+21,theme.cyan,false);CirrusUi.smallText(g,font,m.description(),tx,cy+34,theme.muted,false);
   CirrusUi.icon(g,right-49,cy+8,16,5,m.favorite(config())?0xFFF5B942:theme.muted);
   CirrusUi.smallText(g,font,m.enabled(config())?"ON":"OFF",right-25,cy+11,m.enabled(config())?0xFF3DDC97:theme.muted,false);
   if(m.hasSettings())CirrusUi.smallText(g,font,"SETTINGS  ›",right-75,cy+36,theme.accent,false);
   idx++;
  }
  g.disableScissor();if(entries.isEmpty()){int artW=Math.min(190,right-left-20),artH=114;CirrusUi.emptyLibrary(g,(left+right-artW)/2,y+20,artW,artH);CirrusUi.centeredSmall(g,font,"No registered mods match these filters.",(left+right)/2,y+artH+34,theme.muted);}
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
 private int categoryIcon(ModCategory value){return switch(value){case ALL->CirrusUi.ICON_LIBRARY;case HUD->CirrusUi.ICON_HUD;case PVP->CirrusUi.ICON_PVP;case VISUALS->CirrusUi.ICON_VISUALS;case PERFORMANCE->CirrusUi.ICON_PERFORMANCE;case UTILITY->CirrusUi.ICON_UTILITY;case INTERFACE->CirrusUi.ICON_SETTINGS;};}
 private List<CirrusMod> filtered(){return ModRegistry.all().stream().filter(m->category==ModCategory.ALL||m.category()==category).filter(m->!favoritesOnly||m.favorite(config())).filter(m->(m.name()+" "+m.description()).toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT))).toList();}
 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}

