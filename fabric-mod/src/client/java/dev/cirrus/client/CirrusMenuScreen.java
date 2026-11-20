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
 * One shell, one rail, one grid. All geometry comes from {@link Frame}, so the
 * cards that are drawn and the cards that are clicked can never disagree, and
 * the grid folds from two columns to one when the window is narrow.
 */
public final class CirrusMenuScreen extends Screen {
 private final Screen parent; private ModCategory category=ModCategory.ALL; private String query=""; private boolean favoritesOnly;
 private EditBox search; private int scroll;
 public CirrusMenuScreen(Screen parent){super(Component.literal("Cirrus Client"));this.parent=parent;}

 /** Everything the renderer and the hit-tester need, in one place. */
 private record Frame(int rail,int left,int right,int top,int toolbar,int gridTop,int gridBottom,int columns,int cardW,int cardH,int gapX,int gapY){
  static Frame of(int width,int height){
   int rail=Math.min(122,Math.max(90,width/6));
   int left=14+rail+12, right=width-16, top=16;
   int content=Math.max(120,right-left);
   int columns=content>=430?2:1;
   int gapX=10, gapY=8, cardH=64;
   int cardW=(content-gapX*(columns-1))/columns;
   return new Frame(rail,left,right,top,top+52,top+80,height-38,columns,cardW,cardH,gapX,gapY);
  }
  int contentWidth(){return right-left;}
  int rowStep(){return cardH+gapY;}
 }

 protected void init(){
  Frame f=Frame.of(width,height);
  addRenderableWidget(CirrusButton.nav(f.right-30,f.top+2,24,22,Component.literal(""),CirrusUi.ICON_BACK,b->minecraft.setScreen(parent)));
  search=new EditBox(font,f.left+30,f.toolbar+4,Math.max(60,f.contentWidth()-190),16,Component.literal("Search mods"));
  search.setBordered(false);search.setTextShadow(true);search.addFormatter((value,cursor)->CirrusUi.formatSearch(value));
  search.setHint(CirrusUi.small("Search mods…"));search.setValue(query);search.setResponder(v->{query=v;scroll=0;});
  addRenderableWidget(search);
  addRenderableWidget(CirrusButton.of(f.right-132,f.toolbar,122,22,Component.literal(favoritesOnly?"★ Favorites only":"☆ Favorites only"),b->{favoritesOnly=!favoritesOnly;scroll=0;rebuildWidgets();}));

  int y=f.top+60;
  addRenderableWidget(CirrusButton.nav(14,y,f.rail-8,24,Component.literal("All mods"),CirrusUi.ICON_LIBRARY,b->select(ModCategory.ALL)));y+=27;
  for(ModCategory c:ModCategory.values()){
   if(c==ModCategory.ALL)continue;
   if(ModRegistry.all().stream().noneMatch(m->m.category()==c))continue;
   if(y+24>height-120)break; // a short window keeps the rail buttons apart
   addRenderableWidget(CirrusButton.nav(14,y,f.rail-8,24,Component.literal(c.label),categoryIcon(c),b->select(c)));y+=27;
  }
  addRenderableWidget(CirrusButton.nav(14,height-114,f.rail-8,24,Component.literal("HUD Editor"),CirrusUi.ICON_HUD,b->minecraft.setScreen(new HudEditorScreen(this))));
  addRenderableWidget(CirrusButton.nav(14,height-86,f.rail-8,24,Component.literal("Themes"),CirrusUi.ICON_THEMES,b->minecraft.setScreen(new CirrusThemesScreen(this))));
  addRenderableWidget(CirrusButton.nav(14,height-58,f.rail-8,24,Component.literal("Minecraft settings"),CirrusUi.ICON_SETTINGS,b->minecraft.setScreen(new OptionsScreen(this,minecraft.options))));
  addRenderableWidget(CirrusButton.of(14,height-30,f.rail-8,22,Component.literal("Done"),b->minecraft.setScreen(parent)));
 }

 private void select(ModCategory choice){category=choice;scroll=0;rebuildWidgets();}

 public void render(GuiGraphics g,int mx,int my,float d){
  renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());CirrusUi.backdrop(g,width,height,t);
  Frame f=Frame.of(width,height);

  // one shell: the rail and the content share it, split by a hairline
  CirrusUi.panel(g,8,8,width-16,height-16,16,t);
  g.fill(f.rail+8,f.top+2,f.rail+9,height-18,t.border);
  g.fill(f.left,f.top+46,f.right,f.top+47,t.border);

  CirrusUi.brand(g,20,f.top+2,22,t);
  CirrusUi.headingText(g,font,"MOD LIBRARY",f.left,f.top+3,t.text);
  List<CirrusMod> entries=filtered();
  CirrusUi.smallText(g,font,category.label.toUpperCase(Locale.ROOT)+"  ·  "+entries.size()+" AVAILABLE",f.left,f.top+20,t.cyan,false);

  String theme=t.name().equals("LIGHT")?"FROST":"MIDNIGHT";
  CirrusUi.smallText(g,font,theme,f.right-44-font.width(CirrusUi.small(theme)),f.top+8,t.muted,false);

  // search field
  CirrusUi.rounded(g,f.left,f.toolbar,f.contentWidth()-140,24,8,t.surface);
  CirrusUi.outline(g,f.left,f.toolbar,f.contentWidth()-140,24,8,t.border);
  CirrusUi.icon(g,f.left+6,f.toolbar+5,14,CirrusUi.ICON_SEARCH,t.cyan);

  // rail caption
  CirrusUi.smallText(g,font,"LIBRARY",20,f.top+46,t.muted,false);
  g.fill(20,f.top+55,44,f.top+56,t.accent);

  // cards
  g.enableScissor(f.left,f.gridTop,f.right,Math.max(f.gridTop,f.gridBottom));
  int idx=0;
  for(CirrusMod m:entries){
   int row=idx/f.columns, col=idx%f.columns;
   int x=f.left+col*(f.cardW+f.gapX), y=f.gridTop+row*f.rowStep()-scroll;
   idx++;
   if(y+f.cardH<f.gridTop||y>f.gridBottom)continue;
   boolean hover=mx>=x&&mx<x+f.cardW&&my>=y&&my<y+f.cardH;
   CirrusUi.panel(g,x,y,f.cardW,f.cardH,12,t);
   if(hover){CirrusUi.outline(g,x,y,f.cardW,f.cardH,12,t.accent);g.fill(x+1,y+10,x+3,y+f.cardH-10,t.accent);}
   int ax=x+9,ay=y+10;CirrusUi.rounded(g,ax,ay,30,30,9,t.accentSoft);CirrusUi.outline(g,ax,ay,30,30,9,t.border);
   CirrusUi.icon(g,ax+4,ay+4,22,categoryIcon(m.category()),hover?t.accent:t.cyan);
   int textX=x+47, textW=Math.max(20,f.cardW-47-72);
   CirrusUi.headingText(g,font,CirrusUi.fit(font,m.name(),textW,false),textX,y+7,t.text);
   CirrusUi.smallText(g,font,m.category().label,textX,y+21,t.cyan,false);
   CirrusUi.smallText(g,font,CirrusUi.fit(font,m.description(),f.cardW-56,true),x+9,y+48,t.muted,false);
   CirrusUi.icon(g,x+f.cardW-58,y+9,14,5,m.favorite(config())?0xFFF5B942:t.muted);
   CirrusUi.statusPill(g,font,m.enabled(config())?"ON":"OFF",x+f.cardW-44,y+9,m.enabled(config()),t);
   if(m.hasSettings())CirrusUi.smallText(g,font,"SETTINGS  ›",x+f.cardW-72,y+26,t.muted,false);
  }
  g.disableScissor();

  if(entries.isEmpty()){
   int artW=Math.min(190,f.contentWidth()-24),artH=114;
   CirrusUi.emptyLibrary(g,f.left+(f.contentWidth()-artW)/2,f.gridTop+16,artW,artH);
   CirrusUi.centeredSmall(g,font,"No registered mods match these filters.",f.left+f.contentWidth()/2,f.gridTop+artH+30,t.muted);
  }

  // footer: where you are and how to leave
  CirrusUi.smallText(g,font,"SCROLL TO BROWSE  ·  RIGHT SHIFT TO CLOSE",f.left,f.gridBottom+8,t.muted,false);
  super.render(g,mx,my,d);
 }

 public boolean mouseClicked(MouseButtonEvent event,boolean doubleClick){
  double mx=event.x(),my=event.y();int button=event.button();
  Frame f=Frame.of(width,height);
  if(button==0&&mx>=f.left&&mx<f.right&&my>=f.gridTop&&my<=f.gridBottom){
   int col=(int)((mx-f.left)/(f.cardW+f.gapX));
   int row=(int)((my-f.gridTop+scroll)/f.rowStep());
   if(col>=0&&col<f.columns&&row>=0){
    int index=row*f.columns+col;var list=filtered();
    if(index<list.size()){
     var mod=list.get(index);
     int cardX=f.left+col*(f.cardW+f.gapX), cardY=f.gridTop+row*f.rowStep()-scroll;
     // The star and the ON/OFF pill sit on the top row; the rest of the card opens its settings.
     if(my<cardY+26&&mx>=cardX+f.cardW-46){mod.setEnabled(config(),!mod.enabled(config()));return true;}
     if(my<cardY+26&&mx>=cardX+f.cardW-64){mod.setFavorite(config(),!mod.favorite(config()));return true;}
     if(mod.hasSettings())mod.openSettings(this);
     return true;
    }
   }
  }
  return super.mouseClicked(event,doubleClick);
 }

 public boolean mouseScrolled(double x,double y,double h,double v){scroll=Math.max(0,Math.min(maxScroll(),scroll-(int)(v*26)));return true;}

 private int maxScroll(){Frame f=Frame.of(width,height);int rows=(filtered().size()+f.columns-1)/f.columns;int content=rows*f.rowStep();return Math.max(0,content-(f.gridBottom-f.gridTop)+2);}
 private int categoryIcon(ModCategory value){return switch(value){case ALL->CirrusUi.ICON_LIBRARY;case HUD->CirrusUi.ICON_HUD;case PVP->CirrusUi.ICON_PVP;case VISUALS->CirrusUi.ICON_VISUALS;case PERFORMANCE->CirrusUi.ICON_PERFORMANCE;case UTILITY->CirrusUi.ICON_UTILITY;case INTERFACE->CirrusUi.ICON_SETTINGS;};}
 private List<CirrusMod> filtered(){return ModRegistry.all().stream().filter(m->category==ModCategory.ALL||m.category()==category).filter(m->!favoritesOnly||m.favorite(config())).filter(m->(m.name()+" "+m.description()).toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT))).toList();}
 private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 public void onClose(){minecraft.setScreen(parent);}
}
