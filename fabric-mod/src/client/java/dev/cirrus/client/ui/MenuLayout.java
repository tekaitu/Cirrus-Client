package dev.cirrus.client.ui;

/**
 * Geometry of the Feather-style main menu, pure arithmetic so it can be unit tested without Minecraft.
 *
 * <p>The composition is authored on a 800x450 GUI-unit reference (a 1600x900 window at GUI scale 2): a centred column of
 * five wide buttons with the quit button under it, the logo above, a profile chip plus six square icon buttons top right,
 * a vertical partner strip on the left and a promotion banner bottom right. Everything scales with
 * {@code s = min(W/800, H/450)}; centre elements are anchored to the screen centre, the strip and cluster to their edges,
 * and elements that cannot fit (the banner, partner tiles beyond the available height) are dropped instead of overlapping.
 */
public final class MenuLayout {
    public record Rect(int x, int y, int w, int h) {
        public int right() { return x + w; }
        public int bottom() { return y + h; }
        public boolean intersects(Rect o) { return x < o.right() && o.x < right() && y < o.bottom() && o.y < bottom(); }
    }

    public static final int BUTTONS = 5, ICONS = 6;
    public final float scale;
    public final Rect logoMark;
    public final int logoTextX, logoTextY;
    public final Rect[] buttons = new Rect[BUTTONS];
    public final Rect quit;
    public final int versionY;
    public final Rect profile;          // null when the cluster has no room for it
    public final boolean logoText;
    public final Rect[] icons = new Rect[ICONS];
    public final Rect sidebar;
    public final Rect[] partnerTiles;
    public final Rect banner;           // null when it does not fit

    public MenuLayout(int width, int height, int partnerCount, int logoTextWidth, int nameWidth) {
        float s = Math.max(0.45f, Math.min(width / 800f, height / 450f));
        scale = s;
        int bh = Math.max(16, Math.round(26 * s));
        int bw = Math.max(100, Math.round(151 * s));
        int gap = Math.max(3, Math.round(7.25f * s));
        int quitH = Math.max(14, Math.round(26 * s)), quitW = Math.max(70, Math.round(118 * s));
        int markH = Math.max(16, Math.round(25 * s)), markW = (markH * 640 + 236) / 473;
        int versionGap = Math.max(4, Math.round(13.5f * s));
        int cx = width / 2;
        int chipPad = Math.max(4, Math.round(6 * s));
        int chipW = Math.max(44, Math.min(Math.round(125 * s), Math.max(Math.round(70 * s), bh - 6 + chipPad * 3 + nameWidth)));

        int top = Math.round(height / 2f + (218.75f - 225f) * s);
        int logoGap = Math.max(4, Math.round(8 * s));
        int logoY = Math.round(height / 2f + (135f - 225f) * s) - markH / 2;
        int bottomNeeded = top + BUTTONS * (bh + gap) + quitH + versionGap + 9;
        if (bottomNeeded > height - 3) {                          // tight screens: shrink gaps first, then slide up
            gap = Math.max(2, gap - 2);
            bottomNeeded = top + BUTTONS * (bh + gap) + quitH + versionGap + 9;
            int shift = Math.max(0, bottomNeeded - (height - 3));
            top -= shift;
        }
        if (logoY + markH + logoGap > top) logoY = top - logoGap - markH;
        if (logoY < 3) { logoY = 3; int over = logoY + markH + logoGap - top; if (over > 0) top += over; }

        int textGap = Math.max(6, Math.round(8 * s));
        int lockW = markW + textGap + logoTextWidth;
        int lockX = cx - lockW / 2;
        // top-right cluster: profile chip then six square icon buttons; defined before the logo is finalised so they can yield
        int margin = Math.max(6, Math.round(54 * s));
        int iconGap = Math.max(3, Math.round(5.5f * s));
        int clusterY = Math.max(4, Math.round(height / 2f + (33.5f - 225f) * s));
        Rect[] cluster = cluster(width, margin, iconGap, clusterY, bh, chipW);
        Rect lock = new Rect(lockX, logoY, lockW, markH);
        boolean text = true, chip = true;
        if (lock.intersects(union(cluster, true))) {
            cluster = cluster(width, 6, iconGap, clusterY, bh, chipW);
            if (lock.intersects(union(cluster, true))) {
                text = false; lockX = cx - markW / 2; lock = new Rect(lockX, logoY, markW, markH);
                if (lock.intersects(union(cluster, true))) chip = false;
            }
        }
        logoText = text;
        logoMark = new Rect(lockX, logoY, markW, markH);
        logoTextX = lockX + markW + textGap;
        logoTextY = logoY + (markH - CirrusUi.LINE) / 2;
        profile = chip ? cluster[ICONS] : null;
        System.arraycopy(cluster, 0, icons, 0, ICONS);

        for (int i = 0; i < BUTTONS; i++) buttons[i] = new Rect(cx - bw / 2, top + i * (bh + gap), bw, bh);
        int quitTop = top + BUTTONS * (bh + gap);
        quit = new Rect(cx - quitW / 2, quitTop, quitW, quitH);
        versionY = quitTop + quitH + versionGap;

        // left partner strip
        int tile = Math.max(16, Math.round(20 * s));
        int padS = Math.max(2, Math.round(2.5f * s));
        int pitch = Math.max(tile + 3, Math.round(30 * s));
        int sx = Math.max(2, Math.round(4 * s));
        int maxHeight = height - 2 * Math.max(4, Math.round(8 * s));
        int fit = Math.max(0, (maxHeight - 2 * padS + (pitch - tile)) / pitch);
        int n = Math.min(partnerCount, fit);
        if (n == 0) { sidebar = null; partnerTiles = new Rect[0]; }
        else {
            int panelH = n * pitch - (pitch - tile) + 2 * padS;
            int panelY = Math.round(height / 2f - panelH / 2f - 0.5f * s);
            sidebar = new Rect(sx, panelY, tile + 2 * padS, panelH);
            partnerTiles = new Rect[n];
            for (int i = 0; i < n; i++) partnerTiles[i] = new Rect(sx + padS, panelY + padS + i * pitch, tile, tile);
        }

        // bottom-right promotion banner, only when it is readable and clear of the button column
        int bnW = Math.round(135 * s), bnH = Math.round(76 * s);
        int bnX = width - margin - bnW, bnY = Math.round(height / 2f + (320f - 225f) * s);
        Rect candidate = new Rect(bnX, bnY, bnW, bnH);
        Rect column = new Rect(cx - bw / 2 - 6, top, bw + 12, versionY + 9 - top);
        banner = bnW >= 84 && bnY + bnH <= height - 3 && !candidate.intersects(column) ? candidate : null;
    }

    private static Rect[] cluster(int width, int margin, int iconGap, int y, int bh, int chipW) {
        Rect[] out = new Rect[ICONS + 1];
        int x = width - margin - ICONS * bh - (ICONS - 1) * iconGap;
        for (int i = 0; i < ICONS; i++) out[i] = new Rect(x + i * (bh + iconGap), y, bh, bh);
        out[ICONS] = new Rect(out[0].x() - iconGap - chipW, y, chipW, bh);
        return out;
    }

    private static Rect union(Rect[] cluster, boolean withChip) {
        Rect first = withChip ? cluster[ICONS] : cluster[0], last = cluster[ICONS - 1];
        return new Rect(first.x(), first.y(), last.right() - first.x(), first.h());
    }
}
