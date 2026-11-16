package dev.cirrus.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.Screens;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.client.gui.components.Button;

public final class CirrusFabricClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        ScreenEvents.AFTER_INIT.register((client, screen, scaledWidth, scaledHeight) -> {
            if (!(screen instanceof TitleScreen) && !(screen instanceof PauseScreen)) {
                return;
            }

            int buttonWidth = 100;
            int x = Math.max(8, screen.width - buttonWidth - 8);
            int y = screen instanceof TitleScreen ? 8 : Math.max(8, screen.height - 28);
            Component label = Component.literal("Cirrus");
            Screens.getButtons(screen).add(Button.builder(label, button ->
                    client.setScreen(new CirrusMenuScreen(screen)))
                .bounds(x, y, buttonWidth, 20)
                .build());
        });
    }
}
