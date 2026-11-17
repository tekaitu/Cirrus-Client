import type { CSSProperties, ReactNode } from "react";
import { cardArt } from "../core/art";

/** The picture on a version or profile card: official key art, cropped differently for each version. */
export function VersionArt({ version, extra = "", className = "" }: { version: string; extra?: string; className?: string }) {
  const art = cardArt(version, extra);
  return (
    <img
      className={`vc-art ${className}`.trim()}
      src={art.src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      style={{ objectPosition: art.position, "--z": art.zoom } as CSSProperties}
    />
  );
}

/**
 * One version as a card with artwork, the way a launcher shows it: the big name, the loader and a short line.
 * With `onSelect` the whole card is a button; `actions` adds buttons along the bottom.
 */
export function VersionCard({
  version,
  loader,
  line,
  selected = false,
  badge,
  onSelect,
  actions,
  selectLabel,
  compact = false,
}: {
  version: string;
  loader: string;
  line?: string;
  selected?: boolean;
  badge?: ReactNode;
  onSelect?: () => void;
  actions?: ReactNode;
  selectLabel?: string;
  compact?: boolean;
}) {
  const body = (
    <>
      <VersionArt version={version} extra={loader} />
      <span className="vc-shade" aria-hidden="true" />
      {badge && <span className="vc-badge">{badge}</span>}
      <span className="vc-text">
        <span className="vc-name">
          {version} {loader}
        </span>
        {line && <span className="vc-line">{line}</span>}
      </span>
    </>
  );
  return (
    <div className={`vc ${selected ? "vc-selected" : ""} ${compact ? "vc-compact" : ""}`.trim()}>
      {onSelect ? (
        <button type="button" className="vc-main" aria-pressed={selected} aria-label={selectLabel ?? `${version} ${loader}`} onClick={onSelect}>
          {body}
        </button>
      ) : (
        <div className="vc-main">{body}</div>
      )}
      {actions && <div className="vc-actions">{actions}</div>}
    </div>
  );
}
