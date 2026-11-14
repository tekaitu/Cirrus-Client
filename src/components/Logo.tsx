/**
 * Cirrus Client artwork. The files live in public/brand/ and are built from the
 * original images in branding/source/ by branding/make_brand.py, so the in-app
 * logo, the window icon and the EXE icon always match.
 */

/** The emblem on its rounded black tile (also the app icon). */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <img
      className="logo-mark"
      src="/brand/icon.png"
      width={size}
      height={size}
      alt="Cirrus Client logo"
      draggable={false}
    />
  );
}

/** "Cirrus Client" lettering with the cloud mark, white on transparent. Height is in pixels. */
export function Wordmark({ height = 40 }: { height?: number }) {
  return <img className="wordmark" src="/brand/wordmark.png" height={height} alt="Cirrus Client" draggable={false} />;
}

/** The cloud-and-stars mark alone, white on transparent. Purely decorative. */
export function CloudMark({ size = 120 }: { size?: number }) {
  return <img className="cloud-mark" src="/brand/mark.png" width={size} alt="" aria-hidden="true" draggable={false} />;
}
