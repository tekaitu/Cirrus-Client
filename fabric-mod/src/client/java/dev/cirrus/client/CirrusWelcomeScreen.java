package dev.cirrus.client;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
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
    public void render(GuiGraphics g,int mx,int my,float d){renderBackground(g,mx,my,d);var t=CirrusTheme.current(config());g.fill(0,0,width,height,t.overlay);int left=width/2-190,top=height/2-100;g.fill(left,top,left+380,top+235,t.panel);g.renderOutline(left,top,380,235,t.border);brand(g,width/2,top+32,t);g.drawCenteredString(font,"WELCOME TO CIRRUS",width/2,top+68,t.text);g.drawCenteredString(font,"Choose a theme. You can change it anytime in Settings.",width/2,top+88,t.muted);g.drawCenteredString(font,"Your preferences stay in this Minecraft instance.",width/2,top+106,t.muted);super.render(g,mx,my,d);}
    static void brand(GuiGraphics g,int cx,int y,CirrusTheme t){g.fill(cx-16,y-16,cx+16,y+16,t.accent);g.renderOutline(cx-16,y-16,32,32,t.cyan);g.fill(cx-2,y-10,cx+2,y+10,t.text);g.fill(cx-9,y-2,cx+9,y+2,t.text);}
    private CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
    private void finish(){config().put("onboarding.complete","true");minecraft.setScreen(parent);}
    public void onClose(){finish();}
}
