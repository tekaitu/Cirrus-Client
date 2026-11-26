package dev.cirrus.client.ui;

import dev.cirrus.client.render.McCanvas;

import dev.cirrus.client.render.McInput;
import dev.cirrus.core.input.Keys;
import dev.cirrus.core.theme.CirrusTheme;
import dev.cirrus.core.anim.Anim;
import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.theme.Appearance;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/**
 * Base for every Cirrus screen. It fixes the render order once: backdrop (renderBackground, called by the game exactly once),
 * then the screen's own surfaces, then the widgets, then overlays. No screen calls renderBackground itself.
 */
public abstract class CirrusScreen extends Screen {
    protected final Screen parent;
    private final long openedAt = Anim.now();

    protected CirrusScreen(Component title, Screen parent) {
        super(title);
        this.parent = parent;
    }

    protected final CirrusConfig config() { return CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath()); }
    protected final CirrusTheme theme() { return CirrusTheme.current(config()); }
    /** True when there is not much room; layouts drop optional elements instead of overlapping. */
    protected final boolean compact() { return width < 360 || height < 210; }

    /** Main navigation. Screens that return a tab get the shared Cirrus header (brand, tabs, player, close). */
    public enum Tab { MODS, HUD, HOME }
    protected Tab activeTab() { return null; }
    /** Content area below the header, filled in by buildHeader(). */
    protected int margin, contentX, contentY, contentW, contentBottom, headerBottom;
    private String playerName = "";

    protected final void buildHeader() {
        Tab active = activeTab();
        boolean small = compact();
        margin = small ? 8 : 12;
        contentX = margin;
        contentW = width - margin * 2;
        contentBottom = height - margin;
        playerName = minecraft.getUser() == null ? "" : minecraft.getUser().getName();
        boolean twoRows = !small && height >= 250 && width >= 420;
        int rowH = 24;
        int closeSize = 22;
        int y = margin;
        int markSize = twoRows ? 28 : 18;
        int brandW = twoRows ? CirrusUi.brandWidth(font, markSize) : dev.cirrus.core.theme.Brand.markWidth(markSize);
        int tabsY = twoRows ? y + markSize + 8 : y;
        // right cluster: close button, then (roomy only) the player chip
        addRenderableWidget(CirrusButton.icon(width - margin - closeSize, y + (twoRows ? (markSize - closeSize) / 2 : (rowH - closeSize) / 2), closeSize, CirrusUi.ICON_CLOSE, b -> closeAll()));
        // tabs
        String[] labels = {"Mods", "HUD", "Home"};
        int[] icons = {CirrusUi.ICON_MODS, CirrusUi.ICON_HUD, CirrusUi.ICON_DASHBOARD};
        Tab[] tabs = Tab.values();
        int left = twoRows ? margin : margin + brandW + 10;
        int right = twoRows ? width - margin : width - margin - closeSize - 6;
        int fullW = 0;
        int[] widths = new int[labels.length];
        for (int i = 0; i < labels.length; i++) { widths[i] = CirrusUi.bodyWidth(font, labels[i]) + 36; fullW += widths[i] + 4; }
        boolean iconsOnly = fullW - 4 > right - left;
        int x = left;
        for (int i = 0; i < labels.length; i++) {
            int w = iconsOnly ? rowH + 6 : widths[i];
            final Tab target = tabs[i];
            addRenderableWidget(CirrusButton.tab(x, tabsY, w, rowH, iconsOnly ? Component.empty() : Component.literal(labels[i]), icons[i], tabs[i] == active, b -> { if (target != active) openTab(target); }));
            x += w + 4;
        }
        headerBottom = tabsY + rowH;
        contentY = headerBottom + (small ? 6 : 10);
        this.twoRowHeader = twoRows;
        this.headerMark = markSize;
    }

    private boolean twoRowHeader;
    private int headerMark;

    private void openTab(Tab tab) {
        minecraft.setScreen(switch (tab) {
            case MODS -> new dev.cirrus.client.CirrusMenuScreen(parent);
            case HUD -> parent instanceof dev.cirrus.client.HudEditorScreen editor ? editor : new dev.cirrus.client.HudEditorScreen(this);
            case HOME -> new dev.cirrus.client.CirrusDashboardScreen(parent);
        });
    }

    /** Leaves the whole Cirrus flow: back to the game or to whichever vanilla screen opened it. */
    protected final void closeAll() {
        Screen root = this;
        while (root instanceof CirrusScreen cs && cs.parent != null) root = cs.parent;
        minecraft.setScreen(root instanceof CirrusScreen ? null : root);
    }

    protected final void drawHeader(GuiGraphics g, CirrusTheme t) {
        boolean small = compact();
        int y = margin;
        if (twoRowHeader) {
            CirrusUi.brand(g, margin, y, headerMark, t);
        } else {
            CirrusUi.mark(g, margin, y + (24 - headerMark) / 2, headerMark, t);
        }
        if (twoRowHeader && !playerName.isEmpty()) {
            int closeSize = 22, chipH = 22;
            int nameW = CirrusUi.bodyWidth(font, playerName);
            int chipW = nameW + 34;
            int cx = width - margin - closeSize - 6 - chipW, cy = y + (headerMark - chipH) / 2;
            CirrusUi.card(g, cx, cy, chipW, chipH, 8, t.surface, t.border);
            Gfx.fillRound(g, cx + 4, cy + 4, 14, 14, 4, 0xFF2A2A2A);
            CirrusUi.centeredSmall(g, font, playerName.substring(0, 1).toUpperCase(java.util.Locale.ROOT), cx + 11, cy + 7, 0xFFFFFFFF);
            CirrusUi.text(g, font, playerName, cx + 24, cy + 6, t.text, false);
        }
    }

    /**
     * Minecraft's own scenery stays visible. Out of a world that is the vanilla panorama, untouched (no dim, no blur). In a world it is
     * the live game under the Appearance "Screen dim", blurred first when the player chose to blur behind every menu.
     */
    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) {
        drawScenery(g, delta, Appearance.blurMenus(config()));
    }

    /** The shared scenery for Maple screens: panorama out of a world, otherwise the (optionally blurred) game with the themed dim. */
    protected final void drawScenery(GuiGraphics g, float delta, boolean blur) {
        if (minecraft.level == null) { renderPanorama(g, delta); return; }
        if (blur) renderBlurredBackground(g);
        CirrusUi.backdrop(g, width, height, theme());
    }

    @Override public final void render(GuiGraphics g, int mx, int my, float delta) {
        dev.cirrus.core.perf.PerfMeter.MENU.begin();
        Look.refresh(config());
        CirrusTheme t = theme();
        if (activeTab() != null) drawHeader(g, t);
        drawSurfaces(g, mx, my, delta, t);
        super.render(g, mx, my, delta);
        drawOverlay(g, mx, my, delta, t);
        float open = Anim.easeOut((Anim.now() - openedAt) / 200f);
        if (open < 1f) McCanvas.of(g).fill(0, 0, width, height, Gfx.withAlpha(0xFF000000, Math.round((1f - open) * 120)));
        dev.cirrus.core.perf.PerfMeter.MENU.end();
        dev.cirrus.core.perf.PerfOverlay.draw(dev.cirrus.client.render.McCanvas.of(g), height);
        McInput.INSTANCE.endFrame();
    }

    /** Panels, cards and static text. Widgets are drawn after this. */
    protected abstract void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t);
    /** Anything that must sit above the widgets. */
    protected void drawOverlay(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) { }

    // ---- input -----------------------------------------------------------------------------------------------------------
    // Every event enters through these final methods, which report it to the Core input model ({@link McInput}) before the screen
    // handles it. Screens override the protected on* hooks instead, so no handler can swallow an event before Core sees it.

    @Override public final void mouseMoved(double x, double y) { McInput.INSTANCE.mouseMoved(x, y); super.mouseMoved(x, y); }

    @Override public final boolean mouseClicked(net.minecraft.client.input.MouseButtonEvent event, boolean doubleClick) {
        McInput.INSTANCE.mousePressed(event);
        return onMouseClicked(event, doubleClick);
    }

    @Override public final boolean mouseReleased(net.minecraft.client.input.MouseButtonEvent event) {
        McInput.INSTANCE.mouseReleased(event);
        return onMouseReleased(event);
    }

    @Override public final boolean mouseDragged(net.minecraft.client.input.MouseButtonEvent event, double dx, double dy) {
        McInput.INSTANCE.mouseMoved(event.x(), event.y());
        return onMouseDragged(event, dx, dy);
    }

    @Override public final boolean mouseScrolled(double x, double y, double h, double v) {
        McInput.INSTANCE.mouseScrolled(x, y, h, v);
        return onMouseScrolled(x, y, h, v);
    }

    @Override public final boolean keyPressed(net.minecraft.client.input.KeyEvent event) {
        McInput.INSTANCE.keyPressed(event);
        return onKeyPressed(event);
    }

    @Override public final boolean keyReleased(net.minecraft.client.input.KeyEvent event) {
        McInput.INSTANCE.keyReleased(event);
        return super.keyReleased(event);
    }

    protected boolean onMouseClicked(net.minecraft.client.input.MouseButtonEvent event, boolean doubleClick) { return super.mouseClicked(event, doubleClick); }
    protected boolean onMouseReleased(net.minecraft.client.input.MouseButtonEvent event) { return super.mouseReleased(event); }
    protected boolean onMouseDragged(net.minecraft.client.input.MouseButtonEvent event, double dx, double dy) { return super.mouseDragged(event, dx, dy); }
    protected boolean onMouseScrolled(double x, double y, double h, double v) { return super.mouseScrolled(x, y, h, v); }

    /** Right Shift closes any Cirrus screen straight back to the game (or to the screen that opened the menu). */
    protected boolean onKeyPressed(net.minecraft.client.input.KeyEvent event) {
        if (event.key() == Keys.RIGHT_SHIFT && !(getFocused() instanceof net.minecraft.client.gui.components.EditBox box && box.isFocused())) {
            closeAll();
            return true;
        }
        return super.keyPressed(event);
    }

    @Override public void onClose() { McInput.INSTANCE.reset(); minecraft.setScreen(parent); }
}
