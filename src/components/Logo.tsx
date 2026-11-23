/**
 * Maple Client artwork.
 *
 * The mark is drawn as SVG rather than shipped as a bitmap so it stays sharp at
 * every size (sidebar, boot screen, About, window icon) and always uses the one
 * brand colour. `branding/make_maple_icons.py` rasterises the same polygon into
 * the PNG/ICO files Tauri and the browser tab use.
 */

/** The maple leaf outline, in a 100 x 100 box. Shared with the icon script. */
export const MAPLE_LEAF_POINTS =
  "75.0,68.7 75.2,68.5 95.5,50.6 91.6,48.9 90.9,48.2 90.7,47.4 95.0,32.6 83.6,35.1 82.7,35.2 82.1,34.8 81.6,34.0 78.4,27.3 67.6,39.5 66.2,40.0 65.0,39.8 64.5,39.3 64.2,38.6 64.4,36.3 69.6,12.2 61.1,16.9 60.2,17.2 59.4,17.0 58.8,16.3 57.5,14.2 50.0,0.0 42.5,14.2 41.2,16.3 40.6,17.0 39.8,17.2 38.9,16.9 30.4,12.2 35.6,36.3 35.8,38.6 35.5,39.3 35.0,39.8 33.8,40.0 32.4,39.5 21.6,27.3 18.4,34.0 17.9,34.8 17.3,35.1 16.4,35.1 5.0,32.6 9.3,47.4 9.1,48.2 8.4,48.9 4.5,50.6 24.3,68.1 26.1,69.8 26.4,70.8 26.3,71.9 24.1,79.9 44.6,75.5 46.6,75.7 47.4,76.2 47.9,76.7 48.1,77.4 48.2,78.4 47.1,100.0 52.9,100.0 51.8,78.4 51.9,77.2 52.4,76.4 53.6,75.7 55.4,75.5 75.9,79.9 73.6,71.3 73.8,70.0";

/** The leaf alone. `size` is the rendered width and height in pixels. */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`logo-mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Maple Client"
      focusable="false"
    >
      <polygon points={MAPLE_LEAF_POINTS} fill="currentColor" />
    </svg>
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
