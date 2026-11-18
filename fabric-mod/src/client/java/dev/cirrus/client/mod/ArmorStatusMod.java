package dev.cirrus.client.mod;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Gfx;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

/** Worn armor with remaining durability. The editor shows sample armor when you are not in a world. */
public final class ArmorStatusMod extends HudMod {
    private static final EquipmentSlot[] SLOTS = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};
    private static final int ROW = 20;
    public String id() { return "armor_status"; }
    public String name() { return "Armor Status"; }
    public String description() { return "Shows worn armor with its remaining durability."; }
    public ModCategory category() { return ModCategory.PVP; }
    public int width() { return 96; }
    public int height() { return 8 + ROW * 4; }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return 36; }

    public void render(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(c);
        boolean preview = mc.player == null;
        CirrusUi.hudPanel(g, x, y, width(), height(), 8, t);
        for (int i = 0; i < SLOTS.length; i++) {
            ItemStack stack = preview ? sample(i) : mc.player.getItemBySlot(SLOTS[i]);
            int ry = y + 4 + i * ROW;
            if (stack.isEmpty()) {
                Gfx.fillRound(g, x + 6, ry + 2, 16, 16, 4, Gfx.scaleAlpha(t.border, 0.5f));
                CirrusUi.smallText(g, mc.font, "empty", x + 28, ry + 6, t.muted, false);
                continue;
            }
            g.renderItem(stack, x + 6, ry + 2);
            if (stack.isDamageableItem()) {
                int max = stack.getMaxDamage(), left = max - stack.getDamageValue();
                float fraction = max == 0 ? 1f : (float) left / max;
                int color = fraction > 0.5f ? t.good : fraction > 0.2f ? 0xFFF5B942 : 0xFFF0605D;
                CirrusUi.text(g, mc.font, Integer.toString(left), x + 28, ry + 3, color, false);
                CirrusUi.smallText(g, mc.font, Math.round(fraction * 100) + "%", x + 28, ry + 12, t.muted, false);
                Gfx.fillRound(g, x + width() - 26, ry + 8, 20, 4, 2, Gfx.scaleAlpha(t.border, 0.7f));
                Gfx.fillRound(g, x + width() - 26, ry + 8, Math.max(2, Math.round(20 * fraction)), 4, 2, color);
            } else {
                CirrusUi.smallText(g, mc.font, "no durability", x + 28, ry + 6, t.muted, false);
            }
        }
    }

    private static ItemStack sample(int slot) {
        ItemStack s = new ItemStack(switch (slot) { case 0 -> Items.NETHERITE_HELMET; case 1 -> Items.DIAMOND_CHESTPLATE; case 2 -> Items.IRON_LEGGINGS; default -> Items.GOLDEN_BOOTS; });
        s.setDamageValue(new int[] {40, 120, 180, 60}[slot]);
        return s;
    }
}
