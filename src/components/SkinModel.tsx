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
  z: number;
  grow: number;
}

function parts(model: Model, legacy: boolean): Part[] {
  const aw = model === "slim" ? 3 : 4;
  const base = (p: Omit<Part, "grow">): Part[] => [{ ...p, grow: 0 }];
  const over = (p: Omit<Part, "grow">): Part[] => [{ ...p, grow: 0.5 }];
  // y is the box centre measured from the middle of the 32 pixel tall figure.
  const head = { w: 8, h: 8, d: 8, x: 0, y: -12, z: 0 };
  const body = { w: 8, h: 12, d: 4, x: 0, y: -2, z: 0 };
  const rArm = { w: aw, h: 12, d: 4, x: -(4 + aw / 2), y: -2, z: 0 };
  const lArm = { w: aw, h: 12, d: 4, x: 4 + aw / 2, y: -2, z: 0 };
  const rLeg = { w: 4, h: 12, d: 4, x: -2, y: 10, z: 0 };
  const lLeg = { w: 4, h: 12, d: 4, x: 2, y: 10, z: 0 };
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

/**
 * A fixed light from the upper left. Each visible side of a box gets a little
 * darker as it turns away from that light, which is what gives the flat pixel
 * texture its depth without a WebGL renderer or a per-frame loop.
 */
const SHADE: Record<string, number> = {
  front: 0,
  right: 0.14,
  left: 0.2,
  back: 0.34,
  top: -0.07,
  bottom: 0.42,
};

function Box({ p, skin, s }: { p: Part; skin: string; s: number }) {
  const { u, v, w, h, d, x, y, z, grow } = p;
  const W = w + grow;
  const H = h + grow;
  const D = d + grow;
  const sheet: CSSProperties = {
    backgroundImage: `url(${skin})`,
    backgroundSize: `${64 * s}px ${64 * s}px`,
  };
  const face = (
    name: string,
    fu: number,
    fv: number,
    fw: number,
    fh: number,
    w2: number,
    h2: number,
    extra: CSSProperties,
  ) => {
    const shade = SHADE[name] ?? 0;
    return (
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
      >
        <span
          className={`skin-shade ${shade < 0 ? "skin-shade-light" : ""}`}
          style={{ opacity: Math.abs(shade) }}
          aria-hidden="true"
        />
      </span>
    );
  };
  return (
    <span
      className="skin-box"
      style={{
        width: W * s,
        height: H * s,
        transform: `translate3d(${x * s - (W * s) / 2}px, ${y * s - (H * s) / 2}px, ${z * s}px)`,
      }}
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
 * The cape hanging from the shoulders. Minecraft cape textures are 64 x 32 and
 * the outside of the cape is the 10 x 16 area at (1, 1). It turns with the
 * figure and sways a little; with reduce motion on, it stays still.
 */
function Cape({ texture, s }: { texture: string; s: number }) {
  const W = 10;
  const H = 16;
  return (
    <span
      className="skin-cape-anchor"
      style={{ transform: `translate3d(${(-W * s) / 2}px, ${-8 * s}px, ${-3.4 * s}px)` }}
    >
      <span className="skin-cape-sway">
        <span
          className="skin-cape"
          style={{
            width: W * s,
            height: H * s,
            backgroundImage: `url(${texture})`,
            backgroundSize: `${64 * s}px ${32 * s}px`,
            backgroundPosition: `-${s}px -${s}px`,
          }}
        >
          <span className="skin-cape-shade" aria-hidden="true" />
        </span>
      </span>
    </span>
  );
}

/**
 * A turnable Minecraft figure built from the skin's own pixels with CSS 3D (no canvas, no WebGL).
 * `view` is "spin" (slow turn), "front" or "back". The texture is drawn with hard pixel edges and
 * each side is lit from the same direction, so the body reads as a solid model rather than six
 * flat pictures. Dragging turns it with a little momentum; arrow keys turn it too, and a
 * double-click (or Home) puts the view back.
 */
export function SkinFigure({
  skin,
  model,
  view = "spin",
  scale = 6,
  legacy = false,
  label,
  draggable = false,
  cape = null,
  className = "",
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
  /** A cape texture (64 x 32) to hang on the figure. */
  cape?: string | null;
  className?: string;
}) {
  // While the player drags, `turn` is the angle in degrees and replaces the preset view.
  const [turn, setTurn] = useState<number | null>(null);
  const drag = useRef<{ x: number; angle: number; lastX: number; lastT: number; velocity: number } | null>(null);
  const inertia = useRef<number | null>(null);
  useEffect(() => setTurn(null), [view]);
  useEffect(
    () => () => {
      if (inertia.current !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(inertia.current);
    },
    [],
  );

  const stopInertia = () => {
    if (inertia.current !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(inertia.current);
    inertia.current = null;
  };

  const onDown = (e: PointerEvent<HTMLSpanElement>) => {
    if (!draggable) return;
    stopInertia();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const angle = turn ?? (view === "back" ? 162 : -25);
    drag.current = { x: e.clientX, angle, lastX: e.clientX, lastT: performance.now(), velocity: 0 };
  };
  const onMove = (e: PointerEvent<HTMLSpanElement>) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.velocity = ((e.clientX - d.lastX) / dt) * 0.9;
    d.lastX = e.clientX;
    d.lastT = now;
    setTurn(d.angle + (e.clientX - d.x) * 0.9);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || typeof requestAnimationFrame !== "function") return;
    let velocity = d.velocity * 16;
    if (Math.abs(velocity) < 0.4) return;
    const step = () => {
      velocity *= 0.94;
      setTurn((current) => (current ?? d.angle) + velocity);
      if (Math.abs(velocity) > 0.15) inertia.current = requestAnimationFrame(step);
      else inertia.current = null;
    };
    inertia.current = requestAnimationFrame(step);
  };

  const currentAngle = turn ?? (view === "back" ? 162 : -25);
  const manual: CSSProperties | undefined =
    turn === null ? undefined : { animation: "none", transform: `rotateX(-8deg) rotateY(${turn}deg)` };

  return (
    <span
      className={`skin-stage ${draggable ? "skin-draggable" : ""} ${className}`.trim()}
      role="img"
      aria-label={label}
      tabIndex={draggable ? 0 : undefined}
      style={{ width: 22 * scale, height: 34 * scale }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={(e) => {
        if (!draggable) return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          stopInertia();
          const step = e.key === "ArrowLeft" ? -15 : 15;
          setTurn((value) => (value ?? currentAngle) + step);
        } else if (e.key === "Home" || e.key === "Escape") {
          stopInertia();
          setTurn(null);
        }
      }}
      onDoubleClick={() => {
        stopInertia();
        setTurn(null);
      }}
    >
      <span className={`skin-figure skin-view-${view}`} style={{ width: 0, height: 0, ...manual }}>
        <span className="skin-center">
          {cape && <Cape texture={cape} s={scale} />}
          {parts(model, legacy).map((p, i) => (
            <Box key={i} p={p} skin={skin} s={scale} />
          ))}
        </span>
      </span>
    </span>
  );
}
