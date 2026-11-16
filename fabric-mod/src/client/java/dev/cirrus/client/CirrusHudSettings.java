package dev.cirrus.client;
import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.mod.HudElement;
import dev.cirrus.client.mod.HudElementRegistry;
import dev.cirrus.client.mod.ModRegistry;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
final class CirrusHudSettings {
 private CirrusHudSettings() {}
 private static CirrusConfig config(){return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());}
 static boolean isEnabled(){return ModRegistry.find("local_status").map(m->m.enabled(config())).orElse(true);}
 static boolean isRightAligned(){return config().getString("hud.anchor.local_status","TOP_LEFT").equals("TOP_RIGHT");}
 static void toggleEnabled(){ModRegistry.find("local_status").ifPresent(m->m.setEnabled(config(),!m.enabled(config())));}
 static void toggleAlignment(){config().put("hud.anchor.local_status",isRightAligned()?"TOP_LEFT":"TOP_RIGHT");}
 static void render(GuiGraphics g){int w=Minecraft.getInstance().getWindow().getGuiScaledWidth(),h=Minecraft.getInstance().getWindow().getGuiScaledHeight();for(HudElement e:HudElementRegistry.all())if(e.enabled(config()))e.render(g,e.x(config(),w),e.y(config(),h),0,config());}
}
