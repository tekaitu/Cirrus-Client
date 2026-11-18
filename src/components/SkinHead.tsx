import { usePlayerAppearance } from "../hooks/useAppearance";

/** The PNG of a player's current skin as a data address, or null while loading / when there is none. */
export function usePlayerSkin(uuid: string | null): string | null {
  return usePlayerAppearance(uuid).appearance?.skin ?? null;
}

/**
 * A player's face (with the hat layer), cut out of the skin with plain CSS so no canvas is needed.
 * Without a skin it shows the first letter of the name, or a neutral square. The skin comes from
 * the same shared appearance request as the 3D figure, so refreshing one refreshes both.
 */
export function SkinHead({
  uuid,
  name,
  size = 32,
  dataUrl,
}: {
  uuid?: string | null;
  name?: string | null;
  size?: number;
  /** Use this skin directly instead of looking one up. */
  dataUrl?: string | null;
}) {
  const fetched = usePlayerSkin(dataUrl ? null : (uuid ?? null));
  const skin = dataUrl ?? fetched;
  const scale = size / 8;
  const layer = (x: number): React.CSSProperties => ({
    backgroundImage: skin ? `url(${skin})` : undefined,
    backgroundSize: `${64 * scale}px ${64 * scale}px`,
    backgroundPosition: `-${x * scale}px -${8 * scale}px`,
  });
  return (
    <span className={`skin-head ${skin ? "" : "skin-head-empty"}`} style={{ width: size, height: size }} aria-hidden="true">
      {skin ? (
        <>
          <span className="skin-head-layer" style={layer(8)} />
          <span className="skin-head-layer" style={layer(40)} />
        </>
      ) : (
        <span className="skin-head-letter" style={{ fontSize: size * 0.46 }}>
          {name ? name.slice(0, 1).toUpperCase() : "?"}
        </span>
      )}
    </span>
  );
}
