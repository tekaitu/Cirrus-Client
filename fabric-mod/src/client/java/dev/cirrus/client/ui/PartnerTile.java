package dev.cirrus.client.ui;

import dev.cirrus.client.config.CirrusConfig;
import dev.cirrus.client.dashboard.DashboardConfig;
import dev.cirrus.client.dashboard.ServerStatus;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.network.chat.Component;

/** Square partner-server tile for the left strip: coloured monogram, live status dot, tooltip with players and ping. */
public final class PartnerTile extends Button {
    private final DashboardConfig.Partner partner;
    private float hover;
    private String tooltipKey = "";
    private final Anim.Clock clock = new Anim.Clock();

    public PartnerTile(int x, int y, int size, DashboardConfig.Partner partner, OnPress action) {
        super(x, y, size, size, Component.literal(partner.name()), action, DEFAULT_NARRATION);
        this.partner = partner;
    }

    public DashboardConfig.Partner partner() { return partner; }

    /** Rebuilds the tooltip only when the displayed status changed. */
    public void refreshTooltip() {
        ServerStatus.State state = ServerStatus.state(partner.name(), partner.address());
        int online = ServerStatus.online(partner.name(), partner.address()), max = ServerStatus.max(partner.name(), partner.address());
        long ping = ServerStatus.ping(partner.name(), partner.address());
        String key = state + ":" + online + ":" + max + ":" + ping;
        if (key.equals(tooltipKey)) return;
        tooltipKey = key;
        StringBuilder sb = new StringBuilder(partner.name());
        if (!partner.tagline().isEmpty()) sb.append('\n').append(partner.tagline());
        sb.append('\n').append(switch (state) {
            case ONLINE -> "Online" + (online >= 0 ? "  ·  " + online + " / " + max + " players" : "") + (ping > 0 ? "  ·  " + ping + " ms" : "");
            case OFFLINE -> "Offline or unreachable";
            case CHECKING -> "Checking status…";
        });
        sb.append('\n').append(partner.address());
        setTooltip(Tooltip.create(Component.literal(sb.toString())));
    }

    @Override protected void renderContents(GuiGraphics g, int mouseX, int mouseY, float delta) {
        Minecraft mc = Minecraft.getInstance();
        CirrusTheme t = CirrusTheme.current(CirrusConfig.get(mc.gameDirectory.toPath()));
        hover = Anim.approach(hover, isHoveredOrFocused() ? 1f : 0f, clock.tick(), 16f);
        int x = getX(), y = getY(), w = getWidth(), h = getHeight();
        float radius = Math.min(6f, h * 0.24f);
        int tint = 0xFF000000 | partner.color();
        Gfx.fillRound(g, x, y, w, h, radius, Gfx.mix(0xFF0A0F1A, tint, 0.38f + 0.2f * hover));
        Gfx.hairline(g, x + radius, y + 1, w - radius * 2, Gfx.scaleAlpha(t.highlight, 2.2f));
        Gfx.strokeRound(g, x, y, w, h, radius, 0.5f, Gfx.mix(Gfx.scaleAlpha(t.border, 0.8f), t.cyan, hover));
        if (isFocused()) Gfx.strokeRound(g, x - 1, y - 1, w + 2, h + 2, radius + 1, 1f, t.cyan);

        String mono = monogram(partner.name());
        CirrusUi.centeredFit(g, mc.font, mono, x + w / 2, y + h / 2, w - 4, 0xFFFFFFFF);

        ServerStatus.State state = ServerStatus.state(partner.name(), partner.address());
        int dot = state == ServerStatus.State.ONLINE ? t.good : state == ServerStatus.State.CHECKING ? 0xFFE0A93B : 0xFF566176;
        int d = Math.max(5, Math.round(h * 0.28f));
        int dx = x + w - d + 1, dy = y + h - d + 1;
        Gfx.fillRound(g, dx - 1, dy - 1, d + 2, d + 2, (d + 2) / 2f, 0xFF070B14);
        Gfx.fillRound(g, dx, dy, d, d, d / 2f, dot);
    }

    static String monogram(String name) {
        StringBuilder sb = new StringBuilder();
        for (String part : name.trim().split("\\s+")) {
            if (!part.isEmpty() && sb.length() < 2) sb.appendCodePoint(Character.toUpperCase(part.codePointAt(0)));
        }
        return sb.length() == 0 ? "?" : sb.toString();
    }
}
