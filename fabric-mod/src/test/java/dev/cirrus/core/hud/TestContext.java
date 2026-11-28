package dev.cirrus.core.hud;

import dev.cirrus.core.config.CirrusConfig;
import dev.cirrus.core.input.GameAction;
import dev.cirrus.core.input.InputState;
import dev.cirrus.core.input.InputTracker;
import dev.cirrus.core.module.ModContext;
import dev.cirrus.core.render.Canvas;
import dev.cirrus.core.text.TextMetrics;
import dev.cirrus.core.text.TextStyle;

import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/** A scripted game for module and HUD tests: no Minecraft anywhere. */
final class TestContext implements ModContext {
    final CirrusConfig config;
    final InputTracker input = new InputTracker();
    int fps = 144, ping = 30, screenW = 427, screenH = 240;
    boolean inWorld = true;
    double px, py, pz;
    float yaw;
    List<dev.cirrus.core.module.EffectInfo> effects = new ArrayList<dev.cirrus.core.module.EffectInfo>();
    final Set<GameAction> down = EnumSet.noneOf(GameAction.class);

    TestContext() {
        try { config = CirrusConfig.get(Files.createTempDirectory("cirrus-test")); } catch (IOException e) { throw new IllegalStateException(e); }
    }

    @Override public CirrusConfig config() { return config; }
    @Override public InputState input() { return input; }
    @Override public TextMetrics text() {
        return new TextMetrics() {
            @Override public int width(String text, TextStyle style) { return text.length() * 5; }
            @Override public int lineHeight(TextStyle style) { return 9; }
        };
    }
    @Override public int screenWidth() { return screenW; }
    @Override public int screenHeight() { return screenH; }
    @Override public int fps() { return fps; }
    @Override public int pingMillis() { return ping; }
    @Override public boolean inWorld() { return inWorld; }
    @Override public boolean isActionDown(GameAction action) { return down.contains(action); }
    @Override public double playerX() { return px; }
    @Override public double playerY() { return py; }
    @Override public double playerZ() { return pz; }
    @Override public float playerYaw() { return yaw; }
    @Override public List<dev.cirrus.core.module.EffectInfo> effects() { return effects; }

    /** Records what a widget draws. */
    static final class Rec implements Canvas {
        final List<String> texts = new ArrayList<String>();
        /** Everything drawn as text, joined: a widget may draw one line in several coloured pieces. */
        String line() { StringBuilder b = new StringBuilder(); for (String t : texts) b.append(t); return b.toString(); }
        final List<Integer> textColors = new ArrayList<Integer>();
        final List<String> transforms = new ArrayList<String>();
        int fills, masks, depth;
        @Override public int scale() { return 2; }
        @Override public void beginPixels() { }
        @Override public void endPixels() { }
        @Override public void fill(int x0, int y0, int x1, int y1, int argb) { fills++; }
        @Override public void cornerMask(int r, int t, int qx, int qy, int x, int y, int argb) { masks++; }
        @Override public void icon(int index, int x, int y, int size, int argb) { }
        @Override public void text(String text, TextStyle style, int x, int y, int argb, boolean shadow) { texts.add(text); textColors.add(argb); }
        @Override public void pushTransform(float x, float y, float scale) { depth++; transforms.add(x + "," + y + "," + scale); }
        @Override public void popTransform() { depth--; }
        @Override public void pushClip(int x, int y, int w, int h) { }
        @Override public void popClip() { }
    }
}
