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

/**
 * The Cirrus mod library.
 *
 * One open page: a quiet rail, a single hairline, and an editorial list of
 * mods. Geometry lives in {@link Frame}, so the row that is drawn is the row
 * that is clicked.
 */
public final class CirrusMenuScreen extends Screen {
 private final Screen parent; private ModCategory category=ModCategory.ALL; private String query=""; private boolean favoritesOnly;
 private EditBox search; private int scroll;
 public CirrusMenuScreen(Screen parent){super(Component.literal("Cirrus Client"));this.parent=parent;}

 /** Everything the renderer and the hit-tester need, in one place. */
 private record Frame(int rail,int left,int right,int top,int toolbar,int gridTop,int gridBottom,int cardW,int cardH){
  static Frame of(int width,int height){
   int rail=Math.min(146,Math.max(120,width/5));
   int left=14+rail+18, right=width-18, top=16;
   int cardW=Math.max(140,right-left), cardH=58;
   return new Frame(rail,left,right,top,top+52,top+82,height-40,cardW,cardH);
  }
  int contentWidth(){return right-left;}
  int rowStep(){return cardH;}
 }

 protected void init(){
  Frame f=Frame.of(width,height);
  addRenderableWidget(CirrusButton.rail(f.right-28,f.top+2,22,22,Component.literal(""),CirrusUi.ICON_BACK,false,b->minecraft.setScreen(parent)));
  search=new EditBox(font,f.left+28,f.toolbar+5,Math.max(50,f.contentWidth()-170),14,Component.literal("Search mods"));
  search.setBordered(false);search.setTextShadow(true);search.addFormatter((value,cursor)->CirrusUi.formatSearch(value));
  search.setHint(CirrusUi.small("Search mods…"));search.setValue(query);search.setResponder(v->{query=v;scroll=0;});
  addRenderableWidget(search);
  addRenderableWidget(CirrusButton.of(f.right-134,f.toolbar,124,22,Component.literal(favoritesOnly?"★ Favorites only":"☆ Favorites only"),b->{favoritesOnly=!favoritesOnly;scroll=0;rebuildWidgets();}));

  int y=f.top+78;
  addRenderableWidget(CirrusButton.rail(14,y,f.rail-8,24,Component.literal("All mods"),CirrusUi.ICON_LIBRARY,category==ModCategory.ALL,b->select(ModCategory.ALL)));y+=27;
  for(ModCategory c:ModCategory.values()){
   if(c==ModCategory.ALL)continue;
   if(ModRegistry.all().stream().noneMatch(m->m.category()==c))continue;
   if(y+24>height-120)break; // a short window keeps the rail buttons apart
   addRenderableWidget(CirrusButton.rail(14,y,f.rail-8,24,Component.literal(c.label),categoryIcon(c),category==c,b->select(c)));y+=27;
  }
  addRenderableWidget(CirrusButton.rail(14,height-114,f.rail-8,24,Component.literal("HUD Editor"),CirrusUi.ICON_HUD,false,b->minecraft.setScreen(new HudEditorScreen(this))));
  addRenderableWidget(CirrusButton.rail(14,height-86,f.rail-8,24,Component.literal("Themes"),CirrusUi.ICON_THEMES,false,b->minecraft.setScreen(new CirrusThemesScreen(this))));
  addRenderableWidget(CirrusButton.rail(14,height-58,f.rail-8,24,Component.literal("Settings"),CirrusUi.ICON_SETTINGS,false,b->minecraft.setScreen(new OptionsScreen(this,minecraft.options))));
  addRenderableWidget(CirrusButton.of(14,height-30,f.rail-8,22,Component.literal("Done"),b->minecraft.setScreen(parent)));
 }

 private void select(ModCategory choice){category=choice;scroll=0;rebuildWidgets();}

 public void render(GuiGraphics g,int mx,int my,float d){
  renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());CirrusUi.page(g,width,height,t);
  Frame f=Frame.of(width,height);

  // one page, split by a single rule; nothing is wrapped in a panel
  g.fill(f.rail+8,f.top+2,f.rail+9,height-18,t.border);
  g.fill(f.left,f.top+46,f.right,f.top+47,t.border);

  CirrusUi.brand(g,20,f.top+2,20,t);
  CirrusUi.headingText(g,font,"MOD LIBRARY",f.left,f.top+3,t.text);
  List<CirrusMod> entries=filtered();
  CirrusUi.smallText(g,font,category.label.toUpperCase(Locale.ROOT)+"  ·  "+entries.size()+" AVAILABLE",f.left,f.top+20,t.cyan,false);

  String theme=t.name().equals("LIGHT")?"FROST":"MIDNIGHT";
  CirrusUi.smallText(g,font,theme,f.right-44-font.width(CirrusUi.small(theme)),f.top+8,t.muted,false);

  // search is a line, not a box
  int searchRight=Math.max(f.left+40,f.right-142);
  g.fill(f.left,f.toolbar+23,searchRight,f.toolbar+24,t.border);
  CirrusUi.icon(g,f.left,f.toolbar+4,14,CirrusUi.ICON_SEARCH,t.cyan);

  // rail caption
  CirrusUi.smallText(g,font,"LIBRARY",20,f.top+52,t.muted,false);
  g.fill(20,f.top+63,44,f.top+64,t.accent);

  // mod rows: icon, words, state, one hairline each
  g.enableScissor(f.left,f.gridTop,f.right,Math.max(f.gridTop,f.gridBottom));
  int idx=0;
  for(CirrusMod m:entries){
   int y=f.gridTop+idx*f.rowStep()-scroll;
   idx++;
   if(y+f.cardH<f.gridTop||y>f.gridBottom)continue;
   boolean hover=mx>=f.left&&mx<f.right&&my>=y&&my<y+f.cardH;
   g.fill(f.left,y,f.right,y+1,t.border);
   if(hover)g.fill(f.left+1,y+8,f.left+3,y+f.cardH-8,t.accent);
   CirrusUi.icon(g,f.left+5,y+19,20,categoryIcon(m.category()),hover?t.text:t.cyan);
   int textX=f.left+34, textW=Math.max(40,f.cardW-34-80);
   CirrusUi.headingText(g,font,CirrusUi.fit(font,m.name(),textW,false),textX,y+9,t.text);
   CirrusUi.smallText(g,font,m.category().label,textX,y+23,t.cyan,false);
   CirrusUi.smallText(g,font,CirrusUi.fit(font,m.description(),textW,true),textX,y+36,t.muted,false);
   boolean on=m.enabled(config()), fav=m.favorite(config());
   CirrusUi.icon(g,f.right-64,y+10,13,CirrusUi.ICON_FAVORITE,fav?t.text:t.muted);
   String state=on?"ON":"OFF";int stateW=font.width(CirrusUi.small(state));
   CirrusUi.smallText(g,font,state,f.right-10-stateW,y+11,on?t.text:t.muted,false);
   if(m.hasSettings()){String more="SETTINGS  ›";int moreW=font.width(CirrusUi.small(more));CirrusUi.smallText(g,font,more,f.right-10-moreW,y+30,t.muted,false);}
  }
  g.disableScissor();

  if(entries.isEmpty()){
   int artW=Math.min(190,f.contentWidth()-24),artH=114;
   CirrusUi.emptyLibrary(g,f.left+(f.contentWidth()-artW)/2,f.gridTop+16,artW,artH);
   CirrusUi.centeredSmall(g,font,"No registered mods match these filters.",f.left+f.contentWidth()/2,f.gridTop+artH+30,t.muted);
  }

  // footer: where you are and how to leave
  CirrusUi.smallText(g,font,"SCROLL TO BROWSE  ·  RIGHT SHIFT TO CLOSE",f.left,f.gridBottom+10,t.muted,false);
  super.render(g,mx,my,d);
 }

 public boolean mouseClicked(MouseButtonEvent event,boolean doubleClick){
  double mx=event.x(),my=event.y();int button=event.button();
  Frame f=Frame.of(width,height);
  if(button==0&&mx>=f.left&&mx<f.right&&my>=f.gridTop&&my<=f.gridBottom){
   int row=(int)((my-f.gridTop+scroll)/f.rowStep());
   var list=filtered();
   if(row>=0&&row<list.size()){
    var mod=list.get(row);
    int cardY=f.gridTop+row*f.rowStep()-scroll;
    // The star and the ON/OFF text sit on the top row; the rest of the row opens its settings.
    if(my<cardY+30&&mx>=f.right-52){mod.setEnabled(config(),!mod.enabled(config()));return true;}
    if(my<cardY+30&&mx>=f.right-72){mod.setFavorite(config(),!mod.favorite(config()));return true;}
    if(mod.hasSettings())mod.openSettings(this);
    return true;
   }
  }
  return super.mouseClicked(event,doubleClick);
 }

 public boolean mouseScrolled(double x,double y,double h,double v){scroll=Math.max(0,Math.min(maxScroll(),scroll-(int)(v*26)));return true;}

 private int maxScroll(){Frame f=Frame.of(width,height);int content=filtered().size()*f.rowStep();return Math.max(0,content-(f.gridBottom-f.gridTop)+2);}
 private int categoryIcon(ModCategory value){return switch(value){case ALL->CirrusUi.ICON_LIBRARY;case HUD->CirrusUi.ICON_HUD;case PVP->CirrusUi.ICON_PVP;case VISUALS->CirrusUi.ICON_VISUALS;case PERFORMANCE->CirrusUi.ICON_PERFORMANCE;case UTILITY->CirrusUi.ICON_UTILITY;case INTERFACE->CirrusUi.ICON_SETTINGS;};}
 private List<CirrusMod> filtered(){return ModRegistry.all().stream().filter(m->category==ModCategory.ALL||m.category()==category).filter(m->!favoritesOnly||m.favorite(config())).filter(m->(m.name()+" "+m.description()).toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT))).toList();}
 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
