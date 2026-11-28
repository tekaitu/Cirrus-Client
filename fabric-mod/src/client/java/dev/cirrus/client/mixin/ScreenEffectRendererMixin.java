package dev.cirrus.client.mixin;

import com.mojang.blaze3d.vertex.PoseStack;
import dev.cirrus.client.mod.PvpHooks;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.ScreenEffectRenderer;
import net.minecraft.client.renderer.texture.TextureAtlasSprite;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Low Fire: moves the first-person fire overlay down. The shift is wrapped in its own push/pop so nothing else is moved. */
@Mixin(ScreenEffectRenderer.class)
public abstract class ScreenEffectRendererMixin {
    @Inject(method = "renderFire", at = @At("HEAD"), require = 0)
    private static void maple$fireDown(PoseStack poseStack, MultiBufferSource buffers, TextureAtlasSprite sprite, CallbackInfo ci) {
        float offset = PvpHooks.fireOffset();
        if (offset > 0f) { poseStack.pushPose(); poseStack.translate(0.0F, -offset, 0.0F); }
    }

    @Inject(method = "renderFire", at = @At("RETURN"), require = 0)
    private static void maple$fireBack(PoseStack poseStack, MultiBufferSource buffers, TextureAtlasSprite sprite, CallbackInfo ci) {
        if (PvpHooks.fireWasShifted()) poseStack.popPose();
    }
}
