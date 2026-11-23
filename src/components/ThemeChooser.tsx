import { useState } from "react";
import { WELCOME_THEMES, getTheme, setTheme, type ThemeId } from "../core/theme";

/**
 * First launch only: two preview panels, Classic and Colorful. Picking one
 * applies it immediately and remembers it, so the question is never asked
 * again; Settings can change it at any time.
 */
export function ThemeChooser({ onChosen }: { onChosen: (id: ThemeId) => void }) {
  const [current, setCurrent] = useState<ThemeId>(() => getTheme());
  const choose = (id: ThemeId) => {
    setTheme(id);
    setCurrent(id);
    onChosen(id);
  };

  return (
    <div className="modal-backdrop welcome-backdrop">
      <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <header className="welcome-head">
          <p className="eyebrow">Welcome to Maple</p>
          <h1 id="welcome-title">Choose your look</h1>
          <p className="muted">
            Both themes run the same launcher — your accounts, instances, mods and settings are shared. You can switch
            whenever you like in Settings.
          </p>
        </header>

        <div className="welcome-grid" role="radiogroup" aria-label="Launcher theme">
          {WELCOME_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={current === theme.id}
              aria-label={`${theme.label} theme`}
              className={`welcome-card welcome-${theme.id} ${current === theme.id ? "is-on" : ""}`}
              onClick={() => choose(theme.id)}
            >
              <span className="welcome-preview" aria-hidden="true" style={{ background: theme.swatch[0] }}>
                <span className="wp-side" style={{ background: theme.swatch[2] }}>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="wp-body">
                  <span className="wp-hero" style={{ background: theme.swatch[1] }} />
                  <span className="wp-card" style={{ background: theme.swatch[2] }}>
                    <i className="wp-badge" style={{ background: theme.accent }} />
                  </span>
                  <span className="wp-form" style={{ background: theme.swatch[1] }} />
                  <span className="wp-line" />
                  <span className="wp-line short" />
                </span>
              </span>
              <span className="welcome-title">
                {theme.label}
                {current === theme.id && <span className="welcome-check">Selected</span>}
              </span>
              <span className="welcome-blurb">{theme.blurb}</span>
            </button>
          ))}
        </div>

        <p className="welcome-foot muted small">Maple keeps every instance, account and setting when you change theme.</p>
      </div>
    </div>
  );
}
