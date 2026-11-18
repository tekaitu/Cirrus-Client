import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { VersionEntry } from "../api/types";
import { CubeIcon, RefreshArrowIcon, SearchIcon } from "./Icons";
import type { AppData } from "../hooks/useAppData";
import {
  filterVersions,
  groupVersions,
  javaCompatibility,
  releasedText,
  versionStatus,
  type VersionOption,
} from "../core/versionCatalog";

/**
 * Choosing what to play. The full catalog can be searched and filtered by
 * release or snapshot; each option says whether it is installed, and versions
 * this build cannot download are disabled with the reason. When Mojang's
 * manifest says which Java a version needs, the picker compares that with the
 * Java Cirrus actually found, so a mismatch is visible before Play is pressed.
 */
export function VersionSelector({ data, disabled = false }: { data: AppData; disabled?: boolean }) {
  const { selection, game } = data;
  const [catalog, setCatalog] = useState<VersionEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "release" | "snapshot">("all");

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
        javaMajor: null,
      })),
      snapshots: [],
    };
  }, [catalog, selection.versions]);

  const shown = useMemo(() => filterVersions(groups, { query, kind }), [groups, query, kind]);
  const total = groups.releases.length + groups.snapshots.length;
  const filteredTotal = shown.releases.length + shown.snapshots.length;

  const chosen = [...groups.releases, ...groups.snapshots].find((v) => v.id === selection.version) ?? null;
  const installed = game.status?.installed === true && game.status.minecraft === selection.version;
  const status = versionStatus(chosen, installed);
  const checked = game.status !== null;
  const fabric = selection.loader === "fabric";
  const released = chosen ? releasedText(chosen) : null;

  const detectedJava = data.java.status === "ready" ? (data.java.data.selected?.major ?? null) : null;
  const java = javaCompatibility(chosen?.javaMajor, detectedJava);

  /**
   * Keep the saved version visible in the list even when the filter hides it
   * or Mojang's catalog no longer has it, so the select never shows a blank.
   */
  const pinned: VersionOption[] =
    chosen && ![...shown.releases, ...shown.snapshots].some((v) => v.id === chosen.id)
      ? [chosen]
      : chosen === null && selection.version
        ? [{ id: selection.version, kind: "release", released: null, supported: true, javaMajor: null }]
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
            {chosen?.kind === "snapshot" && <span className="version-kind-chip">Snapshot</span>}
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

      <div className="version-filters">
        <div className="search-box version-search">
          <SearchIcon />
          <input
            type="text"
            aria-label="Filter versions"
            placeholder="Filter versions…"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="seg" role="radiogroup" aria-label="Version type">
          {(
            [
              ["all", "All"],
              ["release", "Releases"],
              ["snapshot", "Snapshots"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={kind === id}
              className={kind === id ? "seg-on" : ""}
              disabled={disabled}
              onClick={() => setKind(id)}
            >
              {label}
            </button>
          ))}
        </div>
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
            {pinned.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id}
              </option>
            ))}
            {shown.releases.length > 0 && (
              <optgroup label="Releases">
                {shown.releases.map((v) => (
                  <option key={v.id} value={v.id} disabled={!v.supported}>
                    {v.id}
                    {!v.supported ? " — needs another Java" : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {shown.snapshots.length > 0 && (
              <optgroup label="Snapshots (not installable)">
                {shown.snapshots.map((v) => (
                  <option key={v.id} value={v.id} disabled>
                    {v.id}
                  </option>
                ))}
              </optgroup>
            )}
            {pinned.length === 0 && filteredTotal === 0 && (
              <option value={selection.version} disabled>
                No version matches “{query.trim()}”
              </option>
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

      {(query.trim() !== "" || kind !== "all") && (
        <p className="version-count muted small" role="status">
          Showing {filteredTotal} of {total} versions
          {query.trim() !== "" ? ` matching “${query.trim()}”` : ""}.
        </p>
      )}

      {java && (
        <p className={`version-java version-java-${java.tone} small`} role="status">
          {java.label}
          {java.tone === "warn" && !installed ? " · this build only installs Java 21-era versions." : ""}
        </p>
      )}

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
