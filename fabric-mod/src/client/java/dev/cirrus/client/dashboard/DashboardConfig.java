package dev.cirrus.client.dashboard;

import java.util.List;

/**
 * Immutable snapshot of everything the Cirrus website dashboard will control in the client: partner servers (the left
 * sidebar and the featured list in Multiplayer), promotional banners, the store button and store promotions.
 * Built only by {@link DashboardParser}, so every instance has already been validated and size-limited.
 */
public record DashboardConfig(
    int schema,
    long revision,
    Store store,
    List<Partner> partners,
    List<Banner> banners,
    List<StorePromo> storePromos
) {
    public static final int SCHEMA = 1;

    /** The STORE button on the main menu. {@code url} is an https URL or empty when the store is not set up. */
    public record Store(String label, String url, boolean enabled) { }

    /**
     * A partner server. {@code address} is host[:port]. {@code color} is an RGB int for the monogram tile. {@code iconUrl}
     * is optional (https PNG); without it the tile shows the first letters of the name.
     */
    public record Partner(String id, String name, String address, String tagline, int color, String iconUrl, boolean featured, int order) { }

    /** A promotional banner shown bottom-right on the main menu. Banners rotate in {@code order}; {@code url} may be empty. */
    public record Banner(String id, String title, String subtitle, String cta, String url, int colorA, int colorB, String imageUrl, int order) { }

    /** A store promotion line (for example a sale) shown on the STORE button tooltip and the banner footer. */
    public record StorePromo(String id, String text, String url, int order) { }
}
