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
        addRenderableWidget(CirrusButton.of(x,y,180,22,Component.literal("Dark theme"),b->CirrusTheme.set(config(),CirrusTheme.DARK)));
        addRenderableWidget(CirrusButton.of(x,y+29,180,22,Component.literal("Light theme"),b->CirrusTheme.set(config(),CirrusTheme.LIGHT)));
        addRenderableWidget(CirrusButton.of(x,y+66,86,22,Component.literal("Continue"),b->finish()));
        addRenderableWidget(CirrusButton.of(x+94,y+66,86,22,Component.literal("Skip"),b->finish()));
    }
    public void render(GuiGraphics g,int mx,int my,float d){renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());CirrusUi.backdrop(g,width,height,t);int cardW=Math.min(420,width-28),cardH=Math.min(260,height-28),left=(width-cardW)/2,top=(height-cardH)/2;CirrusUi.panel(g,left,top,cardW,cardH,20,t);CirrusUi.brand(g,width/2-72,top+30,32,t);g.drawCenteredString(font,"WELCOME TO CIRRUS",width/2,top+84,t.text);g.drawCenteredString(font,"Make the interface yours.",width/2,top+106,t.cyan);g.drawCenteredString(font,"Choose a theme. You can change it anytime in Settings.",width/2,top+128,t.muted);g.drawCenteredString(font,"Your preferences stay in this Minecraft instance.",width/2,top+142,t.muted);super.render(g,mx,my,d);}
    private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
    private void finish(){config().put("onboarding.complete","true");minecraft.setScreen(parent);}
    public void onClose(){finish();}
}
