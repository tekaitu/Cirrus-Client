package dev.cirrus.client.asset;

import dev.cirrus.client.CirrusWelcomeScreen;
import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.ui.CirrusTheme;
import dev.cirrus.client.ui.CirrusUi;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Responsive first-launch progress view; all network work is handled by AssetManager's worker. */
public final class CirrusInitializationScreen extends Screen {
    private final Screen parent;
    private final AssetManager assets;
    private boolean continued;

    public CirrusInitializationScreen(Screen parent, AssetManager assets) {
        super(Component.literal("Initializing Cirrus"));
        this.parent = parent;
        this.assets = assets;
        assets.initialize();
    }

    @Override public void tick() {
        if (!continued && assets.snapshot().finished()) {
            continued = true;
            CirrusAssetTextures.load(assets);
            Minecraft client = Minecraft.getInstance();
            client.setScreen(CirrusConfig.get(client.gameDirectory.toPath()).getBoolean("onboarding.complete", false)
                ? parent : new CirrusWelcomeScreen(parent));
        }
    }

    @Override public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
        renderBackground(graphics, mouseX, mouseY, delta);
        CirrusConfig config = CirrusConfig.get(Minecraft.getInstance().gameDirectory.toPath());
        CirrusTheme theme = CirrusTheme.current(config);
        CirrusUi.backdrop(graphics, width, height, theme);
        int cardWidth = Math.min(450, width - 28), cardHeight = Math.min(250, height - 28);
        int left = (width - cardWidth) / 2, top = (height - cardHeight) / 2;
        CirrusUi.panel(graphics, left, top, cardWidth, cardHeight, 20, theme);
        CirrusUi.brand(graphics, width / 2 - 72, top + 26, 34, theme);
        CirrusUi.loadingFrame(graphics,width/2-11,top+62,22,System.currentTimeMillis()/80L);
        CirrusUi.centeredHeading(graphics, font, "PREPARING YOUR CLIENT", width / 2, top + 91, theme.text);
        AssetManager.Snapshot status = assets.snapshot();
        CirrusUi.centered(graphics, font, status.message(), width / 2, top + 119, theme.cyan);
        CirrusUi.centeredSmall(graphics, font, "Category  ·  " + status.category(), width / 2, top + 145, theme.muted);
        String count = status.totalRequired() == 0 ? "Checking available resources" :
            status.downloadedRequired() + " of " + status.totalRequired() + " required files verified";
        CirrusUi.centeredSmall(graphics, font, count, width / 2, top + 162, theme.muted);
        int barWidth = Math.max(80, cardWidth - 96), barX = width / 2 - barWidth / 2, barY = top + 191;
        CirrusUi.rounded(graphics, barX, barY, barWidth, 7, 4, theme.border);
        float progress = status.totalRequired() == 0 ? 0f : Math.min(1f, (float) status.downloadedRequired() / status.totalRequired());
        int progressWidth = Math.max(status.state() == AssetManager.State.DOWNLOADING ? 5 : 0, Math.round(barWidth * progress));
        if (progressWidth > 0) CirrusUi.rounded(graphics, barX, barY, progressWidth, 7, 4, theme.accent);
        super.render(graphics, mouseX, mouseY, delta);
    }

    @Override public boolean shouldCloseOnEsc() { return false; }
}

