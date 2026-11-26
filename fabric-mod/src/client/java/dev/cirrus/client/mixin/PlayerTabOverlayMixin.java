package dev.cirrus.client.mixin;

import dev.cirrus.client.glyph.MapleGlyph;
import net.minecraft.client.gui.components.PlayerTabOverlay;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Puts the Maple leaf before a verified Maple player's name in the tab list. The tab list measures and draws whatever this returns, so
 * the layout accounts for the glyph. Does nothing for anyone {@code MapleIdentity} does not vouch for. Only the returned text is
 * changed: no game state, no other rendering.
 */
@Mixin(PlayerTabOverlay.class)
public abstract class PlayerTabOverlayMixin {
    @Inject(method = "getNameForDisplay", at = @At("RETURN"), cancellable = true, require = 0)
    private void maple$prefixVerified(PlayerInfo info, CallbackInfoReturnable<Component> cir) {
        cir.setReturnValue(MapleGlyph.decorate(cir.getReturnValue(), info.getProfile().id()));
    }
}
