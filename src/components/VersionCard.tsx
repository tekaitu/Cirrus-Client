import type { ReactNode } from "react";
import { kindForVersion } from "../core/scene";
import { SceneCanvas } from "./Scene";

/** The picture on a version or profile card: an original landscape that is the same for the same version. */
export function VersionArt({ version, extra = "", className = "" }: { version: string; extra?: string; className?: string }) {
  return <SceneCanvas kind={kindForVersion(version)} seed={`${version}${extra}`} className={`vc-art ${className}`.trim()} />;
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
