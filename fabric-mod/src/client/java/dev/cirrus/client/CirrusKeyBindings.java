package dev.cirrus.client;


import dev.cirrus.core.input.Keys;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import com.mojang.blaze3d.platform.InputConstants;

/** Right Shift opens/closes Cirrus in gameplay and vanilla navigation screens, never while typing. */
final class CirrusKeyBindings {
    private CirrusKeyBindings(){}
    static void register(){
        KeyMapping key=KeyBindingHelper.registerKeyBinding(new KeyMapping("key.cirrus.open_gui",InputConstants.Type.KEYSYM,Keys.RIGHT_SHIFT,new KeyMapping.Category(Identifier.fromNamespaceAndPath("cirrus_fabric","general"))));
        ClientTickEvents.END_CLIENT_TICK.register(client->{while(key.consumeClick()){
            // In gameplay and vanilla navigation screens Right Shift opens the mod menu. Inside Cirrus screens CirrusScreen closes itself.
            if(client.screen==null||client.screen instanceof TitleScreen||client.screen instanceof PauseScreen){client.setScreen(new CirrusMenuScreen(client.screen));}
        }});
    }
}
