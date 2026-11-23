import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { SkinModel as Model } from "../api/types";
import { FACE_SHADE, faceRect, partSize, skinParts, type SkinPart } from "../core/skinGeometry";

/** The still views the figure can be put in, plus the slow turn. */
export type SkinView = "spin" | "front" | "back" | "left" | "right";

/**
 * Degrees per view. `front` is turned slightly so the face and one cheek are
 * both visible, which reads as a model rather than a flat picture.
 */
const PRESET_ANGLE: Record<Exclude<SkinView, "spin">, number> = {
  front: -20,
  back: 160,
  left: 70,
  right: -110,
};

function reducedMotion(): boolean {
  try {
    return document.documentElement.dataset.reduceMotion === "true";
  } catch {
    return false;
  }
}

/**
 * One box of the figure. Each of its six sides shows the part of the skin that
 * belongs to it, scaled to the box, and is lit from the upper left, which is
 * what makes the flat pixels read as a solid body.
 */
function Box({ part, skin, s }: { part: SkinPart; skin: string; s: number }) {
  const size = partSize(part);
  const sheet: CSSProperties = {
    backgroundImage: `url(${skin})`,
    backgroundSize: `${64 * s}px ${64 * s}px`,
  };
  const face = (
    name: "front" | "back" | "right" | "left" | "top" | "bottom",
    drawW: number,
    drawH: number,
    extra: CSSProperties,
  ) => {
    const rect = faceRect(part, name);
    const shade = FACE_SHADE[name] ?? 0;
    return (
      <span
        key={name}
        className="skin-face"
        style={{
          ...sheet,
          width: drawW * s,
          height: drawH * s,
          backgroundSize: `${64 * s * (drawW / rect.w)}px ${64 * s * (drawH / rect.h)}px`,
          backgroundPosition: `-${rect.u * s * (drawW / rect.w)}px -${rect.v * s * (drawH / rect.h)}px`,
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
      className={`skin-box skin-box-${part.layer}`}
      style={{
        width: size.w * s,
        height: size.h * s,
        transform: `translate3d(${part.x * s - (size.w * s) / 2}px, ${part.y * s - (size.h * s) / 2}px, ${
          part.z * s
        }px)`,
      }}
    >
      {face("front", size.w, size.h, { transform: `translateZ(${(size.d * s) / 2}px)` })}
      {face("back", size.w, size.h, { transform: `rotateY(180deg) translateZ(${(size.d * s) / 2}px)` })}
      {face("right", size.d, size.h, {
        left: "50%",
        marginLeft: -(size.d * s) / 2,
        transform: `rotateY(-90deg) translateZ(${(size.w * s) / 2}px)`,
      })}
      {face("left", size.d, size.h, {
        left: "50%",
        marginLeft: -(size.d * s) / 2,
        transform: `rotateY(90deg) translateZ(${(size.w * s) / 2}px)`,
      })}
      {face("top", size.w, size.d, {
        top: "50%",
        marginTop: -(size.d * s) / 2,
        transform: `rotateX(90deg) translateZ(${(size.h * s) / 2}px)`,
      })}
      {face("bottom", size.w, size.d, {
        top: "50%",
        marginTop: -(size.d * s) / 2,
        transform: `rotateX(-90deg) translateZ(${(size.h * s) / 2}px)`,
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
  const width = 10;
  const height = 16;
  return (
    <span
      className="skin-cape-anchor"
      style={{ transform: `translate3d(${(-width * s) / 2}px, ${-8 * s}px, ${-3.4 * s}px)` }}
    >
      <span className="skin-cape-sway">
        <span
          className="skin-cape"
          style={{
            width: width * s,
            height: height * s,
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
 * A turnable Minecraft figure built from the skin's own pixels with CSS 3D (no
 * canvas, no WebGL). Dragging turns it with a little momentum; arrow keys turn
 * it too, and double-click, Home or Escape puts the view back. `autoRotate`
 * uses one GPU transform animation, so a turning figure costs no JavaScript.
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
  autoRotate = false,
  resetToken = 0,
  className = "",
}: {
  skin: string;
  model: Model;
  view?: SkinView;
  /** Screen pixels per skin pixel. */
  scale?: number;
  /** A 64 x 32 skin has no separate left arm/leg or second layer. */
  legacy?: boolean;
  label: string;
  /** Let the player turn the figure by dragging it. */
  draggable?: boolean;
  /** A cape texture (64 x 32) to hang on the figure. */
  cape?: string | null;
  /** Turn the figure on its own, smoothly, without a per-frame loop. */
  autoRotate?: boolean;
  /** Change this number to put the camera back to the view. */
  resetToken?: number;
  className?: string;
}) {
  // While the player drags, `yaw` is the angle in degrees and replaces the preset view.
  const [yaw, setYaw] = useState<number | null>(null);
  const drag = useRef<{ x: number; angle: number; lastX: number; lastT: number; velocity: number } | null>(null);
  const inertia = useRef<number | null>(null);

  useEffect(() => setYaw(null), [view, resetToken, skin]);
  useEffect(
    () => () => {
      if (inertia.current !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(inertia.current);
    },
    [],
  );

  const parts = useMemo(() => skinParts(model, legacy), [model, legacy]);

  const stopInertia = () => {
    if (inertia.current !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(inertia.current);
    inertia.current = null;
  };

  const baseAngle = view === "spin" ? PRESET_ANGLE.front : PRESET_ANGLE[view];

  const onDown = (e: PointerEvent<HTMLSpanElement>) => {
    if (!draggable) return;
    stopInertia();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, angle: yaw ?? baseAngle, lastX: e.clientX, lastT: performance.now(), velocity: 0 };
  };
  const onMove = (e: PointerEvent<HTMLSpanElement>) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.velocity = ((e.clientX - d.lastX) / dt) * 0.9;
    d.lastX = e.clientX;
    d.lastT = now;
    setYaw(d.angle + (e.clientX - d.x) * 0.9);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || typeof requestAnimationFrame !== "function") return;
    let velocity = d.velocity * 16;
    if (Math.abs(velocity) < 0.4) return;
    const step = () => {
      velocity *= 0.94;
      setYaw((current) => (current ?? d.angle) + velocity);
      if (Math.abs(velocity) > 0.15) inertia.current = requestAnimationFrame(step);
      else inertia.current = null;
    };
    inertia.current = requestAnimationFrame(step);
  };

  const spinning = (autoRotate || view === "spin") && yaw === null && !reducedMotion();

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
          setYaw((value) => (value ?? baseAngle) + step);
        } else if (e.key === "Home" || e.key === "Escape") {
          stopInertia();
          setYaw(null);
        }
      }}
      onDoubleClick={() => {
        stopInertia();
        setYaw(null);
      }}
    >
      <span
        className={`skin-figure ${spinning ? "skin-view-spin" : ""}`}
        style={
          spinning
            ? undefined
            : {
                animation: "none",
                transform: `rotateX(-6deg) rotateY(${yaw ?? baseAngle}deg)`,
              }
        }
      >
        <span className="skin-center">
          {cape && <Cape texture={cape} s={scale} />}
          {parts.map((part) => (
            <Box key={part.id} part={part} skin={skin} s={scale} />
          ))}
        </span>
      </span>
    </span>
  );
}
