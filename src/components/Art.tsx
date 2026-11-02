/**
 * Small original illustrations drawn in SVG, so nothing is downloaded and no
 * Minecraft artwork is used. Purely decorative.
 */

export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 640 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="hSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1f4f" />
          <stop offset="0.6" stopColor="#0d1633" />
          <stop offset="1" stopColor="#070c1b" />
        </linearGradient>
        <linearGradient id="hGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2f7bff" stopOpacity="0" />
          <stop offset="1" stopColor="#5aaeff" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="hBlade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#9ec5ff" />
        </linearGradient>
      </defs>
      <rect width="640" height="300" fill="url(#hSky)" />
      {/* blocky skyline */}
      <g fill="#0a1128">
        <rect x="0" y="206" width="70" height="94" />
        <rect x="70" y="182" width="56" height="118" />
        <rect x="126" y="224" width="84" height="76" />
        <rect x="210" y="196" width="48" height="104" />
        <rect x="258" y="232" width="92" height="68" />
        <rect x="350" y="190" width="60" height="110" />
        <rect x="410" y="214" width="76" height="86" />
        <rect x="486" y="176" width="52" height="124" />
        <rect x="538" y="222" width="102" height="78" />
      </g>
      <g fill="#14224a">
        <rect x="0" y="206" width="70" height="8" />
        <rect x="70" y="182" width="56" height="8" />
        <rect x="210" y="196" width="48" height="8" />
        <rect x="350" y="190" width="60" height="8" />
        <rect x="486" y="176" width="52" height="8" />
      </g>
      {/* speed streaks, echoing the logo */}
      <g>
        <polygon points="40,80 330,80 322,92 28,92" fill="url(#hGlow)" opacity="0.5" />
        <polygon points="90,112 360,112 354,122 80,122" fill="url(#hGlow)" opacity="0.4" />
        <polygon points="10,146 300,146 292,156 0,156" fill="url(#hGlow)" opacity="0.3" />
      </g>
      {/* crossed swords */}
      <g transform="translate(440 150)">
        <g transform="rotate(38)">
          <polygon points="-6,-110 6,-110 9,40 -9,40" fill="url(#hBlade)" />
          <rect x="-30" y="40" width="60" height="9" fill="#2f7bff" />
          <rect x="-5" y="49" width="10" height="34" fill="#5aaeff" />
        </g>
        <g transform="rotate(-38)">
          <polygon points="-6,-110 6,-110 9,40 -9,40" fill="url(#hBlade)" opacity="0.92" />
          <rect x="-30" y="40" width="60" height="9" fill="#7a5cff" />
          <rect x="-5" y="49" width="10" height="34" fill="#5aaeff" />
        </g>
      </g>
    </svg>
  );
}

export function CardArt({ kind }: { kind: "blocks" | "speed" | "sword" }) {
  return (
    <svg className="card-art" viewBox="0 0 160 72" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`ca-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={kind === "sword" ? "#2a1f63" : "#14275a"} />
          <stop offset="1" stopColor="#0a1128" />
        </linearGradient>
      </defs>
      <rect width="160" height="72" fill={`url(#ca-${kind})`} />
      {kind === "blocks" && (
        <g fill="#2f7bff">
          <rect x="24" y="36" width="22" height="22" opacity="0.8" />
          <rect x="52" y="22" width="22" height="36" opacity="0.55" />
          <rect x="80" y="30" width="22" height="28" opacity="0.7" />
          <rect x="108" y="14" width="22" height="44" opacity="0.4" />
        </g>
      )}
      {kind === "speed" && (
        <g fill="#5aaeff">
          <polygon points="20,18 120,18 116,26 14,26" opacity="0.8" />
          <polygon points="40,34 140,34 136,42 34,42" opacity="0.55" />
          <polygon points="12,50 100,50 96,58 6,58" opacity="0.35" />
        </g>
      )}
      {kind === "sword" && (
        <g transform="translate(80 36) rotate(40)">
          <polygon points="-3,-34 3,-34 4,12 -4,12" fill="#dbe8ff" />
          <rect x="-12" y="12" width="24" height="4" fill="#7a5cff" />
          <rect x="-2" y="16" width="4" height="12" fill="#5aaeff" />
        </g>
      )}
    </svg>
  );
}
