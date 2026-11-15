import { useEffect, useState } from "react";
import { api } from "../api/client";

/** Skins that were already fetched this session, by player id. `null` means "looked, none available". */
const cache = new Map<string, string | null>();

/** The PNG of a player's current skin as a data address, or null while loading / when there is none. */
export function usePlayerSkin(uuid: string | null): string | null {
  const [url, setUrl] = useState<string | null>(uuid ? (cache.get(uuid) ?? null) : null);
  useEffect(() => {
    if (!uuid) {
      setUrl(null);
      return;
    }
    if (cache.has(uuid)) {
      setUrl(cache.get(uuid) ?? null);
      return;
    }
    let live = true;
    void Promise.resolve(api.playerSkin(uuid))
      .then((u) => {
        cache.set(uuid, u ?? null);
        if (live) setUrl(u ?? null);
      })
      .catch(() => {
        if (live) setUrl(null);
      });
    return () => {
      live = false;
    };
  }, [uuid]);
  return url;
}

/**
 * A player's face (with the hat layer), cut out of the skin with plain CSS so no canvas is needed.
 * Without a skin it shows the first letter of the name, or a neutral square.
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
    backgroundImage: `url(${skin})`,
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
