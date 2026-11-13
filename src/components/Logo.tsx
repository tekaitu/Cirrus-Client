import { useId } from "react";
import { LOGO } from "../branding/logo.generated";

/**
 * The Unlimited app icon: a bold white U with a spark on a cyan-violet-pink tile.
 * Same drawing as branding/make_icon.py, so the in-app logo, the window icon and
 * the EXE icon match.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const tile = `tile${uid}`;
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      role="img"
      aria-label="Unlimited logo"
      focusable="false"
    >
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#F472B6" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="58" fill={`url(#${tile})`} />
      <path
        d="M80 64V136A48 48 0 0 0 176 136V64"
        fill="none"
        stroke="#fff"
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon className="logo-spark" points="128,73 132.6,87.4 147,92 132.6,96.6 128,111 123.4,96.6 109,92 123.4,87.4" fill="#fff" />
    </svg>
  );
}

/** "UNLIMITED" lettering, separate from the icon. Height is in pixels. */
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
      aria-label="Unlimited"
      focusable="false"
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={LOGO.colors.accent} />
          <stop offset="1" stopColor={LOGO.colors.accentBright} />
        </linearGradient>
      </defs>
      <path fill={`url(#${grad})`} fillRule="evenodd" d={w.accent} />
      <path fill={LOGO.colors.white} fillRule="evenodd" d={w.plain} />
    </svg>
  );
}
