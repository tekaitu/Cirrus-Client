package dev.cirrus.client.dashboard;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.ServerStatusPinger;
import net.minecraft.server.network.EventLoopGroupHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * Shared server status cache for the partner strip and the Multiplayer screen. It reuses Minecraft's own
 * {@link ServerStatusPinger}, so a ping is the same status request the vanilla server list sends. Entries are refreshed at
 * most every {@link #REFRESH_MS}, and a ping that never answers is reported as offline after {@link #GIVE_UP_MS}.
 */
public final class ServerStatus {
    private static final Logger LOG = LoggerFactory.getLogger("Cirrus Client");
    public static final long REFRESH_MS = 90_000, GIVE_UP_MS = 12_000;
    public enum State { CHECKING, ONLINE, OFFLINE }

    private static final ServerStatusPinger PINGER = new ServerStatusPinger();
    private static final Map<String, Entry> ENTRIES = new HashMap<>();

    private static final class Entry {
        final ServerData data; long startedAt; boolean everPinged;
        Entry(ServerData data) { this.data = data; }
    }

    private ServerStatus() { }

    /** The ServerData used for pinging and for connecting; one instance per address so status is shared. */
    public static synchronized ServerData data(String name, String address) {
        return entry(name, address).data;
    }

    private static Entry entry(String name, String address) {
        return ENTRIES.computeIfAbsent(address, a -> new Entry(new ServerData(name, a, ServerData.Type.OTHER)));
    }

    /** Starts a ping when none ran yet or the last one is stale. Cheap to call every frame. */
    public static synchronized void ensurePinged(String name, String address) {
        Entry e = entry(name, address);
        long now = System.currentTimeMillis();
        boolean stale = !e.everPinged || now - e.startedAt > REFRESH_MS;
        if (!stale || isPinging(e) && now - e.startedAt < GIVE_UP_MS) return;
        e.everPinged = true;
        e.startedAt = now;
        try {
            try { e.data.setState(ServerData.State.valueOf("PINGING")); } catch (IllegalArgumentException ignored) { }
            PINGER.pingServer(e.data, () -> { }, () -> { }, EventLoopGroupHolder.remote(Minecraft.getInstance().options.useNativeTransport()));
        } catch (Exception ex) {
            LOG.debug("Ping failed for {}: {}", address, ex.toString());
            try { e.data.setState(ServerData.State.valueOf("UNREACHABLE")); } catch (IllegalArgumentException ignored) { }
        }
    }

    /** Forces a new ping on the next call regardless of the refresh interval (Refresh button). */
    public static synchronized void forceRefresh(String name, String address) {
        Entry e = entry(name, address);
        e.everPinged = false;
        e.startedAt = 0;
        try { e.data.setState(ServerData.State.valueOf("INITIAL")); } catch (IllegalArgumentException ignored) { }
        ensurePinged(name, address);
    }

    private static boolean isPinging(Entry e) { return "PINGING".equals(e.data.state().name()); }

    public static synchronized State state(String name, String address) {
        Entry e = entry(name, address);
        String s = e.data.state().name();
        if (s.equals("SUCCESSFUL") || s.equals("INCOMPATIBLE")) return State.ONLINE;
        if (!e.everPinged) return State.CHECKING;
        if (s.equals("UNREACHABLE")) return State.OFFLINE;
        return System.currentTimeMillis() - e.startedAt > GIVE_UP_MS ? State.OFFLINE : State.CHECKING;
    }

    public static synchronized int online(String name, String address) {
        var p = entry(name, address).data.players;
        return p == null ? -1 : p.online();
    }

    public static synchronized int max(String name, String address) {
        var p = entry(name, address).data.players;
        return p == null ? -1 : p.max();
    }

    public static synchronized long ping(String name, String address) { return entry(name, address).data.ping; }

    /** Call from a screen tick: lets the pinger finish and close connections. */
    public static void tick() { synchronized (ServerStatus.class) { PINGER.tick(); } }
}
