package dev.cirrus.client.glyph;

import dev.cirrus.core.identity.MapleIdentity;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.FontDescription;
import net.minecraft.network.chat.Style;
import net.minecraft.resources.Identifier;

import java.util.UUID;

/**
 * The Maple leaf shown as a small prefix before a verified Maple player's name (tab list, in-world nametag). The leaf is a one-character
 * bitmap font ({@code font/maple_glyph.json}) so it sits in the text line like any letter and the game measures it for us.
 * Whether a player gets it is decided only by {@link MapleIdentity}; with no verified-identity source installed nobody does.
 */
public final class MapleGlyph {
    private MapleGlyph() { }

    private static final FontDescription FONT = new FontDescription.Resource(Identifier.fromNamespaceAndPath("cirrus_fabric", "maple_glyph"));
    /** The private-use character the font maps to the leaf. */
    public static final String CHARACTER = "";

    /** The glyph followed by a thin gap. White text colour so the leaf keeps its own orange whatever colour the name has. */
    public static Component prefix() {
        // Siblings under an unstyled parent: a child appended to the glyph would inherit its font, which has no space character (drawn as a box).
        return Component.empty()
                .append(Component.literal(CHARACTER).withStyle(Style.EMPTY.withFont(FONT).withColor(0xFFFFFF)))
                .append(Component.literal(" "));
    }

    /** {@code name} with the glyph in front when {@code playerId} is a verified Maple player; {@code name} itself otherwise. */
    public static Component decorate(Component name, UUID playerId) {
        if (name == null || !MapleIdentity.isVerified(playerId)) return name;
        return Component.empty().append(prefix()).append(name);
    }
}
