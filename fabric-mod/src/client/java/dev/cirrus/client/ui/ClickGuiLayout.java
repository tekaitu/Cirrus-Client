package dev.cirrus.client.ui;

/**
 * Geometry of the unified Click GUI, in GUI units. Pure maths so every screen size can be unit-tested.
 * One window: a slim top bar (brand, home, close), a category sidebar and a content area. The content area has a header row
 * (search, profile, share, HUD editor) above the module grid. A module's settings, and the Profiles page, replace the whole content area.
 */
public final class ClickGuiLayout {
    public record Rect(int x, int y, int w, int h) {
        public int right() { return x + w; }
        public int bottom() { return y + h; }
        public boolean contains(double px, double py) { return px >= x && px < x + w && py >= y && py < y + h; }
        public boolean intersects(Rect o) { return x < o.right() && o.x < right() && y < o.bottom() && o.y < bottom(); }
    }

    public static final int TOP_H = 28, PAD = 8, DEFAULT_W = 540, DEFAULT_H = 320, HEADER_H = 20;
    public static final int MIN_W = 260, MIN_H = 170;

    public final Rect window, topBar, brand, homeButton, closeButton, sidebar, content, search, profileButton, shareButton, hudButton, list, pane, grip;
    /** Sidebar shows icons only. */
    public final boolean rail;
    /** Header buttons show their labels (otherwise icons only). */
    public final boolean hudLabel, profileLabel;
    /** Module grid columns: 2 when the list is wide enough, otherwise 1. */
    public final int columns;

    /** @param prefW,prefH the user's saved window size (0 = default); @param brandW width of the brand lockup, 0 for the mark only */
    public ClickGuiLayout(int sw, int sh, int prefW, int prefH, int brandW) {
        int margin = sw < 360 || sh < 210 ? 4 : 8;
        int maxW = Math.max(1, sw - margin * 2), maxH = Math.max(1, sh - margin * 2);
        int w = prefW > 0 ? clamp(prefW, Math.min(MIN_W, maxW), maxW) : Math.min(maxW, DEFAULT_W);
        int h = prefH > 0 ? clamp(prefH, Math.min(MIN_H, maxH), maxH) : Math.min(maxH, DEFAULT_H);
        int x = (sw - w) / 2, y = (sh - h) / 2;
        window = new Rect(x, y, w, h);
        int topH = Math.min(TOP_H, h / 4);
        topBar = new Rect(x, y, w, topH);
        int bs = Math.min(20, topH - 4), by = y + (topH - bs) / 2;
        closeButton = new Rect(x + w - PAD - bs, by, bs, bs);
        homeButton = new Rect(closeButton.x() - 4 - bs, by, bs, bs);
        brand = new Rect(x + PAD, by, Math.max(brandW, 24), bs);

        int bodyTop = y + topH, bodyH = h - topH;
        rail = w < 400;
        int sideW = rail ? 32 : 100;
        sidebar = new Rect(x, bodyTop, sideW, bodyH);
        int cx = x + sideW + PAD, cw = Math.max(1, w - sideW - PAD * 2), innerH = Math.max(1, bodyH - PAD * 2);
        content = new Rect(cx, bodyTop + PAD, cw, innerH);
        pane = content;

        // header row, right to left: HUD editor, share, profile; the search box takes what is left
        int hy = content.y();
        boolean roomy = cw >= 300;
        hudLabel = roomy;
        int hudW = hudLabel ? 92 : HEADER_H;
        boolean wantProfile = cw >= 400;
        profileLabel = wantProfile;
        int profW = profileLabel ? 112 : HEADER_H;
        hudButton = new Rect(content.right() - hudW, hy, hudW, HEADER_H);
        shareButton = new Rect(hudButton.x() - 4 - HEADER_H, hy, HEADER_H, HEADER_H);
        profileButton = new Rect(shareButton.x() - 4 - profW, hy, profW, HEADER_H);
        search = new Rect(cx, hy, Math.max(40, profileButton.x() - 8 - cx), HEADER_H);

        int listTop = hy + HEADER_H + 8;
        list = new Rect(cx, listTop, cw, Math.max(1, content.bottom() - listTop));
        columns = cw >= 300 ? 2 : 1;
        grip = new Rect(x + w - 12, y + h - 12, 12, 12);
    }

    public static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(hi, v)); }
}
