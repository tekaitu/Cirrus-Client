import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import type { VersionEntry } from "../api/types";
import { CheckIcon, ChevronDownIcon, CubeIcon, RefreshArrowIcon, SearchIcon } from "./Icons";
import type { AppData } from "../hooks/useAppData";
import { loaderLabel, loaderOf, useInstances } from "../hooks/useInstances";
import {
  filterVersions,
  groupVersions,
  javaCompatibility,
  releasedText,
  versionStatus,
  type VersionOption,
} from "../core/versionCatalog";

/**
 * Choosing what to play, the way a launcher should: a compact card that always
 * shows the chosen version, its loader and whether it is installed, and one
 * panel for everything else. The panel lists what is already installed on this
 * PC for quick switching, then every release and snapshot from Mojang's list
 * with a search box and a type filter. Versions this build cannot download are
 * visible but not selectable, with the reason, and the Java check compares the
 * version's requirement with the Java Maple actually found.
 */
export function VersionSelector({
  data,
  disabled = false,
  onPicked,
}: {
  data: AppData;
  disabled?: boolean;
  /** Called after a choice is made, so a dialog around the picker can close itself. */
  onPicked?: () => void;
}) {
  const { selection, game } = data;
  const instances = useInstances(data);
  const [catalog, setCatalog] = useState<VersionEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "release" | "snapshot">("all");
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);

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

  // The panel closes on a click anywhere else, like a real menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // The panel is rendered in a portal, so it is not inside `root`.
      if (!root.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);

  /**
   * The panel is fixed so a long version list is never cut off by the page or
   * the card: it opens below the trigger, or above it when there is more room
   * there, and always inside the window.
   */
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 380), window.innerWidth - 24);
      const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12));
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const openUp = below < 300 && above > below;
      const height = Math.max(220, Math.min(460, openUp ? above : below));
      setPlace({ top: openUp ? rect.top - height - 6 : rect.bottom + 6, left, width, height });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

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

  const installedList = instances.state.status === "ready" ? instances.state.data : [];

  /**
   * Keep the saved version visible in the list even when the filter hides it
   * or Mojang's catalog no longer has it, so the panel never shows a blank.
   */
  const pinned: VersionOption[] =
    chosen && ![...shown.releases, ...shown.snapshots].some((v) => v.id === chosen.id)
      ? [chosen]
      : chosen === null && selection.version
        ? [{ id: selection.version, kind: "release", released: null, supported: true, javaMajor: null }]
        : [];

  const pick = (option: VersionOption) => {
    if (!option.supported) return;
    selection.setVersion(option.id);
    setOpen(false);
    onPicked?.();
  };

  const pickInstance = (minecraft: string, loader: "fabric" | "vanilla") => {
    selection.setVersion(minecraft);
    selection.setLoader(loader);
    setOpen(false);
    onPicked?.();
  };

  const rows = (list: VersionOption[]) =>
    list.map((v) => {
      const isChosen = v.id === selection.version;
      const isInstalled = isChosen ? installed : installedList.some((i) => i.minecraft === v.id);
      const state = versionStatus(v, isInstalled);
      return (
        <li key={v.id} role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={isChosen}
            aria-disabled={!v.supported || undefined}
            className={`vp-row ${isChosen ? "is-selected" : ""} ${!v.supported ? "is-blocked" : ""}`.trim()}
            disabled={disabled || !v.supported}
            title={!v.supported ? state.detail : undefined}
            onClick={() => pick(v)}
          >
            <span className="vp-row-main">
              <span className="vp-row-name">{v.id}</span>
              {v.kind === "snapshot" && <span className="vp-row-kind">Snapshot</span>}
              {v.released && <span className="vp-row-date">{releasedText(v)}</span>}
            </span>
            <span className={`vp-row-state vp-state-${!v.supported ? "warn" : isInstalled ? "good" : "muted"}`}>
              {isChosen && <CheckIcon />}
              {!v.supported ? "Not installable" : isInstalled ? "Installed" : "Not installed"}
            </span>
          </button>
        </li>
      );
    });

  return (
    <div className="version-selector">
      <div className="version-options">
        <div className="version-picker" ref={root}>
          <button
            ref={trigger}
            type="button"
            className="vp-trigger"
            aria-label="Minecraft version"
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setOpen(true);
              }
            }}
          >
            <span className="vp-trigger-icon" aria-hidden="true">
              <CubeIcon />
            </span>
            <span className="vp-trigger-text">
              <span className="vp-kicker">Minecraft version</span>
              <span className="vp-name">
                {selection.version}
                <span className="vp-chip">{fabric ? "Fabric" : "Vanilla"}</span>
                {chosen?.kind === "snapshot" && <span className="vp-chip vp-chip-quiet">Snapshot</span>}
              </span>
              <span className={`vp-status vp-status-${status.tone}`}>
                {checked ? status.label : "Checking install status…"}
                {checked && <span className="vp-status-detail"> · {status.detail}</span>}
              </span>
            </span>
            <span className={`vp-chevron ${open ? "is-open" : ""}`} aria-hidden="true">
              <ChevronDownIcon />
            </span>
          </button>

          {open &&
            createPortal(
            <div
              ref={panel}
              className="vp-panel"
              style={place ? { position: "fixed", top: place.top, left: place.left, width: place.width, maxHeight: place.height } : undefined}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setOpen(false);
                  trigger.current?.focus();
                }
              }}
            >
              {installedList.length > 0 && (
                <div className="vp-installed">
                  <p className="vp-section-label">Installed on this PC</p>
                  <div className="vp-installed-row">
                    {installedList.map((i) => {
                      const l = loaderOf(i);
                      const active = i.minecraft === selection.version && l === selection.loader;
                      return (
                        <button
                          key={`${i.minecraft}-${l}`}
                          type="button"
                          className={`vp-installed-chip ${active ? "is-active" : ""}`.trim()}
                          aria-pressed={active}
                          onClick={() => pickInstance(i.minecraft, l)}
                        >
                          {i.minecraft}
                          <span className="vp-chip vp-chip-quiet">{loaderLabel(l)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="vp-filters">
                <div className="search-box vp-search">
                  <SearchIcon />
                  <input
                    ref={search}
                    type="text"
                    aria-label="Filter versions"
                    placeholder="Search versions…"
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

              <div className="vp-list" role="listbox" aria-label="Minecraft versions">
                {pinned.length > 0 && (
                  <>
                    <p className="vp-section-label">Selected</p>
                    <ul className="vp-group">{rows(pinned)}</ul>
                  </>
                )}

                {shown.releases.length > 0 && (
                  <>
                    <p className="vp-section-label">Releases</p>
                    <ul className="vp-group">{rows(shown.releases)}</ul>
                  </>
                )}
                {shown.snapshots.length > 0 && (
                  <>
                    <p className="vp-section-label">Snapshots</p>
                    <ul className="vp-group">{rows(shown.snapshots)}</ul>
                  </>
                )}
                {shown.releases.length === 0 && shown.snapshots.length === 0 && pinned.length === 0 && (
                  <p className="vp-empty muted small">No version matches “{query.trim()}”.</p>
                )}
              </div>

              <div className="vp-foot">
                <span className="muted small" role="status">
                  {query.trim() !== "" || kind !== "all"
                    ? `Showing ${filteredTotal} of ${total} versions${query.trim() !== "" ? ` matching “${query.trim()}”` : ""}`
                    : `${total} versions from Mojang`}
                </span>
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

              {catalogError && (
                <p className="vp-note small">
                  Mojang&apos;s full version list could not be reached, so only the releases Maple knows are listed.
                </p>
              )}
            </div>,
            document.body,
          )}
        </div>

        <div className="pick version-loader">
          <span id="loader-label">Loader</span>
          <div className="seg seg-stack" role="radiogroup" aria-labelledby="loader-label">
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
        {groups.snapshots.length > 0 ? " Snapshots are shown for reference but cannot be installed here." : ""}
      </p>
    </div>
  );
}
