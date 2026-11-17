import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { SkinModel as Model } from "../api/types";

/** One body part: where its pieces are in the skin picture (u, v), its size in skin pixels, and where it sits. */
interface Part {
  u: number;
  v: number;
  w: number;
  h: number;
  d: number;
  x: number;
  y: number;
  grow: number;
}

function parts(model: Model, legacy: boolean): Part[] {
  const aw = model === "slim" ? 3 : 4;
  const base = (p: Omit<Part, "grow">): Part[] => [{ ...p, grow: 0 }];
  const over = (p: Omit<Part, "grow">): Part[] => [{ ...p, grow: 0.5 }];
  // y is the box centre measured from the middle of the 32 pixel tall figure.
  const head = { w: 8, h: 8, d: 8, x: 0, y: -12 };
  const body = { w: 8, h: 12, d: 4, x: 0, y: -2 };
  const rArm = { w: aw, h: 12, d: 4, x: -(4 + aw / 2), y: -2 };
  const lArm = { w: aw, h: 12, d: 4, x: 4 + aw / 2, y: -2 };
  const rLeg = { w: 4, h: 12, d: 4, x: -2, y: 10 };
  const lLeg = { w: 4, h: 12, d: 4, x: 2, y: 10 };
  return [
    ...base({ ...rLeg, u: 0, v: 16 }),
    ...base({ ...lLeg, u: legacy ? 0 : 16, v: legacy ? 16 : 48 }),
    ...base({ ...body, u: 16, v: 16 }),
    ...base({ ...rArm, u: 40, v: 16 }),
    ...base({ ...lArm, u: legacy ? 40 : 32, v: legacy ? 16 : 48 }),
    ...base({ ...head, u: 0, v: 0 }),
    // The second layer (jacket, sleeves, trousers, hat) is a slightly larger box around each part.
    ...(legacy
      ? over({ ...head, u: 32, v: 0 })
      : [
          ...over({ ...rLeg, u: 0, v: 32 }),
          ...over({ ...lLeg, u: 0, v: 48 }),
          ...over({ ...body, u: 16, v: 32 }),
          ...over({ ...rArm, u: 40, v: 32 }),
          ...over({ ...lArm, u: 48, v: 48 }),
          ...over({ ...head, u: 32, v: 0 }),
        ]),
  ];
}

function Box({ p, skin, s }: { p: Part; skin: string; s: number }) {
  const { u, v, w, h, d, x, y, grow } = p;
  const W = w + grow;
  const H = h + grow;
  const D = d + grow;
  const sheet: CSSProperties = {
    backgroundImage: `url(${skin})`,
    backgroundSize: `${64 * s}px ${64 * s}px`,
  };
  const face = (name: string, fu: number, fv: number, fw: number, fh: number, w2: number, h2: number, extra: CSSProperties) => (
    <span
      key={name}
      className="skin-face"
      style={{
        ...sheet,
        width: w2 * s,
        height: h2 * s,
        backgroundSize: `${64 * s * (w2 / fw)}px ${64 * s * (h2 / fh)}px`,
        backgroundPosition: `-${fu * s * (w2 / fw)}px -${fv * s * (h2 / fh)}px`,
        ...extra,
      }}
    />
  );
  return (
    <span
      className="skin-box"
      style={{ width: W * s, height: H * s, transform: `translate3d(${x * s - (W * s) / 2}px, ${y * s - (H * s) / 2}px, 0)` }}
    >
      {face("front", u + d, v + d, w, h, W, H, { transform: `translateZ(${(D * s) / 2}px)` })}
      {face("back", u + 2 * d + w, v + d, w, h, W, H, { transform: `rotateY(180deg) translateZ(${(D * s) / 2}px)` })}
      {face("right", u, v + d, d, h, D, H, {
        left: "50%",
        marginLeft: -(D * s) / 2,
        transform: `rotateY(-90deg) translateZ(${(W * s) / 2}px)`,
      })}
      {face("left", u + d + w, v + d, d, h, D, H, {
        left: "50%",
        marginLeft: -(D * s) / 2,
        transform: `rotateY(90deg) translateZ(${(W * s) / 2}px)`,
      })}
      {face("top", u + d, v, w, d, W, D, {
        top: "50%",
        marginTop: -(D * s) / 2,
        transform: `rotateX(90deg) translateZ(${(H * s) / 2}px)`,
      })}
      {face("bottom", u + d + w, v, w, d, W, D, {
        top: "50%",
        marginTop: -(D * s) / 2,
        transform: `rotateX(-90deg) translateZ(${(H * s) / 2}px)`,
      })}
    </span>
  );
}

/**
 * A turnable Minecraft figure built from the skin's own pixels with CSS 3D (no canvas, no WebGL).
 * `view` is "spin" (slow turn), "front" or "back". The texture is drawn with hard pixel edges.
 */
export function SkinFigure({
  skin,
  model,
  view = "spin",
  scale = 6,
  legacy = false,
  label,
  draggable = false,
}: {
  skin: string;
  model: Model;
  view?: "spin" | "front" | "back";
  /** Screen pixels per skin pixel. */
  scale?: number;
  /** A 64 x 32 skin has no separate left arm/leg or second layer. */
  legacy?: boolean;
  label: string;
  /** Let the player turn the figure by dragging it (double-click puts it back). */
  draggable?: boolean;
}) {
  // While the player drags, `turn` is the angle in degrees and replaces the preset view.
  const [turn, setTurn] = useState<number | null>(null);
  const from = useRef<{ x: number; angle: number } | null>(null);
  useEffect(() => setTurn(null), [view]);

  const onDown = (e: PointerEvent<HTMLSpanElement>) => {
    if (!draggable) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    from.current = { x: e.clientX, angle: turn ?? (view === "back" ? 162 : -25) };
  };
  const onMove = (e: PointerEvent<HTMLSpanElement>) => {
    if (!from.current) return;
    setTurn(from.current.angle + (e.clientX - from.current.x) * 0.9);
  };
  const onUp = () => {
    from.current = null;
  };

  const manual: CSSProperties | undefined =
    turn === null ? undefined : { animation: "none", transform: `rotateX(-8deg) rotateY(${turn}deg)` };
  return (
    <span
      className={`skin-stage ${draggable ? "skin-draggable" : ""}`}
      role="img"
      aria-label={label}
      style={{ width: 22 * scale, height: 34 * scale }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={() => setTurn(null)}
    >
      <span className={`skin-figure skin-view-${view}`} style={{ width: 0, height: 0, ...manual }}>
        <span className="skin-center">
          {parts(model, legacy).map((p, i) => (
            <Box key={i} p={p} skin={skin} s={scale} />
          ))}
        </span>
      </span>
    </span>
  );
}
