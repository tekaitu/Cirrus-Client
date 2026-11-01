import { useId } from "react";
import { LOGO } from "../branding/logo.generated";

/** Icons this small use the simpler two-streak variant so they stay readable. */
const SMALL_MAX_PX = 48;

/**
 * The Limited FPS app icon: a bold forward-leaning L with blue speed streaks on
 * a navy tile. Shapes come from branding/generate_assets.py so the in-app logo,
 * the window icon and the EXE icon are the same drawing.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const variant = size <= SMALL_MAX_PX ? LOGO.variants.small : LOGO.variants.full;
  const c = LOGO.colors;
  const tile = `tile${uid}`;
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      role="img"
      aria-label="Limited FPS logo"
      focusable="false"
    >
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.navyTop} />
          <stop offset="1" stopColor={c.navyBottom} />
        </linearGradient>
        {variant.streaks.map((s, i) => (
          <linearGradient
            key={i}
            id={`s${i}${uid}`}
            gradientUnits="userSpaceOnUse"
            x1={s.x1}
            y1="0"
            x2={s.x2}
            y2="0"
          >
            <stop offset="0" stopColor={c.blue} stopOpacity={s.alphaStart} />
            <stop offset="1" stopColor={c.blueBright} />
          </linearGradient>
        ))}
      </defs>
      <rect width="256" height="256" rx={variant.radius} fill={`url(#${tile})`} />
      {variant.streaks.map((s, i) => (
        <polygon key={i} points={s.points} fill={`url(#s${i}${uid})`} />
      ))}
      <polygon points={variant.l} fill={c.white} />
    </svg>
  );
}

/** "LIMITED FPS" lettering, separate from the icon. Height is in pixels. */
export function Wordmark({ height = 22 }: { height?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const w = LOGO.wordmark;
  const [, , vbW, vbH] = w.viewBox.split(" ").map(Number);
  const grad = `fps${uid}`;
  return (
    <svg
      className="wordmark"
      width={(height * vbW) / vbH}
      height={height}
      viewBox={w.viewBox}
      role="img"
      aria-label="Limited FPS"
      focusable="false"
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={LOGO.colors.blue} />
          <stop offset="1" stopColor={LOGO.colors.blueBright} />
        </linearGradient>
      </defs>
      <path fill={LOGO.colors.white} fillRule="evenodd" d={w.limited} />
      <path fill={`url(#${grad})`} fillRule="evenodd" d={w.fps} />
    </svg>
  );
}
