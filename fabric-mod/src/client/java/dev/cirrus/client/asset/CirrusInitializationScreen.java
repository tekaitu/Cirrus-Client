package dev.cirrus.client.asset;

import dev.cirrus.client.CirrusWelcomeScreen;
import dev.cirrus.client.ui.CirrusScreen;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import dev.cirrus.client.ui.Gfx;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Responsive first-launch progress view; all network work is handled by AssetManager's worker. */
public final class CirrusInitializationScreen extends CirrusScreen {
    private final AssetManager assets;
    private boolean continued;

    public CirrusInitializationScreen(Screen parent, AssetManager assets) {
        super(Component.literal("Initializing Cirrus"), parent);
        this.assets = assets;
        assets.initialize();
    }

    @Override public void tick() {
        if (!continued && assets.snapshot().finished()) {
            continued = true;
            CirrusAssetTextures.load(assets);
            Minecraft client = Minecraft.getInstance();
            client.setScreen(config().getBoolean("onboarding.complete", false) ? parent : new CirrusWelcomeScreen(parent));
        }
    }

    @Override protected void drawSurfaces(GuiGraphics g, int mx, int my, float delta, CirrusTheme t) {
        boolean roomy = height >= 200;
        int pw = Math.min(320, width - 16), ph = Math.min(height - 16, roomy ? 196 : 150);
        int px = (width - pw) / 2, py = (height - ph) / 2, cxm = width / 2;
        CirrusUi.panel(g, px, py, pw, ph, 18, t);
        int mark = roomy ? 30 : 22;
        int y = py + 14;
        CirrusUi.brand(g, (width - CirrusUi.brandWidth(font, mark)) / 2, y, mark, t);
        y += mark + 10;
        CirrusUi.loadingFrame(g, cxm - 10, y, 20, System.currentTimeMillis() / 80L);
        y += 26;
        AssetManager.Snapshot status = assets.snapshot();
        CirrusUi.centeredHeading(g, font, "PREPARING YOUR CLIENT", cxm, y, t.text);
        y += 14;
        CirrusUi.centeredSmall(g, font, CirrusUi.fitSmall(font, status.message(), pw - 32), cxm, y, t.cyan);
        if (roomy) {
            y += 13;
            String count = status.totalRequired() == 0 ? "Checking available resources"
                : status.downloadedRequired() + " of " + status.totalRequired() + " required files verified";
            CirrusUi.centeredSmall(g, font, count, cxm, y, t.muted);
        }
        int barW = pw - 64, barX = cxm - barW / 2, barY = py + ph - 18;
        Gfx.fillRound(g, barX, barY, barW, 6, 3, t.surface);
        float progress = status.totalRequired() == 0 ? 0f : Math.min(1f, (float) status.downloadedRequired() / status.totalRequired());
        int pwid = Math.max(status.state() == AssetManager.State.DOWNLOADING ? 6 : 0, Math.round(barW * progress));
        if (pwid > 0) Gfx.fillRound(g, barX, barY, pwid, 6, 3, t.accent);
    }

    @Override public boolean shouldCloseOnEsc() { return false; }
}
