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

import java.util.ArrayList;
import java.util.List;

/** Worn armor with remaining durability. The settings page and HUD editor show sample armor when you are not in a world. */
public final class ArmorStatusMod extends HudMod {
    private static final EquipmentSlot[] SLOTS = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};
    private static final int ROW = 20, CELL = 32;
    private static final List<Setting> OWN = List.of(
        Setting.choice("display", "Durability display", "Show remaining durability as a number, a percentage, both, or hide the text.", "Both", "Number", "Percentage", "Both", "None"),
        Setting.toggle("bar", "Durability bar", "A small bar that shrinks as the item wears down.", true),
        Setting.choice("layout", "Layout", "Stack pieces top to bottom or lay them out side by side.", "Vertical", "Vertical", "Horizontal"),
        Setting.toggle("empty", "Show empty slots", "Keep a placeholder for armor slots you are not wearing.", true),
        Setting.toggle("colorize", "Color by durability", "Green, amber and red as the item wears down.", true));

    public String id() { return "armor_status"; }
    public String name() { return "Armor Status"; }
    public String description() { return "Shows worn armor with its remaining durability."; }
    public ModCategory category() { return ModCategory.PVP; }
    @Override public int icon() { return dev.cirrus.client.ui.CirrusUi.ICON_PVP; }
    @Override protected List<Setting> featureSettings() { return OWN; }
    @Override public int defaultX() { return 8; }
    @Override public int defaultY(int screenHeight) { return 36; }

    private boolean horizontal(CirrusConfig c) { return opt(c, "layout").equals("Horizontal"); }
    private boolean text(CirrusConfig c) { return !opt(c, "display").equals("None"); }

    /** Armor pieces to show right now (the sample set when there is no player). */
    private List<ItemStack> pieces(CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance();
        List<ItemStack> list = new ArrayList<>();
        for (int i = 0; i < SLOTS.length; i++) {
            ItemStack stack = mc.player == null ? sample(i) : mc.player.getItemBySlot(SLOTS[i]);
            if (!stack.isEmpty() || on(c, "empty")) list.add(stack);
        }
        return list;
    }

    @Override protected int baseWidth(CirrusConfig c) {
        int n = Math.max(1, pieces(c).size());
        if (horizontal(c)) return n * CELL + 8;
        return 6 + 16 + 6 + (text(c) ? 34 : 0) + (on(c, "bar") ? 26 : 0) + 2;
    }

    @Override protected int baseHeight(CirrusConfig c) {
        int n = Math.max(1, pieces(c).size());
        if (!horizontal(c)) return 8 + ROW * n;
        int textH = !text(c) ? 0 : opt(c, "display").equals("Both") ? 21 : 11;
        return 6 + 16 + 2 + textH + (on(c, "bar") ? 6 : 0) + 4;
    }

    @Override protected void draw(GuiGraphics g, int x, int y, float tick, CirrusConfig c) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(c);
        int w = baseWidth(c), h = baseHeight(c);
        surface(g, x, y, w, h, 8, c, t);
        List<ItemStack> pieces = pieces(c);
        boolean horiz = horizontal(c);
        for (int i = 0; i < pieces.size(); i++) {
            if (horiz) cell(g, mc, pieces.get(i), x + 4 + i * CELL, y + 6, c, t);
            else row(g, mc, pieces.get(i), x, y + 4 + i * ROW, w, c, t);
        }
    }

    private void row(GuiGraphics g, Minecraft mc, ItemStack stack, int x, int ry, int w, CirrusConfig c, CirrusTheme t) {
        boolean sh = shadowOn(c);
        if (stack.isEmpty()) {
            Gfx.fillRound(g, x + 6, ry + 2, 16, 16, 4, Gfx.scaleAlpha(t.border, 0.5f));
            return;
        }
        g.renderItem(stack, x + 6, ry + 2);
        int tx = x + 28;
        if (!stack.isDamageableItem()) {
            if (text(c)) CirrusUi.smallText(g, mc.font, "—", tx, ry + 6, t.muted, sh);
            return;
        }
        int max = stack.getMaxDamage(), left = max - stack.getDamageValue();
        float fraction = max == 0 ? 1f : (float) left / max;
        int color = on(c, "colorize") ? wear(fraction, t) : t.text;
        String display = opt(c, "display");
        if (display.equals("Both")) {
            CirrusUi.text(g, mc.font, Integer.toString(left), tx, ry + 3, color, sh);
            CirrusUi.smallText(g, mc.font, Math.round(fraction * 100) + "%", tx, ry + 12, t.muted, sh);
        } else if (display.equals("Number")) {
            CirrusUi.text(g, mc.font, Integer.toString(left), tx, ry + 5, color, sh);
        } else if (display.equals("Percentage")) {
            CirrusUi.text(g, mc.font, Math.round(fraction * 100) + "%", tx, ry + 5, color, sh);
        }
        if (on(c, "bar")) bar(g, text(c) ? x + w - 26 : tx, ry + 8, 20, fraction, color, t);
    }

    private void cell(GuiGraphics g, Minecraft mc, ItemStack stack, int cx, int cy, CirrusConfig c, CirrusTheme t) {
        boolean sh = shadowOn(c);
        int mid = cx + CELL / 2 - 2;
        if (stack.isEmpty()) {
            Gfx.fillRound(g, mid - 8, cy, 16, 16, 4, Gfx.scaleAlpha(t.border, 0.5f));
            return;
        }
        g.renderItem(stack, mid - 8, cy);
        if (!stack.isDamageableItem()) return;
        int max = stack.getMaxDamage(), left = max - stack.getDamageValue();
        float fraction = max == 0 ? 1f : (float) left / max;
        int color = on(c, "colorize") ? wear(fraction, t) : t.text;
        int ty = cy + 18;
        String display = opt(c, "display");
        if (display.equals("Both")) {
            CirrusUi.centeredSmall(g, mc.font, Integer.toString(left), mid, ty, color);
            CirrusUi.centeredSmall(g, mc.font, Math.round(fraction * 100) + "%", mid, ty + 10, t.muted);
            ty += 21;
        } else if (display.equals("Number") || display.equals("Percentage")) {
            String s = display.equals("Number") ? Integer.toString(left) : Math.round(fraction * 100) + "%";
            CirrusUi.centeredSmall(g, mc.font, s, mid, ty, color);
            ty += 11;
        }
        if (on(c, "bar")) bar(g, mid - 12, ty + 1, 24, fraction, color, t);
    }

    private static void bar(GuiGraphics g, int x, int y, int w, float fraction, int color, CirrusTheme t) {
        Gfx.fillRound(g, x, y, w, 4, 2, Gfx.scaleAlpha(t.border, 0.7f));
        Gfx.fillRound(g, x, y, Math.max(2, Math.round(w * fraction)), 4, 2, color);
    }

    private static int wear(float fraction, CirrusTheme t) { return fraction > 0.5f ? t.good : fraction > 0.2f ? 0xFFF5B942 : 0xFFF0605D; }

    private static ItemStack sample(int slot) {
        ItemStack s = new ItemStack(switch (slot) { case 0 -> Items.NETHERITE_HELMET; case 1 -> Items.DIAMOND_CHESTPLATE; case 2 -> Items.IRON_LEGGINGS; default -> Items.GOLDEN_BOOTS; });
        s.setDamageValue(new int[] {40, 120, 180, 60}[slot]);
        return s;
    }
}
