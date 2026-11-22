package dev.cirrus.core.layout;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ClickGuiLayoutTest {
    // GUI-unit sizes for window sizes 854x480 / 1920x1080 / 2560x1440 at GUI scales 1-6 and some odd shapes.
    private static final int[][] SIZES = {{854, 480}, {640, 360}, {480, 270}, {427, 240}, {320, 180}, {284, 160}, {960, 540}, {1920, 1080}, {600, 450}, {320, 240}, {400, 600}, {250, 150}};

    @Test void windowIsCentredAndInsideTheScreenAtAnySize() {
        for (int[] s : SIZES) {
            var l = new ClickGuiLayout(s[0], s[1], 0, 0, 90);
            String at = s[0] + "x" + s[1];
            assertInside(l.window, s[0], s[1], at);
            assertEquals(s[0], l.window.x() * 2 + l.window.w(), 1, at + " centred horizontally");
            assertEquals(s[1], l.window.y() * 2 + l.window.h(), 1, at + " centred vertically");
        }
    }

    @Test void partsStayInsideTheWindowAndDoNotOverlap() {
        for (int[] s : SIZES) for (int pw : new int[] {0, 300, 900}) {
            var l = new ClickGuiLayout(s[0], s[1], pw, pw == 0 ? 0 : pw / 2, 90);
            String at = s[0] + "x" + s[1] + " pref " + pw;
            for (var r : new ClickGuiLayout.Rect[] {l.topBar, l.sidebar, l.content, l.list, l.pane, l.grip, l.search, l.hudButton, l.profileButton, l.shareButton, l.homeButton, l.closeButton, l.brand})
                assertInside(r, l.window, at);
            assertFalse(l.sidebar.intersects(l.content), at + " sidebar/content");
            assertFalse(l.topBar.intersects(l.sidebar), at + " topbar/sidebar");
            assertFalse(l.search.intersects(l.profileButton), at + " search/profile");
            assertFalse(l.profileButton.intersects(l.shareButton), at + " profile/share");
            assertFalse(l.shareButton.intersects(l.hudButton), at + " share/hud");
            assertFalse(l.search.intersects(l.shareButton), at + " search/share");
            assertFalse(l.homeButton.intersects(l.closeButton), at + " home/close");
            assertFalse(l.brand.intersects(l.homeButton), at + " brand/home");
            assertFalse(l.list.y() < l.search.bottom(), at + " list starts below the header");
            for (var r : new ClickGuiLayout.Rect[] {l.search, l.profileButton, l.shareButton, l.hudButton, l.list}) assertInside(r, l.content, at);
            assertTrue(l.list.w() > 20 && l.list.h() > 20, at + " list has room: " + l.list);
            assertTrue(l.search.w() >= 40, at + " search has room: " + l.search.w());
        }
    }

    @Test void layoutAdaptsToTheAvailableWidth() {
        var wide = new ClickGuiLayout(854, 480, 0, 0, 90);
        assertTrue(!wide.rail && wide.hudLabel && wide.profileLabel);
        assertEquals(2, wide.columns);
        assertEquals(ClickGuiLayout.DEFAULT_W, wide.window.w());
        var narrow = new ClickGuiLayout(320, 180, 0, 0, 0);
        assertTrue(narrow.rail && !narrow.hudLabel && !narrow.profileLabel);
        assertEquals(1, narrow.columns);
    }

    @Test void savedSizeIsClampedToTheScreenAndMinimums() {
        var big = new ClickGuiLayout(480, 270, 5000, 5000, 90);
        assertTrue(big.window.w() <= 480 - 8 && big.window.h() <= 270 - 8);
        var small = new ClickGuiLayout(854, 480, 10, 10, 90);
        assertEquals(ClickGuiLayout.MIN_W, small.window.w());
        assertEquals(ClickGuiLayout.MIN_H, small.window.h());
        var custom = new ClickGuiLayout(854, 480, 400, 250, 90);
        assertEquals(400, custom.window.w());
        assertEquals(250, custom.window.h());
    }

    private static void assertInside(ClickGuiLayout.Rect r, int w, int h, String at) {
        assertTrue(r.x() >= 0 && r.y() >= 0 && r.right() <= w && r.bottom() <= h, at + " rect outside screen: " + r);
    }

    private static void assertInside(ClickGuiLayout.Rect r, ClickGuiLayout.Rect win, String at) {
        assertTrue(r.x() >= win.x() && r.y() >= win.y() && r.right() <= win.right() && r.bottom() <= win.bottom(), at + " rect outside " + win + ": " + r);
    }
}
