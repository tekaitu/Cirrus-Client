import markUrl from "../assets/brand/maple-mark.png";

/**
 * Maple Client artwork.
 *
 * The mark is the owner's own client icon, shipped once as a transparent PNG in
 * src/assets/brand/maple-mark.png and drawn at whatever size the caller needs:
 * the sidebar, the boot screen, the hero lockup, About and the window icon all
 * use the same file, so the identity never drifts between them.
 */

/** The leaf alone. `size` is the rendered width and height in pixels. */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      className={`logo-mark ${className}`.trim()}
      src={markUrl}
      width={size}
      height={size}
      alt="Maple Client"
      draggable={false}
      decoding="async"
    />
  );
}

/** The leaf plus the Maple Client lettering, set in the interface font. */
export function Wordmark({ height = 30 }: { height?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: height * 0.62 }}>
      <span className="wordmark-mark" aria-hidden="true">
        <LogoMark size={height} />
      </span>
      <span className="wordmark-text">
        Maple<em>Client</em>
      </span>
    </span>
  );
}

/** The leaf at illustration size, purely decorative. */
export function CloudMark({ size = 120 }: { size?: number }) {
  return (
    <span className="cloud-mark" aria-hidden="true">
      <LogoMark size={size} />
    </span>
  );
}
