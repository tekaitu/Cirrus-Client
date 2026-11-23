import { useEffect, useState } from "react";
import type { SkinModel } from "../api/types";
import { FALLBACK_LABEL, fallbackSkin } from "../core/fallbackSkin";
import { usePlayerAppearance } from "../hooks/useAppearance";
import { RefreshArrowIcon, WarningIcon } from "./Icons";
import { SkinFigure } from "./SkinModel";
import { Skeleton } from "./ui";

export type CharacterView = "spin" | "front" | "back";

const MODEL_LABEL: Record<SkinModel, string> = { classic: "Classic", slim: "Slim" };

/** Settings > Appearance can keep the figure still; turning is the default. */
function preferredView(): CharacterView {
  try {
    return window.localStorage.getItem("cirrus.characterSpin") === "off" ? "front" : "spin";
  } catch {
    return "spin";
  }
}

/**
 * The signed-in account's own Minecraft character, with its real skin, arm
 * model and equipped cape. Missing or failed skins fall back to a clearly
 * labelled default look, so the account never appears as a blank square.
 */
export function CharacterPreview({
  player,
  view,
  scale = 8,
  showControls = true,
  showCape = true,
  compact = false,
  onViewChange,
}: {
  player: { id: string; name: string } | null;
  view?: CharacterView;
  /** Screen pixels per skin pixel. */
  scale?: number;
  showControls?: boolean;
  /** Draw the account's own cape. A Maple cape is never implied here. */
  showCape?: boolean;
  compact?: boolean;
  onViewChange?: (view: CharacterView) => void;
}) {
  const { appearance, loading, error, reload } = usePlayerAppearance(player?.id ?? null);
  const [localView, setLocalView] = useState<CharacterView>(() => view ?? preferredView());
  useEffect(() => {
    if (view) setLocalView(view);
  }, [view]);
  const current = view ?? localView;
  const setView = (next: CharacterView) => {
    setLocalView(next);
    onViewChange?.(next);
  };

  if (!player) {
    return (
      <div className={`character-preview character-empty ${compact ? "is-compact" : ""}`.trim()}>
        <div className="character-empty-mark" aria-hidden="true">
          <WarningIcon />
        </div>
        <p className="muted small">Sign in with Microsoft to see your Minecraft character.</p>
      </div>
    );
  }

  const model: SkinModel = appearance?.model ?? "classic";
  const usingFallback = !appearance;
  const texture = appearance?.skin ?? fallbackSkin(model);
  const label = appearance
    ? `${appearance.name}, ${MODEL_LABEL[appearance.model]} model${showCape && appearance.cape ? ", cape" : ""}`
    : `${player.name}, ${FALLBACK_LABEL}`;

  return (
    <div className={`character-preview ${compact ? "is-compact" : ""}`.trim()}>
      {loading && !appearance ? (
        <div className="character-loading" role="status" aria-label="Loading your Minecraft character">
          <Skeleton lines={3} label="Loading your Minecraft character" />
        </div>
      ) : (
        <div className="character-stage">
          <SkinFigure
            key={`${appearance?.skin ?? "fallback"}-${model}-${appearance?.legacy ?? false}`}
            skin={texture}
            model={model}
            view={current}
            scale={scale}
            legacy={appearance?.legacy ?? false}
            draggable={!usingFallback}
            cape={showCape ? (appearance?.cape ?? null) : null}
            label={label}
          />
          <span className="character-floor" aria-hidden="true" />
        </div>
      )}

      <div className="character-meta">
        <p className="character-name">{player.name}</p>
        <p className="muted small">
          {usingFallback ? `${FALLBACK_LABEL} · skin unavailable` : `${MODEL_LABEL[model]} model`}
          {appearance?.cape ? " · your cape" : ""}
        </p>
      </div>

      {error && (
        <p className="character-note" role="status">
          <WarningIcon />
          <span>
            {error} A default look is shown instead.{" "}
            <button type="button" className="link-inline" onClick={reload}>
              Try again
            </button>
          </span>
        </p>
      )}
      {!error && usingFallback && !loading && (
        <p className="character-note" role="status">
          <WarningIcon />
          <span>This account has no skin Maple can read, so a default look is shown.</span>
        </p>
      )}

      {showControls && (
        <div className="character-controls">
          <div className="seg" role="radiogroup" aria-label="Character view">
            {(["spin", "front", "back"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={current === v}
                aria-label={`${v === "spin" ? "Turning" : v === "front" ? "Front" : "Back"} view`}
                className={current === v ? "seg-on" : ""}
                onClick={() => setView(v)}
              >
                {v === "spin" ? "Turn" : v === "front" ? "Front" : "Back"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Refresh skin"
            data-tip="Refresh skin"
            onClick={reload}
            disabled={loading}
          >
            <RefreshArrowIcon />
          </button>
        </div>
      )}
    </div>
  );
}
