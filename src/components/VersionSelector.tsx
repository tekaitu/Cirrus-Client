import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { VersionEntry } from "../api/types";
import { CubeIcon, RefreshArrowIcon } from "./Icons";
import type { AppData } from "../hooks/useAppData";
import { groupVersions, releasedText, versionStatus, type VersionOption } from "../core/versionCatalog";

/**
 * Choosing what to play. Releases and snapshots are grouped, every entry says
 * whether it is installed, and versions this build cannot download are listed
 * as not supported instead of looking installable.
 */
export function VersionSelector({ data, disabled = false }: { data: AppData; disabled?: boolean }) {
  const { selection, game } = data;
  const [catalog, setCatalog] = useState<VersionEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let live = true;
    setCatalogError(false);
    void Promise.resolve()
      .then(() => {
        if (typeof api.listVersionCatalog !== "function") throw new Error("Version catalog is not available here.");
        return api.listVersionCatalog();
      })
      .then((list) => {
        if (live) setCatalog(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!live) return;
        setCatalog(null);
        setCatalogError(true);
      });
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const groups = useMemo(() => {
    if (catalog && catalog.length > 0) return groupVersions(catalog);
    // Older backends (and the browser preview) only know the release list.
    return {
      releases: selection.versions.map<VersionOption>((id) => ({
        id,
        kind: "release",
        released: null,
        supported: true,
      })),
      snapshots: [],
    };
  }, [catalog, selection.versions]);

  const chosen =
    [...groups.releases, ...groups.snapshots].find((v) => v.id === selection.version) ?? null;
  const installed =
    game.status?.installed === true && game.status.minecraft === selection.version ? true : false;
  const status = versionStatus(chosen, installed);
  const checked = game.status !== null;
  const fabric = selection.loader === "fabric";
  const released = chosen ? releasedText(chosen) : null;

  /** Keep a saved version selectable even when Mojang's list no longer has it. */
  const extraRelease = chosen === null && selection.version
    ? [{ id: selection.version, kind: "release" as const, released: null, supported: true }]
    : [];

  return (
    <div className="version-selector">
      <div className="version-selected">
        <span className="version-mark" aria-hidden="true">
          <CubeIcon />
        </span>
        <div className="version-selected-text">
          <p className="version-kicker">Selected version</p>
          <p className="version-big">
            {selection.version} <span className="version-loader-chip">{fabric ? "Fabric" : "Vanilla"}</span>
          </p>
          <p className={`version-status version-status-${status.tone}`}>
            {checked ? status.label : "Checking install status…"}
            {checked && <span className="version-status-detail"> · {status.detail}</span>}
          </p>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Refresh version list"
          data-tip="Refresh version list"
          disabled={disabled}
          onClick={load}
        >
          <RefreshArrowIcon />
        </button>
      </div>

      <div className="version-fields">
        <label className="pick">
          <span>Minecraft version</span>
          <select
            aria-label="Minecraft version"
            value={selection.version}
            disabled={disabled}
            onChange={(e) => selection.setVersion(e.target.value)}
          >
            {extraRelease.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id}
              </option>
            ))}
            <optgroup label="Releases">
              {groups.releases.map((v) => (
                <option key={v.id} value={v.id} disabled={!v.supported}>
                  {v.id}
                  {!v.supported ? " — needs another Java" : ""}
                </option>
              ))}
            </optgroup>
            {groups.snapshots.length > 0 && (
              <optgroup label="Snapshots (not supported)">
                {groups.snapshots.map((v) => (
                  <option key={v.id} value={v.id} disabled>
                    {v.id}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <div className="pick">
          <span id="loader-label">Loader</span>
          <div className="seg" role="radiogroup" aria-labelledby="loader-label">
            {(["fabric", "vanilla"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={selection.loader === l}
                className={selection.loader === l ? "seg-on" : ""}
                disabled={disabled}
                onClick={() => selection.setLoader(l)}
              >
                {l === "fabric" ? "Fabric" : "Vanilla"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="version-note muted small">
        {fabric
          ? installed && game.status?.loader
            ? `Fabric ${game.status.loader} is installed for ${selection.version}.`
            : `Fabric is the mod loader; Play installs its newest stable build for ${selection.version}.`
          : "Vanilla is plain Minecraft and cannot load mods."}
        {released ? ` Released ${released}.` : ""}
        {catalogError
          ? " Mojang's full version list could not be reached, so only releases are listed."
          : groups.snapshots.length > 0
            ? " Snapshots are shown for reference but cannot be installed here."
            : ""}
      </p>
    </div>
  );
}
