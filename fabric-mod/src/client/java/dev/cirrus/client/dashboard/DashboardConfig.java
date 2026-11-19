package dev.cirrus.client.dashboard;

import java.time.Instant;
import java.util.List;

/**
 * Immutable snapshot of everything the Cirrus dashboard controls in the client. Built only by {@link DashboardParser}, so every
 * instance has already been validated and size-limited. Nothing in here is hardcoded promotional content: with no dashboard
 * data every list is empty and the client simply shows no promotions.
 *
 * <p>Image fields hold https URLs; the client downloads, validates (PNG/JPEG, size limits) and caches them separately.
 */
public record DashboardConfig(
    int schema,
    long revision,
    Store store,
    List<Partner> partners,
    Advertised advertised,
    List<Banner> banners,
    Discord discord,
    List<Giveaway> giveaways,
    List<News> news,
    List<StorePromo> storePromos,
    List<Featured> featured,
    List<Social> socials,
    List<Update> updates
) {
    public static final int SCHEMA = 1;

    /** The Store button. {@code url} is https or empty when no store is set up (the button is then disabled). */
    public record Store(String label, String url, boolean enabled) { }

    /** An official Cirrus partner server. {@code address} is host[:port]; {@code iconUrl} is an optional logo (https PNG/JPEG). */
    public record Partner(String id, String name, String address, String tagline, int color, String iconUrl, int order) { }

    /** Which partner is currently advertised and whether it gets a START button. {@code partnerId} must name a listed partner. */
    public record Advertised(String partnerId, boolean startButton, String label) { }

    /** Promotional banner. Active between {@code startsAt} and {@code endsAt} (either may be null). */
    public record Banner(String id, String title, String subtitle, String cta, String url, int colorA, int colorB, String imageUrl, Instant startsAt, Instant endsAt, int order) {
        public boolean activeAt(Instant now) { return Window.contains(startsAt, endsAt, now); }
    }

    /**
     * Discord-linking promotion. Purely informational: the client never links an account or grants a reward, and
     * {@code rewardText} is shown verbatim as the dashboard's own description of the reward.
     */
    public record Discord(boolean enabled, String title, String subtitle, String badge, String cta, String url, String imageUrl, String rewardText) { }

    public record Giveaway(String id, String title, String description, String imageUrl, String url, Instant startsAt, Instant endsAt, int order) {
        public boolean activeAt(Instant now) { return Window.contains(startsAt, endsAt, now); }
    }

    public record News(String id, String title, String body, String imageUrl, String url, Instant date, int order) { }

    public record StorePromo(String id, String text, String url, String imageUrl, Instant startsAt, Instant endsAt, int order) {
        public boolean activeAt(Instant now) { return Window.contains(startsAt, endsAt, now); }
    }

    public record Featured(String id, String title, String subtitle, String imageUrl, String url, int order) { }

    /** {@code kind} is one of discord, youtube, x, tiktok, instagram, twitch, github, website. */
    public record Social(String id, String kind, String label, String url) { }

    /** Update announcement; {@code severity} is info, recommended or required. */
    public record Update(String id, String version, String title, String body, String url, String severity, Instant date) { }

    public static DashboardConfig empty() {
        return new DashboardConfig(SCHEMA, 0, new Store("STORE", "", false), List.of(), null, List.of(),
            new Discord(false, "", "", "", "", "", "", ""), List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
    }

    public Partner partner(String id) {
        for (Partner p : partners) if (p.id().equals(id)) return p;
        return null;
    }

    /** The advertised partner when the dashboard names a valid one, otherwise null. */
    public Partner advertisedPartner() { return advertised == null ? null : partner(advertised.partnerId()); }

    private static final class Window {
        static boolean contains(Instant from, Instant to, Instant now) { return (from == null || !now.isBefore(from)) && (to == null || now.isBefore(to)); }
    }
}
