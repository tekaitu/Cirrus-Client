import { useEffect, useRef, useState } from "react";
import type { SkinModel } from "../api/types";
import { SkinFigure, type SkinView } from "./SkinModel";

type StillView = Exclude<SkinView, "spin">;

const VIEW_LABEL: Record<StillView, string> = {
  front: "Front",
  back: "Back",
  left: "Left side",
  right: "Right side",
};

const MIN_ZOOM = 6;
const MAX_ZOOM = 22;

function clampScale(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** A head and shoulders, turned the way the button points. */
function PersonIcon({ variant }: { variant: StillView }) {
  const side = variant === "left" || variant === "right";
  const back = variant === "back";
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      {back ? (
        <>
          <circle cx="8" cy="5.2" r="2.7" strokeDasharray="1.8 1.4" />
          <path d="M3.5 13.4c0-2.7 2-4.4 4.5-4.4s4.5 1.7 4.5 4.4" strokeDasharray="1.8 1.4" />
        </>
      ) : (
        <>
          <circle cx="8" cy="5.2" r="2.7" />
          <path d="M3.5 13.4c0-2.7 2-4.4 4.5-4.4s4.5 1.7 4.5 4.4" />
          {side && <path d={variant === "left" ? "M2 8.6h2.6M2 8.6l1-1M2 8.6l1 1" : "M14 8.6h-2.6M14 8.6l-1-1M14 8.6l-1 1"} strokeLinecap="round" />}
        </>
      )}
    </svg>
  );
}

function TurnIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M13.2 8a5.2 5.2 0 1 1-1.9-4" strokeLinecap="round" />
      <path d="M13.4 2.6v3.2h-3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="8" cy="8" r="4.6" />
      <path d="M8 1.4v2M8 12.6v2M1.4 8h2M12.6 8h2" strokeLinecap="round" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ZoomIcon({ out = false }: { out?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {out ? <path d="M3.6 8h8.8" strokeLinecap="round" /> : <path d="M3.6 8h8.8M8 3.6v8.8" strokeLinecap="round" />}
    </svg>
  );
}

/**
 * The Minecraft character viewer: a dark stage, the figure itself, and one row
 * of small controls. It turns the model with the same Physics-free maths as
 * everywhere else (CSS 3D, no canvas), so zooming changes the texture scale
 * rather than stretching it, and auto-rotation is a single GPU animation
 * instead of a per-frame React update.
 */
export function SkinViewer({
  skin,
  model,
  legacy = false,
  cape = null,
  label,
  initialScale = 10,
  minScale = MIN_ZOOM,
  maxScale = MAX_ZOOM,
  className = "",
}: {
  skin: string;
  model: SkinModel;
  legacy?: boolean;
  cape?: string | null;
  /** Read out by screen readers: who this is and what they are wearing. */
  label: string;
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  className?: string;
}) {
  const [view, setView] = useState<StillView>("front");
  const [auto, setAuto] = useState(false);
  const [scale, setScale] = useState(() => clampScale(initialScale, minScale, maxScale));
  const [resetToken, setResetToken] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setScale(clampScale(initialScale, minScale, maxScale));
  }, [initialScale, minScale, maxScale]);

  // Zoom with the wheel only over the stage, so page scrolling is never stolen.
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      setScale((current) => clampScale(current + (event.deltaY > 0 ? -1 : 1), minScale, maxScale));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [minScale, maxScale]);

  const changeZoom = (delta: number) => setScale((current) => clampScale(current + delta, minScale, maxScale));
  const reset = () => {
    setView("front");
    setAuto(false);
    setScale(clampScale(initialScale, minScale, maxScale));
    setResetToken((token) => token + 1);
  };
  const percent = Math.round((scale / initialScale) * 100);

  return (
    <div className={`skin-viewer ${className}`.trim()}>
      <div className="skin-viewer-stage" ref={stage}>
        <SkinFigure
          skin={skin}
          model={model}
          view={auto ? "spin" : view}
          scale={scale}
          legacy={legacy}
          draggable
          cape={cape}
          autoRotate={auto}
          resetToken={resetToken}
          label={label}
        />
        <span className="skin-viewer-floor" aria-hidden="true" />
        <span className="skin-viewer-status small" aria-live="polite">
          {auto ? "Turning" : VIEW_LABEL[view]}
        </span>
      </div>

      <div className="skin-viewer-bar" role="toolbar" aria-label="Character preview controls">
        <div className="skin-viewer-group" role="group" aria-label="Viewing angle">
          {(Object.keys(VIEW_LABEL) as StillView[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`skin-viewer-btn ${!auto && view === option ? "is-on" : ""}`}
              aria-pressed={!auto && view === option}
              aria-label={`${VIEW_LABEL[option]} view`}
              title={`${VIEW_LABEL[option]} view`}
              onClick={() => {
                setAuto(false);
                setView(option);
              }}
            >
              <PersonIcon variant={option} />
            </button>
          ))}
        </div>

        <div className="skin-viewer-group" role="group" aria-label="Rotation">
          <button
            type="button"
            className={`skin-viewer-btn ${auto ? "is-on" : ""}`}
            aria-pressed={auto}
            aria-label={auto ? "Stop turning" : "Turn the character"}
            title={auto ? "Stop turning" : "Turn the character"}
            onClick={() => setAuto((on) => !on)}
          >
            <TurnIcon />
          </button>
          <button
            type="button"
            className="skin-viewer-btn"
            aria-label="Reset camera"
            title="Reset camera"
            onClick={reset}
          >
            <ResetIcon />
          </button>
        </div>

        <div className="skin-viewer-group skin-viewer-zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            className="skin-viewer-btn"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={scale <= minScale}
            onClick={() => changeZoom(-1)}
          >
            <ZoomIcon out />
          </button>
          <span className="skin-viewer-value" aria-hidden="true">
            {percent}%
          </span>
          <button
            type="button"
            className="skin-viewer-btn"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={scale >= maxScale}
            onClick={() => changeZoom(1)}
          >
            <ZoomIcon />
          </button>
        </div>
      </div>

      <p className="skin-viewer-hint small">Drag to turn · scroll to zoom · arrow keys turn · Home resets</p>
    </div>
  );
}
