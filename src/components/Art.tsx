/**
 * Small original illustrations drawn in SVG, so nothing is downloaded and no
 * Minecraft artwork is used. Purely decorative.
 */

/** One blocky cloud: three stacked rows of squares, so it feels like the game without copying any of its art. */
function BlockCloud({ x, y, u = 28, rows }: { x: number; y: number; u?: number; rows: Array<[number, number]> }) {
  return (
    <g className="sky-cloud">
      {rows.map(([start, len], i) => (
        <rect key={i} x={x + start * u} y={y + i * u} width={len * u} height={u} />
      ))}
    </g>
  );
}

/** The sky behind the Play button: an original, colour-themed scene with blocky clouds. Purely decorative. */
export function SkyScene() {
  const hills: Array<[number, number]> = [
    [0, 70], [1, 96], [2, 84], [3, 120], [4, 104], [5, 88], [6, 130], [7, 112], [8, 92], [9, 124],
    [10, 100], [11, 82], [12, 116], [13, 136], [14, 108], [15, 90], [16, 118], [17, 98], [18, 84], [19, 110],
    [20, 126], [21, 102], [22, 88], [23, 114], [24, 96], [25, 80], [26, 106], [27, 122], [28, 94], [29, 86],
    [30, 112], [31, 100], [32, 118], [33, 90], [34, 104], [35, 124], [36, 98], [37, 84], [38, 110], [39, 92],
    [40, 76], [41, 102], [42, 116],
  ];
  return (
    <svg className="sky-scene" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="skyFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--sky-top)" }} />
          <stop offset="0.7" style={{ stopColor: "var(--sky-mid)" }} />
          <stop offset="1" style={{ stopColor: "var(--sky-bottom)" }} />
        </linearGradient>
        <radialGradient id="skyGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: "var(--sky-glow)", stopOpacity: 0.55 }} />
          <stop offset="1" style={{ stopColor: "var(--sky-glow)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <rect width="1200" height="420" fill="url(#skyFill)" />
      <circle cx="930" cy="130" r="210" fill="url(#skyGlow)" />
      <rect className="sky-sun" x="906" y="106" width="48" height="48" />
      <g className="sky-stars">
        {[[90, 54], [210, 120], [340, 40], [470, 98], [610, 52], [720, 140], [820, 60], [1090, 70], [1150, 170], [160, 190]].map(
          ([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" />
          ),
        )}
      </g>
      <g className="sky-clouds-far">
        <BlockCloud x={70} y={150} u={22} rows={[[1, 4], [0, 6], [2, 3]]} />
        <BlockCloud x={600} y={110} u={22} rows={[[1, 3], [0, 5], [1, 4]]} />
        <BlockCloud x={1020} y={210} u={22} rows={[[1, 3], [0, 5], [2, 2]]} />
      </g>
      <g className="sky-clouds-near">
        <BlockCloud x={250} y={210} u={30} rows={[[2, 4], [0, 8], [1, 6]]} />
        <BlockCloud x={760} y={190} u={30} rows={[[1, 3], [0, 6], [1, 5]]} />
      </g>
      <g className="sky-hills">
        {hills.map(([i, h]) => (
          <rect key={i} x={i * 30} y={420 - h} width="30" height={h} />
        ))}
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
