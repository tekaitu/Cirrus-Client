import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, keeps the button busy and blocks a second click. */
  loading?: boolean;
  /** Text shown while loading; the label stays put otherwise. */
  loadingLabel?: string;
  /** Icon shown before the label. */
  icon?: ReactNode;
  /** A square button with only an icon; `aria-label` is required. */
  iconOnly?: boolean;
  block?: boolean;
}

/**
 * The launcher's button.
 *
 * It is an ordinary desktop control: a solid surface, a one-pixel press, and a
 * short release. There is no pointer tracking, no glow and no sweep, so the
 * cost of a hundred buttons is the same as the cost of one. Hover only changes
 * colour; the pressed state and disabled state are explicit classes so every
 * button in the app behaves the same way.
 *
 * `loading` disables the control and reports `aria-busy`, but keeps its width:
 * the spinner replaces the icon and `loadingLabel` replaces the text, so the
 * layout does not jump while work is in flight.
 */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  loadingLabel,
  icon,
  iconOnly = false,
  block = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    "ui-btn",
    `ui-btn-${variant}`,
    `ui-btn-${size}`,
    iconOnly ? "ui-btn-icon" : "",
    block ? "ui-btn-block" : "",
    loading ? "is-loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <span className="ui-btn-spinner" aria-hidden="true" />
      ) : (
        icon && <span className="ui-btn-icon-slot" aria-hidden="true">{icon}</span>
      )}
      {!iconOnly && (
        <span className="ui-btn-label">{loading ? (loadingLabel ?? children) : children}</span>
      )}
    </button>
  );
}

/** A square, icon-only button. The accessible name is required. */
export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  className = "",
  ...rest
}: Omit<ButtonProps, "iconOnly" | "children" | "aria-label"> & {
  label: string;
  icon: ReactNode;
}) {
  return (
    <Button
      {...rest}
      variant={variant}
      size={size}
      iconOnly
      icon={icon}
      aria-label={label}
      title={rest.title ?? label}
      className={className}
    />
  );
}
