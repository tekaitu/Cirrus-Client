import type { ReactNode } from "react";

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Card({
  title,
  action,
  children,
  className = "",
  id,
  icon,
  description,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  /** Small icon shown before the title. */
  icon?: ReactNode;
  /** One short line under the title. */
  description?: string;
}) {
  return (
    <section id={id} className={`card ${className}`.trim()}>
      {(title || action) && (
        <header className="card-head">
          <div className="card-title">
            {icon && <span className="card-icon">{icon}</span>}
            <div>
              {title && <h2>{title}</h2>}
              {description && <p className="card-desc">{description}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Spinner({ label }: { label: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

export function Skeleton({ lines = 2, label }: { lines?: number; label: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={`skeleton-line ${i === 0 ? "wide" : ""}`} />
      ))}
    </div>
  );
}

export function Banner({
  tone,
  title,
  children,
  actions,
}: {
  tone: Tone;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={`banner banner-${tone}`} role={tone === "bad" ? "alert" : "status"}>
      <div>
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="banner-actions">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint && <dd className="muted small">{hint}</dd>}
    </div>
  );
}
