package dev.cirrus.core.hud;

import dev.cirrus.core.module.ModContext;

/** Lets tests in other packages get a scripted {@link ModContext}. */
public final class TestContextHolder {
    public ModContext get() { return new TestContext(); }
}
