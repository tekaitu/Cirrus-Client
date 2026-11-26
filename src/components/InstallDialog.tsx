import { useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { FabricLoaderOption } from "../api/types";
import { FabricIcon, GrassBlockIcon, OptifineIcon, PlayArrowIcon } from "./Icons";
import { CloseIcon, WarningIcon } from "./Icons";
import { InstallProgress } from "./InstallProgress";
import { Spinner } from "./ui";
import { useInstallJob } from "../hooks/useInstallJob";
import type { AppData } from "../hooks/useAppData";
import type { PageId } from "./Navigation";
import type { LoaderId } from "../core/game";

type InstallType = "vanilla" | "fabric";

/**
 * Installing one Minecraft version. Vanilla and Fabric are real choices with
 * their own marks; Fabric can pin a loader version. OptiFine is not offered,
 * because this build has no verified, non-interactive way to install it — that
 * is said plainly instead of showing a button that cannot work.
 */
export function InstallDialog({
  version,
  data,
  onClose,
  onNavigate,
}: {
  version: string;
  data: AppData;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
}) {
  const [type, setType] = useState<InstallType>("fabric");
  const [loaders, setLoaders] = useState<FabricLoaderOption[] | null>(null);
  const [loaderError, setLoaderError] = useState<string | null>(null);
  const [loaderVersion, setLoaderVersion] = useState<string>("");
  const [startedAt, setStartedAt] = useState(0);
  const job = useInstallJob(() => data.reloadInstances());

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && job.phase !== "running") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, job.phase]);

  // Fabric's list is only fetched when Fabric is chosen, so Vanilla installs need no extra request.
  useEffect(() => {
    if (type !== "fabric" || loaders !== null) return;
    let alive = true;
    setLoaderError(null);
    void api
      .fabricLoaderVersions(version)
      .then((list) => {
        if (!alive) return;
        setLoaders(list);
        const recommended = list.find((l) => l.stable) ?? list[0];
        setLoaderVersion(recommended?.version ?? "");
      })
      .catch((e) => {
        if (alive) setLoaderError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [type, version, loaders]);

  useEffect(() => {
    if (job.phase === "running") setStartedAt((at) => at || Date.now());
    else setStartedAt(0);
  }, [job.phase]);

  const recommended = loaders?.find((l) => l.stable)?.version ?? loaders?.[0]?.version ?? "";
  const chosen = type === "fabric" ? (loaderVersion || recommended) : null;
  const running = job.phase === "running";

  const start = () => {
    if (running) return;
    job.start(version, type as LoaderId, chosen);
  };

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !running) onClose();
      }}
    >
      <div className="modal install-modal" role="dialog" aria-modal="true" aria-label={`Install Minecraft ${version}`}>
        <header className="install-head">
          <div>
            <p className="eyebrow">Install</p>
            <h2 className="modal-title">Minecraft {version}</h2>
            <p className="muted small">Pick how you want to play it. Game files are checked against Mojang's hashes as they arrive.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close install" onClick={onClose} disabled={running}>
            <CloseIcon />
          </button>
        </header>

        {job.phase === "done" ? (
          <div className="install-done">
            <h3>Minecraft {version} is installed</h3>
            <p className="muted small">
              It is now in your Library as its own instance, with its own worlds, mods and settings.
            </p>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={() => onNavigate("library")}>
                Open Library
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : job.phase === "running" ? (
          <div className="install-progress-wrap">
            <InstallProgress
              progress={job.progress}
              startedAt={startedAt || Date.now()}
              cancelling={job.cancelling}
              onCancel={job.cancel}
            />
            <p className="muted small">
              Cancelling stops the download and leaves nothing half-installed. You can start again later.
            </p>
          </div>
        ) : (
          <>
            <div className="install-types" role="radiogroup" aria-label="Installation type">
              <button
                type="button"
                role="radio"
                aria-checked={type === "fabric"}
                className={`install-type ${type === "fabric" ? "is-on" : ""}`}
                onClick={() => setType("fabric")}
              >
                <span className="install-type-icon install-type-fabric">
                  <FabricIcon />
                </span>
                <span className="install-type-text">
                  <strong>Fabric</strong>
                  <small>Mods, performance mods and most modern packs.</small>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={type === "vanilla"}
                className={`install-type ${type === "vanilla" ? "is-on" : ""}`}
                onClick={() => setType("vanilla")}
              >
                <span className="install-type-icon install-type-vanilla">
                  <GrassBlockIcon />
                </span>
                <span className="install-type-text">
                  <strong>Vanilla</strong>
                  <small>The official game, unmodified.</small>
                </span>
              </button>
            </div>

            {type === "fabric" && (
              <div className="install-loader">
                <label htmlFor="fabric-loader">Fabric Loader version</label>
                {loaderError ? (
                  <p className="error-text">
                    <WarningIcon /> {loaderError}
                  </p>
                ) : loaders === null ? (
                  <p className="muted small">
                    <Spinner label="Loading Fabric versions" /> Asking Fabric which loaders work with {version}…
                  </p>
                ) : (
                  <>
                    <select
                      id="fabric-loader"
                      value={chosen ?? ""}
                      onChange={(e) => setLoaderVersion(e.target.value)}
                    >
                      {loaders.map((l) => (
                        <option key={l.version} value={l.version}>
                          {l.version}
                          {l.version === recommended ? " (recommended)" : l.stable ? " (stable)" : " (beta)"}
                        </option>
                      ))}
                    </select>
                    <p className="muted small">
                      {chosen === recommended
                        ? "The newest stable loader for this Minecraft version. You can change it later in the instance settings."
                        : "A specific loader. You can switch back at any time without losing worlds or mods."}
                    </p>
                  </>
                )}
              </div>
            )}

            <p className="install-optifine muted small">
              <OptifineIcon /> <strong>OptiFine</strong> is added after the install, not during it: it belongs to an
              instance. Once {version} is installed, open Versions, pick the instance and choose the OptiFine jar you
              downloaded. On Fabric, Sodium and Lithium give the same kind of boost.
            </p>

            {job.phase === "error" && (
              <p className="error-text" role="alert">
                {job.message}
              </p>
            )}
            {job.phase === "cancelled" && <p className="muted small">Installation cancelled. Nothing was changed.</p>}

            <div className="row install-actions">
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={start}
                disabled={type === "fabric" && (loaders === null || chosen === "")}
              >
                <PlayArrowIcon /> Install {type === "fabric" ? "Fabric" : "Vanilla"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
