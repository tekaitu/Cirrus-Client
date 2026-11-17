import { useCallback, useRef, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ShaderButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, keeps the button busy and blocks a second click. */
  loading?: boolean;
  loadingLabel?: string;
  /** Icon shown before the text. */
  icon?: ReactNode;
  block?: boolean;
}

/**
 * The launcher's premium button: a layered, lit surface rather than flat glass.
 *
 * The light follows the cursor through two CSS variables written straight to the
 * element (no React state, no re-render, one animation frame per move), so a row
 * of buttons costs nothing while the pointer is still. Everything visual lives in
 * effects.css and turns itself off with reduced motion.
 */
export function ShaderButton({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  icon,
  block = false,
  className = "",
  children,
  disabled,
  type = "button",
  onPointerMove,
  onPointerLeave,
  ...rest
}: ShaderButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const frame = useRef<number | null>(null);
  const next = useRef<{ x: number; y: number } | null>(null);

  const write = useCallback(() => {
    frame.current = null;
    const el = ref.current;
    const point = next.current;
    if (!el || !point) return;
    el.style.setProperty("--light-x", `${point.x}%`);
    el.style.setProperty("--light-y", `${point.y}%`);
  }, []);

  const move = (e: PointerEvent<HTMLButtonElement>) => {
    onPointerMove?.(e);
    if (disabled || loading || e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    next.current = {
      x: Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100)),
    };
    if (frame.current === null && typeof requestAnimationFrame === "function") {
      frame.current = requestAnimationFrame(write);
    } else {
      write();
    }
  };

  const leave = (e: PointerEvent<HTMLButtonElement>) => {
    onPointerLeave?.(e);
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--light-x", "50%");
    el.style.setProperty("--light-y", "0%");
  };

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={`shader-btn shader-${variant} shader-${size} ${block ? "shader-block" : ""} ${
        loading ? "is-loading" : ""
      } ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onPointerMove={move}
      onPointerLeave={leave}
    >
      <span className="shader-btn-rim" aria-hidden="true" />
      <span className="shader-btn-light" aria-hidden="true" />
      <span className="shader-btn-sheen" aria-hidden="true" />
      <span className="shader-btn-content">
        {loading ? <span className="shader-spinner" aria-hidden="true" /> : icon}
        <span>{loading ? (loadingLabel ?? children) : children}</span>
      </span>
    </button>
  );
}
