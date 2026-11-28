package dev.cirrus.client.mod;

import com.mojang.blaze3d.platform.InputConstants;
import dev.cirrus.client.render.McCanvas;
import dev.cirrus.core.anim.Anim;
import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.module.CirrusMod;
import dev.cirrus.core.module.ModRegistry;
import dev.cirrus.core.pvp.CrosshairMod;
import dev.cirrus.core.pvp.DamageTiltMod;
import dev.cirrus.core.pvp.HitboxesMod;
import dev.cirrus.core.pvp.LowFireMod;
import dev.cirrus.core.pvp.RawInputMod;
import dev.cirrus.core.pvp.ToggleSprintMod;
import dev.cirrus.core.pvp.ZoomMod;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.resources.Identifier;

import java.lang.reflect.Field;

/**
 * Where the PvP modules meet the game. The mixins and the client tick only ask this class; it reads the module switches from the
 * Cirrus config. Everything that changes a vanilla option remembers the player's own value and puts it back when the module is
 * switched off or the game closes, so turning a module off always leaves the game as the player had it.
 */
public final class PvpHooks {
    public static final ZoomMod ZOOM = new ZoomMod();
    public static final DamageTiltMod TILT = new DamageTiltMod();
    public static final LowFireMod LOW_FIRE = new LowFireMod();
    public static final CrosshairMod CROSSHAIR = new CrosshairMod();
    public static final ToggleSprintMod TOGGLE = new ToggleSprintMod();
    public static final RawInputMod RAW = new RawInputMod();
    public static final HitboxesMod HITBOXES = new HitboxesMod();

    private static KeyMapping zoomKey;
    private static final Anim.Clock CLOCK = new Anim.Clock();
    private static boolean fireShifted;

    // What the player had before a module changed it (valid only while the module's change is applied).
    private static boolean sprintApplied, sneakApplied, rawApplied, hitboxApplied;
    private static boolean prevSprint, prevSneak, prevRaw;
    private static Object prevHitbox;

    private PvpHooks() { }

    public static CirrusMod[] modules() { return new CirrusMod[] {ZOOM, TILT, LOW_FIRE, CROSSHAIR, TOGGLE, RAW, HITBOXES}; }

    private static CirrusConfig cfg() { return ClientModContext.INSTANCE.config(); }
    private static boolean on(CirrusMod m) { return m.enabled(cfg()); }

    /** Registers the zoom key and the tick that applies option-based modules. Call once at client start, after the modules are registered. */
    public static void register() {
        zoomKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.cirrus.zoom", InputConstants.Type.KEYSYM, 67 /* GLFW_KEY_C */, ModKeys.CATEGORY));
        ClientTickEvents.END_CLIENT_TICK.register(client -> apply(client));
        ClientLifecycleEvents.CLIENT_STOPPING.register(client -> releaseAll(client));
    }

    // ---- hooks used by the mixins ----------------------------------------------------------------------------------------

    /** The field of view after zoom. Cheap when the module is off. */
    public static float applyZoom(float fov) {
        if (!on(ZOOM)) { if (ZOOM.state.active()) ZOOM.state.reset(); return fov; }
        Minecraft mc = Minecraft.getInstance();
        boolean held = zoomKey != null && zoomKey.isDown() && mc.screen == null;
        return fov * ZOOM.state.update(held, ZOOM.target(cfg()), ZOOM.smooth(cfg()), CLOCK.tick());
    }

    public static boolean removeDamageTilt() { return on(TILT); }

    /** Called when the fire overlay starts drawing; returns how far to move it down, or 0 when the module is off. */
    public static float fireOffset() {
        fireShifted = on(LOW_FIRE);
        return fireShifted ? LOW_FIRE.offset(cfg()) : 0f;
    }

    public static boolean fireWasShifted() { boolean s = fireShifted; fireShifted = false; return s; }

    /** Draws the custom crosshair and returns true when it replaced the vanilla one. */
    public static boolean drawCrosshair(GuiGraphics g) {
        if (!on(CROSSHAIR)) return false;
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || !mc.options.getCameraType().isFirstPerson()) return false;
        CrosshairMod.draw(McCanvas.of(g), g.guiWidth() / 2, g.guiHeight() / 2, cfg());
        return true;
    }

    // ---- option-based modules ------------------------------------------------------------------------------------------------

    private static void apply(Minecraft mc) {
        if (mc.options == null) return;
        CirrusConfig c = cfg();
        boolean wantSprint = on(TOGGLE) && TOGGLE.sprint(c), wantSneak = on(TOGGLE) && TOGGLE.sneak(c);
        if (wantSprint != sprintApplied) {
            if (wantSprint) { prevSprint = mc.options.toggleSprint().get(); mc.options.toggleSprint().set(true); } else mc.options.toggleSprint().set(prevSprint);
            sprintApplied = wantSprint;
        }
        if (wantSneak != sneakApplied) {
            if (wantSneak) { prevSneak = mc.options.toggleCrouch().get(); mc.options.toggleCrouch().set(true); } else mc.options.toggleCrouch().set(prevSneak);
            sneakApplied = wantSneak;
        }
        boolean wantRaw = on(RAW);
        if (wantRaw != rawApplied) {
            if (wantRaw) { prevRaw = mc.options.rawMouseInput().get(); mc.options.rawMouseInput().set(true); } else mc.options.rawMouseInput().set(prevRaw);
            rawApplied = wantRaw;
        }
        boolean wantBoxes = on(HITBOXES);
        if (wantBoxes != hitboxApplied) { setHitboxes(mc, wantBoxes); hitboxApplied = wantBoxes; }
    }

    /** Puts every changed option back (game closing). */
    private static void releaseAll(Minecraft mc) {
        if (mc.options == null) return;
        if (sprintApplied) { mc.options.toggleSprint().set(prevSprint); sprintApplied = false; }
        if (sneakApplied) { mc.options.toggleCrouch().set(prevSneak); sneakApplied = false; }
        if (rawApplied) { mc.options.rawMouseInput().set(prevRaw); rawApplied = false; }
        if (hitboxApplied) { setHitboxes(mc, false); hitboxApplied = false; }
    }

    /** Whether the game's own entity hitbox display is currently on, or null when this game version has no such entry. */
    public static Boolean hitboxesShown(Minecraft mc) {
        try {
            var list = debugList(mc);
            return list == null ? null : list.isCurrentlyEnabled(hitboxId());
        } catch (ReflectiveOperationException | RuntimeException e) { return null; }
    }

    /**
     * Turns the game's own hitbox display on, or puts it back to what the player had. Looked up by type and name so a renamed field
     * in another game version disables the module instead of breaking the game.
     */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static void setHitboxes(Minecraft mc, boolean on) {
        try {
            var list = debugList(mc);
            if (list == null) return;
            Identifier id = hitboxId();
            if (on) {
                prevHitbox = list.getStatus(id);
                list.setStatus(id, (net.minecraft.client.gui.components.debug.DebugScreenEntryStatus) Enum.valueOf((Class) net.minecraft.client.gui.components.debug.DebugScreenEntryStatus.class, "ALWAYS_ON"));
            } else if (prevHitbox != null) {
                list.setStatus(id, (net.minecraft.client.gui.components.debug.DebugScreenEntryStatus) prevHitbox);
                prevHitbox = null;
            }
        } catch (ReflectiveOperationException | RuntimeException e) {
            dev.cirrus.core.log.CoreLog.warn("Hitboxes: the game's hitbox display could not be switched", e);
        }
    }

    private static Identifier hitboxId() throws ReflectiveOperationException {
        Field f = net.minecraft.client.gui.components.debug.DebugScreenEntries.class.getDeclaredField("ENTITY_HITBOXES");
        f.setAccessible(true);
        return (Identifier) f.get(null);
    }

    private static net.minecraft.client.gui.components.debug.DebugScreenEntryList debugList(Minecraft mc) throws ReflectiveOperationException {
        for (Field f : Minecraft.class.getDeclaredFields()) {
            if (f.getType() == net.minecraft.client.gui.components.debug.DebugScreenEntryList.class) {
                f.setAccessible(true);
                return (net.minecraft.client.gui.components.debug.DebugScreenEntryList) f.get(mc);
            }
        }
        return null;
    }
}
