package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import dev.cirrus.client.ui.CirrusButton;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** First-run choices are persisted per game directory; skipping completes onboarding with defaults. */
public final class CirrusWelcomeScreen extends Screen {
    private final Screen parent;
    public CirrusWelcomeScreen(Screen parent){super(Component.literal("Welcome to Cirrus"));this.parent=parent;}
    protected void init(){int x=width/2-92,y=height/2+4;
        addRenderableWidget(CirrusButton.nav(x,y,180,22,Component.literal("Dark theme"),CirrusUi.ICON_THEMES,b->CirrusTheme.set(config(),CirrusTheme.DARK)));
        addRenderableWidget(CirrusButton.nav(x,y+29,180,22,Component.literal("Light theme"),CirrusUi.ICON_THEMES,b->CirrusTheme.set(config(),CirrusTheme.LIGHT)));
        addRenderableWidget(CirrusButton.of(x,y+66,86,22,Component.literal("Continue"),b->finish()));
        addRenderableWidget(CirrusButton.of(x+94,y+66,86,22,Component.literal("Skip"),b->finish()));
    }
    public void render(GuiGraphics g,int mx,int my,float d){
        var t=CirrusTheme.current(config());
        int cardW=Math.min(420,width-28),cardH=Math.min(260,height-28),left=(width-cardW)/2,top=(height-cardH)/2;
        CirrusUi.panel(g,left,top,cardW,cardH,20,t);CirrusUi.brand(g,width/2-63,top+30,32,t);
        CirrusUi.centeredHeading(g,font,"WELCOME TO CIRRUS",width/2,top+84,t.text);
        CirrusUi.centered(g,font,"Make the interface yours.",width/2,top+108,t.cyan);
        CirrusUi.centeredSmall(g,font,"Choose a theme. You can change it anytime in Settings.",width/2,top+132,t.muted);
        CirrusUi.centeredSmall(g,font,"Your preferences stay in this Minecraft instance.",width/2,top+147,t.muted);super.render(g,mx,my,d);
    }
    private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
    private void finish(){config().put("onboarding.complete","true");minecraft.setScreen(parent);}
    public void onClose(){finish();}

 @Override public void renderBackground(GuiGraphics bg,int bmx,int bmy,float bd){CirrusUi.backdrop(bg,width,height,CirrusTheme.current(CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath())));}
}

