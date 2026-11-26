package dev.cirrus.client.mixin;

import dev.cirrus.client.glyph.MapleGlyph;
import net.minecraft.client.renderer.entity.EntityRenderer;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Puts the Maple leaf before a verified Maple player's name above their head. The name tag text comes from this method and the
 * renderer lays it out as usual. Only players are touched, and only the returned text changes.
 */
@Mixin(EntityRenderer.class)
public abstract class EntityRendererMixin {
    @Inject(method = "getNameTag", at = @At("RETURN"), cancellable = true, require = 0)
    private void maple$prefixVerified(Entity entity, CallbackInfoReturnable<Component> cir) {
        if (entity instanceof Player player) cir.setReturnValue(MapleGlyph.decorate(cir.getReturnValue(), player.getUUID()));
    }
}
