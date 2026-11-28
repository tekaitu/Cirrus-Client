package dev.cirrus.client.mixin;

import com.mojang.blaze3d.vertex.PoseStack;
import dev.cirrus.client.mod.PvpHooks;
import net.minecraft.client.Camera;
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Zoom changes the field of view the camera uses; Damage Tilt skips the hurt shake. Both are no-ops while their module is off. */
@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
    @Inject(method = "getFov", at = @At("RETURN"), cancellable = true, require = 0)
    private void maple$zoomFov(Camera camera, float partialTick, boolean useFovSetting, CallbackInfoReturnable<Float> cir) {
        cir.setReturnValue(PvpHooks.applyZoom(cir.getReturnValue()));
    }

    @Inject(method = "bobHurt", at = @At("HEAD"), cancellable = true, require = 0)
    private void maple$noDamageTilt(PoseStack poseStack, float partialTick, CallbackInfo ci) {
        if (PvpHooks.removeDamageTilt()) ci.cancel();
    }
}
