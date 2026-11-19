package dev.cirrus.client.ui;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MenuLayoutTest {
    private static final int[][] SIZES = {{284, 160}, {320, 180}, {427, 240}, {480, 270}, {640, 360}, {800, 450}, {960, 540}, {1024, 576}, {600, 450}, {320, 240}};

    @Test void referenceSizeMatchesTheFeatherComposition() {
        MenuLayout l = new MenuLayout(800, 450, 6, 90, 60);
        assertEquals(1f, l.scale, 0.001f);
        assertEquals(151, l.buttons[0].w());
        assertEquals(26, l.buttons[0].h());
        assertEquals(400, l.buttons[0].x() + l.buttons[0].w() / 2, "button column is centred");
        assertEquals(33, l.buttons[1].y() - l.buttons[0].y(), 1, "button pitch is about 33 units");
        assertEquals(6, l.partnerTiles.length);
        assertNotNull(l.banner, "banner is shown at the reference size");
        assertTrue(l.banner.x() > l.buttons[0].right(), "banner sits to the right of the column");
        assertTrue(l.banner.bottom() > l.buttons[4].bottom(), "banner is in the lower right");
        assertTrue(l.sidebar.x() < 8 && l.sidebar.right() < l.buttons[0].x(), "strip hugs the left edge");
        assertTrue(l.icons[5].right() <= 800 - 6, "icons stay on screen");
        assertTrue(l.profile.right() < l.icons[0].x(), "profile chip is left of the icons");
        assertTrue(l.quit.y() > l.buttons[4].bottom(), "quit is under the column");
    }

    @Test void nothingOverlapsOrLeavesTheScreenAtAnySize() {
        for (int[] size : SIZES) {
            int w = size[0], h = size[1];
            MenuLayout l = new MenuLayout(w, h, 6, 80, 60);
            String at = w + "x" + h;
            for (MenuLayout.Rect r : l.buttons) assertInside(r, w, h, at);
            assertInside(l.quit, w, h, at);
            assertInside(l.logoMark, w, h, at);
            for (MenuLayout.Rect r : l.icons) assertInside(r, w, h, at);
            for (MenuLayout.Rect r : l.partnerTiles) assertInside(r, w, h, at);
            if (l.banner != null) assertInside(l.banner, w, h, at);
            assertTrue(l.versionY + 9 <= h, at + " version text fits");
            for (int i = 1; i < l.buttons.length; i++) assertFalse(l.buttons[i].intersects(l.buttons[i - 1]), at + " buttons overlap");
            assertFalse(l.quit.intersects(l.buttons[4]), at);
            assertTrue(l.logoMark.bottom() <= l.buttons[0].y(), at + " logo above the buttons");
            if (l.banner != null) for (MenuLayout.Rect r : l.buttons) assertFalse(l.banner.intersects(r), at + " banner overlaps buttons");
            for (MenuLayout.Rect t : l.partnerTiles) for (MenuLayout.Rect b : l.buttons) assertFalse(t.intersects(b), at + " tile overlaps buttons");
            for (MenuLayout.Rect i : l.icons) for (MenuLayout.Rect b : l.buttons) assertFalse(i.intersects(b), at + " icon overlaps buttons");
            if (l.profile != null) { assertFalse(l.profile.intersects(l.icons[0]), at); assertFalse(l.profile.intersects(l.logoMark), at + " profile vs logo"); assertInside(l.profile, w, h, at); }
            for (MenuLayout.Rect i : l.icons) assertFalse(i.intersects(l.logoMark), at + " icon vs logo");
            if (l.logoText) for (MenuLayout.Rect i : l.icons) assertFalse(i.x() < l.logoTextX + 80 && i.right() > l.logoTextX && i.y() < l.logoMark.bottom() && i.bottom() > l.logoMark.y(), at + " icon vs wordmark");
        }
    }

    @Test void noPartnersMeansNoSidebar() {
        assertNull(new MenuLayout(800, 450, 0, 80, 60).sidebar);
        assertEquals(0, new MenuLayout(800, 450, 0, 80, 60).partnerTiles.length);
    }

    @Test void tooManyPartnersAreClippedToWhatFits() {
        MenuLayout l = new MenuLayout(284, 160, 12, 80, 60);
        assertTrue(l.partnerTiles.length < 12 && l.partnerTiles.length > 0);
        assertTrue(l.sidebar.bottom() <= 160);
    }

    private static void assertInside(MenuLayout.Rect r, int w, int h, String at) {
        assertTrue(r.x() >= 0 && r.y() >= 0 && r.right() <= w && r.bottom() <= h, at + " rect out of bounds: " + r);
    }
}
