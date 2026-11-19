package dev.cirrus.client;

import dev.cirrus.client.asset.CirrusAssetTextures;
import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.dashboard.CirrusDashboard;
import dev.cirrus.client.dashboard.DashboardConfig;
import dev.cirrus.client.dashboard.ServerStatus;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Glyphs;
import dev.cirrus.client.ui.Gfx;
import dev.cirrus.client.ui.MenuButton;
import dev.cirrus.client.ui.MenuLayout;
import dev.cirrus.client.ui.PartnerTile;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.components.PlayerFaceRenderer;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.ChatOptionsScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.options.SkinCustomizationScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.multiplayer.resolver.ServerAddress;
import net.minecraft.client.gui.screens.ConnectScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.PlayerSkin;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/**
 * Cirrus main menu, laid out like the Feather client's: centred logo and button column, profile chip with six icon buttons
 * top right, a vertical partner strip on the left and a promotion banner bottom right. All dynamic content (partners,
 * banners, store link) comes from {@link CirrusDashboard}. It extends the vanilla TitleScreen so other mods and the game still
 * see a title screen, but it owns its layout and draws every element exactly once, back to front.
 */
public final class CirrusTitleScreen extends TitleScreen {
    private final List<AbstractWidget> widgets = new ArrayList<>();
    private final List<PartnerTile> tiles = new ArrayList<>();
    private MenuLayout layout;
    private DashboardConfig dashboard;
    private Supplier<PlayerSkin> skin;
    private String playerName = "";
    private String versionLine = "";
    private long openedAt;

    public CirrusTitleScreen() { super(false); }

    @Override protected void init() {
        widgets.clear();
        tiles.clear();
        CirrusDashboard.refreshOnce();
        dashboard = CirrusDashboard.get();
        Minecraft mc = minecraft;
        if (skin == null) skin = mc.getSkinManager().createLookup(mc.getGameProfile(), false);
        playerName = mc.getUser().getName();
        versionLine = "Cirrus " + modVersion("cirrus_fabric") + "  ·  Minecraft " + modVersion("minecraft");
        if (openedAt == 0) openedAt = System.currentTimeMillis();

        int nameWidth = CirrusUi.bodyWidth(font, playerName);
        layout = new MenuLayout(width, height, dashboard.partners().size(), CirrusUi.headingWidth(font, "CIRRUS CLIENT"), nameWidth);
        MenuLayout.Rect[] b = layout.buttons;
        DashboardConfig.Store store = dashboard.store();

        add(MenuButton.list(b[0].x(), b[0].y(), b[0].w(), b[0].h(), "Singleplayer", Glyphs.SINGLEPLAYER, x -> minecraft.setScreen(new SelectWorldScreen(this))));
        add(MenuButton.list(b[1].x(), b[1].y(), b[1].w(), b[1].h(), "Multiplayer", Glyphs.MULTIPLAYER, x -> minecraft.setScreen(new CirrusMultiplayerScreen(this))));
        add(MenuButton.list(b[2].x(), b[2].y(), b[2].w(), b[2].h(), "Cosmetics", Glyphs.COSMETICS, x -> minecraft.setScreen(new SkinCustomizationScreen(this, minecraft.options))));
        add(MenuButton.list(b[3].x(), b[3].y(), b[3].w(), b[3].h(), "Screenshots", Glyphs.SCREENSHOTS, x -> PlatformOpen.folder(PlatformOpen.screenshots())));
        MenuButton storeButton = MenuButton.primary(b[4].x(), b[4].y(), b[4].w(), b[4].h(), store.label(), Glyphs.STORE, x -> PlatformOpen.link(this, store.url()));
        if (!store.enabled()) storeButton.setTooltip(Tooltip.create(Component.literal("The Cirrus store is not connected yet. It is configured from the Cirrus dashboard.")));
        else if (!dashboard.storePromos().isEmpty()) storeButton.setTooltip(Tooltip.create(Component.literal(dashboard.storePromos().get(0).text())));
        add(storeButton);
        MenuLayout.Rect q = layout.quit;
        add(MenuButton.quit(q.x(), q.y(), q.w(), q.h(), "QUIT GAME", x -> minecraft.stop()));

        MenuLayout.Rect[] i = layout.icons;
        add(MenuButton.square(i[0].x(), i[0].y(), i[0].w(), Glyphs.GRID, "Mod menu  (Right Shift)", x -> minecraft.setScreen(new CirrusMenuScreen(this))));
        add(MenuButton.square(i[1].x(), i[1].y(), i[1].w(), Glyphs.CHAT, "Chat settings", x -> minecraft.setScreen(new ChatOptionsScreen(this, minecraft.options))));
        add(MenuButton.square(i[2].x(), i[2].y(), i[2].w(), Glyphs.SETTINGS, "Game options", x -> minecraft.setScreen(new OptionsScreen(this, minecraft.options))));
        add(MenuButton.square(i[3].x(), i[3].y(), i[3].w(), Glyphs.GEM, "Themes", x -> minecraft.setScreen(new CirrusThemesScreen(this))));
        add(MenuButton.square(i[4].x(), i[4].y(), i[4].w(), Glyphs.BOX, "Cirrus home", x -> minecraft.setScreen(new CirrusDashboardScreen(this))));
        add(MenuButton.square(i[5].x(), i[5].y(), i[5].w(), Glyphs.LIST, "HUD editor", x -> minecraft.setScreen(new HudEditorScreen(this))));

        for (int n = 0; n < layout.partnerTiles.length; n++) {
            DashboardConfig.Partner p = dashboard.partners().get(n);
            MenuLayout.Rect r = layout.partnerTiles[n];
            PartnerTile tile = new PartnerTile(r.x(), r.y(), r.w(), p, x -> join(p));
            tiles.add(tile);
            add(tile);
            ServerStatus.ensurePinged(p.name(), p.address());
        }
    }

    private void join(DashboardConfig.Partner p) {
        ConnectScreen.startConnecting(this, minecraft, ServerAddress.parseString(p.address()), ServerStatus.data(p.name(), p.address()), false, null);
    }

    private static String modVersion(String id) {
        return FabricLoader.getInstance().getModContainer(id).map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("?");
    }

    private void add(AbstractWidget widget) { widgets.add(widget); addRenderableWidget(widget); }

    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) {
        CirrusUi.backdrop(g, width, height, theme());
    }

    @Override public void render(GuiGraphics g, int mx, int my, float delta) {
        CirrusTheme t = theme();
        float fade = Math.min(1f, (System.currentTimeMillis() - openedAt) / 260f);
        drawLogo(g, t);
        drawStrip(g, t);
        for (AbstractWidget w : widgets) w.render(g, mx, my, delta);
        CirrusUi.centeredSmall(g, font, versionLine, width / 2, layout.versionY, Gfx.scaleAlpha(t.muted, 0.8f));
        drawProfile(g, t);
        drawBanner(g, t);
        if (fade < 1f) g.fill(0, 0, width, height, Gfx.withAlpha(0xFF04070D, Math.round((1f - fade) * 200)));
    }

    private void drawLogo(GuiGraphics g, CirrusTheme t) {
        MenuLayout.Rect m = layout.logoMark;
        CirrusAssetTextures.drawMark(g, m.x(), m.y(), m.w(), m.h(), t == CirrusTheme.LIGHT ? t.accent : 0xFFFFFFFF);
        if (layout.logoText) CirrusUi.headingText(g, font, "CIRRUS CLIENT", layout.logoTextX, layout.logoTextY, t.text);
    }

    private void drawStrip(GuiGraphics g, CirrusTheme t) {
        MenuLayout.Rect s = layout.sidebar;
        if (s == null) return;
        Gfx.fillRound(g, s.x(), s.y(), s.w(), s.h(), 7, Gfx.mix(0xD0070B14, t.accent, 0.05f));
        Gfx.strokeRound(g, s.x(), s.y(), s.w(), s.h(), 7, 0.5f, Gfx.scaleAlpha(t.border, 0.8f));
    }

    private void drawProfile(GuiGraphics g, CirrusTheme t) {
        MenuLayout.Rect p = layout.profile;
        if (p == null) return;
        float radius = Math.min(p.h() * 0.24f, 8f);
        Gfx.fillRound(g, p.x(), p.y(), p.w(), p.h(), radius, 0xE60A0F1A);
        Gfx.hairline(g, p.x() + radius, p.y() + 1, p.w() - radius * 2, Gfx.scaleAlpha(t.highlight, 1.6f));
        Gfx.strokeRound(g, p.x(), p.y(), p.w(), p.h(), radius, 0.5f, Gfx.scaleAlpha(t.border, 0.7f));
        int face = Math.max(10, p.h() - 8), pad = Math.max(4, Math.round(layout.scale * 6));
        PlayerFaceRenderer.draw(g, skin.get(), p.x() + pad - 1, p.y() + (p.h() - face) / 2, face);
        int tx = p.x() + pad - 1 + face + pad;
        CirrusUi.text(g, font, CirrusUi.fitBody(font, playerName, p.right() - pad - tx), tx, p.y() + (p.h() - CirrusUi.LINE) / 2, t.text, false);
    }

    private void drawBanner(GuiGraphics g, CirrusTheme t) {
        MenuLayout.Rect r = layout.banner;
        if (r == null || dashboard.banners().isEmpty()) return;
        List<DashboardConfig.Banner> banners = dashboard.banners();
        int index = (int) ((System.currentTimeMillis() / 9000L) % banners.size());
        DashboardConfig.Banner b = banners.get(index);
        float radius = Math.min(8f, r.h() * 0.1f);
        int a = 0xFF000000 | b.colorA(), c = 0xFF000000 | b.colorB();
        Gfx.fillRound(g, r.x(), r.y(), r.w(), r.h(), radius, Gfx.mix(a, 0xFF05080F, 0.35f));
        g.enableScissor(r.x(), r.y(), r.right(), r.bottom());
        int glow = Math.round(r.h() * 1.5f);                       // round glow in the lower right, clipped to the banner
        Gfx.fillRound(g, r.right() - glow * 0.6f, r.bottom() - glow * 0.6f, glow, glow, glow / 2f, Gfx.scaleAlpha(c, 0.30f));
        Gfx.fillRound(g, r.right() - glow * 0.4f, r.bottom() - glow * 0.4f, glow * 0.7f, glow * 0.7f, glow * 0.35f, Gfx.scaleAlpha(c, 0.25f));
        g.disableScissor();
        Gfx.hairline(g, r.x() + radius, r.y() + 1, r.w() - radius * 2, Gfx.scaleAlpha(t.highlight, 2.4f));
        Gfx.strokeRound(g, r.x(), r.y(), r.w(), r.h(), radius, 0.5f, Gfx.mix(t.border, c, 0.55f));
        int mh = r.h() / 2, mw = (mh * 640 + 236) / 473;
        CirrusAssetTextures.drawMark(g, r.right() - mw - 6, r.y() + 6, mw, mh, 0x1CFFFFFF);
        int pad = Math.max(6, Math.round(layout.scale * 8)), tw = r.w() - pad * 2;
        int y = r.y() + pad;
        CirrusUi.headingText(g, font, CirrusUi.fit(font, b.title(), tw, CirrusUi::heading), r.x() + pad, y, 0xFFFFFFFF);
        y += CirrusUi.LINE + 4;
        for (var line : font.split(CirrusUi.small(b.subtitle()), tw)) {
            if (y + 8 > r.bottom() - pad - (b.cta().isEmpty() ? 0 : 12)) break;
            g.drawString(font, line, r.x() + pad, y + 1, Gfx.scaleAlpha(0xFFFFFFFF, 0.78f), false);
            y += 10;
        }
        if (!b.cta().isEmpty()) {
            int cw = CirrusUi.bodyWidth(font, b.cta()) + 14, ch = 13, cy = r.bottom() - pad - ch + 3;
            Gfx.fillRound(g, r.x() + pad, cy, cw, ch, ch / 2f, Gfx.mix(t.accent, t.cyan, 0.3f));
            CirrusUi.text(g, font, b.cta(), r.x() + pad + 7, cy + 2, 0xFFFFFFFF, false);
        }
        if (banners.size() > 1) {
            for (int i = 0; i < banners.size(); i++) Gfx.fillRound(g, r.right() - pad - (banners.size() - i) * 6, r.bottom() - 8, 3, 3, 1.5f, i == index ? 0xFFFFFFFF : 0x66FFFFFF);
        }
    }

    @Override public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        if (super.mouseClicked(event, doubleClick)) return true;
        MenuLayout.Rect r = layout == null ? null : layout.banner;
        if (r != null && !dashboard.banners().isEmpty() && event.x() >= r.x() && event.x() < r.right() && event.y() >= r.y() && event.y() < r.bottom()) {
            DashboardConfig.Banner b = dashboard.banners().get((int) ((System.currentTimeMillis() / 9000L) % dashboard.banners().size()));
            return PlatformOpen.link(this, b.url());
        }
        return false;
    }

    @Override public void tick() {
        ServerStatus.tick();
        for (PartnerTile tile : tiles) tile.refreshTooltip();
    }
    @Override public void added() { }
    @Override public void removed() { }

    private CirrusTheme theme() { return CirrusTheme.current(CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath())); }
}
