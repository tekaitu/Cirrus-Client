package dev.cirrus.core.log;

import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Core's only logging hook. Core must not depend on a logging library, so the loader integration installs a sink at start-up
 * (Fabric forwards to SLF4J). Until then messages go to {@code java.util.logging}.
 */
public final class CoreLog {
    /** Receives warnings from Core. {@code error} may be null. */
    public interface Sink { void warn(String message, Throwable error); }

    private static final Logger FALLBACK = Logger.getLogger("Cirrus Client");
    private static volatile Sink sink = new Sink() {
        @Override public void warn(String message, Throwable error) { FALLBACK.log(Level.WARNING, message, error); }
    };

    private CoreLog() { }

    public static void setSink(Sink newSink) { if (newSink != null) sink = newSink; }

    public static void warn(String message, Throwable error) { sink.warn(message, error); }
}
