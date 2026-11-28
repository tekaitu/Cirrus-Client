package dev.cirrus.client.mod;

import dev.cirrus.client.render.McInput;
import dev.cirrus.client.render.McTextMetrics;
import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.input.GameAction;
import dev.cirrus.core.input.InputState;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.text.TextMetrics;
import net.minecraft.client.Minecraft;
import net.minecraft.client.KeyMapping;

/** The Minecraft 1.21.11 implementation of {@link ModContext}: the one place Core modules reach the running game. */
public final class ClientModContext implements ModContext {
    public static final ClientModContext INSTANCE = new ClientModContext();
    private CirrusConfig config;

    private ClientModContext() { }

    /** The game directory never changes during a run, so the config handle is looked up once. */
    @Override public CirrusConfig config() {
        CirrusConfig c = config;
        if (c == null) config = c = CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());
        return c;
    }

    @Override public InputState input() { return McInput.INSTANCE; }

    @Override public TextMetrics text() { return McTextMetrics.INSTANCE; }

    @Override public int screenWidth() { return Minecraft.getInstance().getWindow().getGuiScaledWidth(); }

    @Override public int screenHeight() { return Minecraft.getInstance().getWindow().getGuiScaledHeight(); }

    @Override public int fps() { return Minecraft.getInstance().getFps(); }

    /** -1 when there is nothing to measure (no connection, or a local singleplayer world). */
    @Override public int pingMillis() {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || mc.getConnection() == null || mc.hasSingleplayerServer()) return -1;
        var info = mc.getConnection().getPlayerInfo(mc.player.getUUID());
        return info == null ? -1 : info.getLatency();
    }

    @Override public boolean inWorld() { return Minecraft.getInstance().player != null; }

    @Override public double playerX() { var p = Minecraft.getInstance().player; return p == null ? 0 : p.getX(); }
    @Override public double playerY() { var p = Minecraft.getInstance().player; return p == null ? 0 : p.getY(); }
    @Override public double playerZ() { var p = Minecraft.getInstance().player; return p == null ? 0 : p.getZ(); }
    @Override public float playerYaw() { var p = Minecraft.getInstance().player; return p == null ? 0 : p.getYRot(); }

    @Override public java.util.List<dev.cirrus.core.module.EffectInfo> effects() {
        var p = Minecraft.getInstance().player;
        if (p == null || p.getActiveEffects().isEmpty()) return java.util.Collections.emptyList();
        java.util.List<dev.cirrus.core.module.EffectInfo> out = new java.util.ArrayList<>();
        for (var e : p.getActiveEffects()) {
            var effect = e.getEffect().value();
            out.add(new dev.cirrus.core.module.EffectInfo(effect.getDisplayName().getString(), e.getAmplifier(), e.isInfiniteDuration() ? -1 : e.getDuration(), effect.isBeneficial()));
        }
        return out;
    }

    @Override public boolean isActionDown(GameAction action) {
        var o = Minecraft.getInstance().options;
        KeyMapping key;
        switch (action) {
            case FORWARD: key = o.keyUp; break;
            case LEFT: key = o.keyLeft; break;
            case BACK: key = o.keyDown; break;
            case RIGHT: key = o.keyRight; break;
            case JUMP: key = o.keyJump; break;
            case ATTACK: key = o.keyAttack; break;
            case USE: key = o.keyUse; break;
            default: return false;
        }
        return key.isDown();
    }
}
