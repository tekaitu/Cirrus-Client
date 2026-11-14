/**
 * Small original illustrations drawn in SVG, so nothing is downloaded and no
 * Minecraft artwork is used. Purely decorative.
 */

export function HeroArt() {
  const towers: Array<[number, number, number]> = [
    [0, 70, 210], [70, 56, 180], [126, 84, 232], [210, 48, 196], [258, 92, 240],
    [350, 60, 188], [410, 76, 218], [486, 52, 170], [538, 102, 226],
  ];
  return (
    <svg className="scene" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#333333" />
          <stop offset="0.55" stopColor="#1a1a1a" />
          <stop offset="1" stopColor="#090909" />
        </linearGradient>
        <radialGradient id="sMoon" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e4e4e4" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#9f9f9f" stopOpacity="0.45" />
          <stop offset="1" stopColor="#737373" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="360" fill="url(#sSky)" />
      <circle className="scene-glow" cx="470" cy="110" r="120" fill="url(#sMoon)" />
      <rect x="452" y="92" width="36" height="36" fill="#ececec" />
      <g className="scene-stars" fill="#c1c1c1" opacity="0.5">
        <rect x="60" y="40" width="3" height="3" /><rect x="150" y="70" width="3" height="3" />
        <rect x="260" y="30" width="3" height="3" /><rect x="340" y="64" width="3" height="3" />
        <rect x="580" y="50" width="3" height="3" /><rect x="610" y="120" width="3" height="3" />
      </g>
      <g className="scene-far" fill="#272727" opacity="0.8" transform="translate(0 -26)">
        {towers.map(([x, w, h]) => <rect key={`b${x}`} x={x + 20} y={360 - h} width={w} height={h} />)}
      </g>
      <g className="scene-near" fill="#131313">
        {towers.map(([x, w, h]) => <rect key={x} x={x} y={360 - h + 40} width={w} height={h} />)}
      </g>
      <g className="scene-beams" fill="#838383" opacity="0.35">
        <polygon points="30,150 330,150 322,162 18,162" />
        <polygon points="110,186 400,186 394,196 100,196" opacity="0.7" />
      </g>
    </svg>
  );
}

export function CardArt({ kind }: { kind: "blocks" | "speed" | "sword" }) {
  return (
    <svg className="card-art" viewBox="0 0 160 72" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`ca-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={kind === "sword" ? "#333333" : "#272727"} />
          <stop offset="1" stopColor="#101010" />
        </linearGradient>
      </defs>
      <rect width="160" height="72" fill={`url(#ca-${kind})`} />
      {kind === "blocks" && (
        <g fill="#737373">
          <rect x="24" y="36" width="22" height="22" opacity="0.8" />
          <rect x="52" y="22" width="22" height="36" opacity="0.55" />
          <rect x="80" y="30" width="22" height="28" opacity="0.7" />
          <rect x="108" y="14" width="22" height="44" opacity="0.4" />
        </g>
      )}
      {kind === "speed" && (
        <g fill="#9f9f9f">
          <polygon points="20,18 120,18 116,26 14,26" opacity="0.8" />
          <polygon points="40,34 140,34 136,42 34,42" opacity="0.55" />
          <polygon points="12,50 100,50 96,58 6,58" opacity="0.35" />
        </g>
      )}
      {kind === "sword" && (
        <g transform="translate(80 36) rotate(40)">
          <polygon points="-3,-34 3,-34 4,12 -4,12" fill="#ececec" />
          <rect x="-12" y="12" width="24" height="4" fill="#a3a3a3" />
          <rect x="-2" y="16" width="4" height="12" fill="#9f9f9f" />
        </g>
      )}
    </svg>
  );
}
