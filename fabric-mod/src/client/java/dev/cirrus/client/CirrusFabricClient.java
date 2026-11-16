package dev.cirrus.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.Screens;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.network.chat.Component;
import dev.cirrus.client.ui.CirrusButton;
import net.minecraft.resources.Identifier;
import dev.cirrus.client.mod.LocalStatusMod;
import dev.cirrus.client.mod.ModRegistry;
import dev.cirrus.client.config.CirrusConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.asset.AssetManager;
import dev.cirrus.client.asset.CirrusInitializationScreen;

public final class CirrusFabricClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        ModRegistry.register(new LocalStatusMod());
        ModRegistry.initialize(CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath()));
        AssetManager assets = AssetManager.get(Minecraft.getInstance().gameDirectory.toPath());
        assets.initialize();
        CirrusKeyBindings.register();
        dev.cirrus.client.mod.HudElementRegistry.register((dev.cirrus.client.mod.HudElement) ModRegistry.find("local_status").orElseThrow());
        HudElementRegistry.attachElementAfter(
            VanillaHudElements.MISC_OVERLAYS,
            Identifier.fromNamespaceAndPath("cirrus_fabric", "status"),
            (graphics, tickCounter) -> CirrusHudSettings.render(graphics));

        ScreenEvents.AFTER_INIT.register((client, screen, scaledWidth, scaledHeight) -> {
            if (assets.snapshot().finished()) dev.cirrus.client.asset.CirrusAssetTextures.load(assets);
            if (screen instanceof TitleScreen && !assets.snapshot().finished()) {
                client.setScreen(new CirrusInitializationScreen(screen, assets));
                return;
            }
            if (screen instanceof TitleScreen && !CirrusConfig.get(client.gameDirectory.toPath()).getBoolean("onboarding.complete", false)) {
                client.setScreen(new CirrusWelcomeScreen(screen));
                return;
            }
            if (screen instanceof TitleScreen) {
                var buttons=Screens.getButtons(screen);
                buttons.clear();
                int buttonWidth=Math.min(220,Math.max(150,scaledWidth/3));
                int x=(scaledWidth-buttonWidth)/2;
                int y=Math.max(116,scaledHeight/2-8);
                buttons.add(CirrusButton.of(x,y,buttonWidth,22,Component.literal("Singleplayer"),b->client.setScreen(new SelectWorldScreen(screen))));
                buttons.add(CirrusButton.of(x,y+29,buttonWidth,22,Component.literal("Multiplayer"),b->client.setScreen(new JoinMultiplayerScreen(screen))));
                buttons.add(CirrusButton.of(x,y+58,buttonWidth,22,Component.literal("Cirrus Client  ·  Right Shift"),b->client.setScreen(new CirrusDashboardScreen(screen))));
                buttons.add(CirrusButton.of(x,y+87,buttonWidth/2-3,22,Component.literal("Options"),b->client.setScreen(new net.minecraft.client.gui.screens.options.OptionsScreen(screen,client.options))));
                buttons.add(CirrusButton.of(x+buttonWidth/2+3,y+87,buttonWidth/2-3,22,Component.literal("Quit"),b->client.stop()));
                ScreenEvents.afterRender(screen).register((s,graphics,mouseX,mouseY,tickDelta)->{
                    var t=CirrusTheme.current(CirrusConfig.get(client.gameDirectory.toPath()));
                    CirrusUi.backdrop(graphics,scaledWidth,scaledHeight,t);
                    int panelW=Math.min(buttonWidth+34,scaledWidth-28),panelX=(scaledWidth-panelW)/2;
                    CirrusUi.panel(graphics,panelX,Math.max(12,y-92),panelW,Math.min(scaledHeight-24,204),20,t);
                    CirrusUi.brand(graphics,scaledWidth/2-70,Math.max(24,y-78),42,t);
                    CirrusUi.centeredHeading(graphics,client.font,"YOUR NEXT SESSION STARTS HERE",scaledWidth/2,Math.max(77,y-20),t.text);
                    CirrusUi.centeredSmall(graphics,client.font,"MINECRAFT CLIENT  ·  FABRIC 1.21.11",scaledWidth/2,Math.max(94,y-5),t.cyan);
                    for(var button:buttons)button.render(graphics,mouseX,mouseY,tickDelta);
                });
                return;
            }
            if (!(screen instanceof PauseScreen)) {
                return;
            }

            int buttonWidth = Math.min(150,Math.max(112,screen.width/5));
            int x = Math.max(8, screen.width - buttonWidth - 8);
            int y = Math.max(8, screen.height - 30);
            Component label = Component.literal("Cirrus  ·  Right Shift");
            Screens.getButtons(screen).add(CirrusButton.of(x,y,buttonWidth,22,label,button -> client.setScreen(new CirrusDashboardScreen(screen))));
        });
    }
}

