import { useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { InstanceView, VersionEntry } from "../api/types";
import { CreateInstanceDialog } from "../components/CreateInstance";
import { InstallDialog } from "../components/InstallDialog";
import { InstanceCard } from "../components/InstanceCard";
import { InstanceEditor } from "../components/InstanceEditor";
import { Badge, Banner, Skeleton } from "../components/ui";
import {
  ChevronDownIcon,
  CubeIcon,
  LibraryIcon,
  ModsIcon,
  OptifineIcon,
  PlayArrowIcon,
  PlusIcon,
  SearchIcon,
} from "../components/Icons";
import type { PageId } from "../components/Navigation";
import { FAMILIES, familyOf, groupByFamily, lastPlayedText, sortInstances, type FamilyGroup } from "../core/instances";
import { usernameError } from "../core/game";
import { readBase64 } from "../core/upload";
import type { AppData } from "../hooks/useAppData";
import { usePlayAs } from "../hooks/usePlayAs";

/** Short version label for a family card: `1.21` for the modern families, `other` never shows. */
function familyLabel(key: string): string {
  return key === "other" ? "1.9 – 1.15" : key;
}

/**
 * OptiFine starts the game through launchwrapper 1.12, which boots 1.8 to 1.12.
 * Newer OptiFine builds need a different launchwrapper, so they are not offered.
 */
function supportsOptifine(version: string): boolean {
  const parts = version.split(".");
  const minor = Number(parts[1] ?? NaN);
  return parts[0] === "1" && Number.isFinite(minor) && minor >= 8 && minor <= 12;
}

/**
 * Versions & Instances: one section, two lists.
 *
 * The grid is what can still be installed, one card per Minecraft family with
 * its own artwork, the family number in the middle and that family's releases as
 * chips. Choosing a chip fills the panel on the right: the release, its loader,
 * the instances built from it, and Play. Instances are the second list, below the
 * grid, so an installed game is never mixed into the list of things to install.
 */
export function VersionsPage({
  data,
  onNavigate,
  onOpenAccount,
}: {
  data: AppData;
  onNavigate: (page: PageId) => void;
  onOpenAccount: () => void;
}) {
  const { selection, game } = data;
  const playAs = usePlayAs();
  const [catalog, setCatalog] = useState<VersionEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [optifineBusy, setOptifineBusy] = useState(false);
  const [optifineNotice, setOptifineNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const optifineFile = useRef<HTMLInputElement>(null);

  const version = selection.version;
  const loader = selection.loader;
  const instances = data.instances.status === "ready" ? data.instances.data : [];
  const loaded = data.instances.status === "ready";

  useEffect(() => {
    let alive = true;
    void api
      .listVersionCatalog()
      .then((list) => {
        if (alive) setCatalog(list);
      })
      .catch((e) => {
        if (!alive) return;
        setCatalogError(errorMessage(e));
        // Without the desktop backend the picker still offers the versions the
        // launcher knows about, marked as releases with no date.
        setCatalog(
          data.selection.versions.map((id) => ({
            id,
            kind: "release",
            released: null,
            supported: true,
            javaMajor: null,
          })),
        );
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo<{ groups: FamilyGroup[]; snapshots: number }>(() => {
    if (!catalog) return { groups: [], snapshots: 0 };
    return groupByFamily(catalog);
  }, [catalog]);

  const snapshotIds = useMemo(
    () => (catalog ?? []).filter((entry) => entry.kind === "snapshot").map((entry) => entry.id).slice(0, 14),
    [catalog],
  );

  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    return grouped.groups
      .map((group) => ({
        ...group,
        versions: q
          ? group.versions.filter((v) => v.id.toLowerCase().includes(q) || group.family.title.toLowerCase().includes(q))
          : group.versions,
      }))
      .filter((group) => group.versions.length > 0);
  }, [grouped.groups, text]);

  const current = grouped.groups.find((g) => g.family.key === familyOf(version).key) ?? null;
  const currentFamily = current?.family ?? familyOf(version);
  const installedHere = instances.filter((i) => i.minecraft === version);
  const chosen = installedHere.find((i) => i.loader === loader) ?? null;
  // OptiFine belongs to a Vanilla instance, whichever loader the rail is showing.
  const optifineTarget = installedHere.find((i) => i.loader === "vanilla") ?? null;
  const installed = game.status?.installed === true && game.status.minecraft === version;
  const running = game.run.phase === "running" || game.run.phase === "starting";
  const downloading = game.installer.phase === "running";
  const java = data.java.status === "ready" ? data.java.data.selected : null;
  const nameProblem = playAs.mode === "offline" ? usernameError(playAs.name) : null;
  const released = current?.versions.find((v) => v.id === version)?.released ?? null;

  // The row selects first; the launch itself waits for that instance's status.
  useEffect(() => {
    if (!pending) return;
    if (selection.instance?.id !== pending) return;
    if (!game.status) return;
    setPending(null);
    if (!game.status.installed) {
      setInstalling(selection.instance?.minecraft ?? version);
      return;
    }
    if (!java) {
      setActionError("Java is needed before Minecraft can start. Pick a Java in Settings.");
      return;
    }
    game.play(java.path, playAs.mode, playAs.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, selection.instance?.id, game.status, java, playAs.mode, playAs.name]);

  const launch = (instance: InstanceView) => {
    setActionError(null);
    if (running) {
      setActionError("Minecraft is already starting or running.");
      return;
    }
    if (downloading) {
      setActionError("A download is running. Wait for it to finish, then play.");
      return;
    }
    if (nameProblem) {
      setActionError(nameProblem);
      onOpenAccount();
      return;
    }
    selection.selectInstance(instance);
    setPending(instance.id);
  };

  const start = () => {
    setActionError(null);
    if (running) {
      setActionError("Minecraft is already starting or running.");
      return;
    }
    if (downloading) {
      setActionError("A download is running. Wait for it to finish, then play.");
      return;
    }
    if (nameProblem) {
      setActionError(nameProblem);
      onOpenAccount();
      return;
    }
    // Without an instance for this release the install dialog is the next step,
    // because a version becomes an instance only after its files are on disk.
    if (!chosen) {
      setInstalling(version);
      return;
    }
    launch(chosen);
  };

  /** The jar is checked in Rust; this only reads the file and reports the answer. */
  const addOptifine = async (file: File | undefined) => {
    if (!file || !optifineTarget) return;
    setOptifineBusy(true);
    setOptifineNotice(null);
    try {
      const dataBase64 = await readBase64(file);
      await api.installOptifine(optifineTarget.id, file.name, dataBase64);
      await data.reloadInstances();
      setOptifineNotice({ tone: "good", text: `${file.name} is installed. Play starts it through OptiFine.` });
    } catch (e) {
      setOptifineNotice({ tone: "bad", text: errorMessage(e) });
    } finally {
      setOptifineBusy(false);
      if (optifineFile.current) optifineFile.current.value = "";
    }
  };

  const dropOptifine = async (instance: InstanceView) => {
    setOptifineBusy(true);
    setOptifineNotice(null);
    try {
      await api.removeOptifine(instance.id);
      await data.reloadInstances();
      setOptifineNotice({ tone: "good", text: "OptiFine is no longer used by this instance. Its jar stays on disk." });
    } catch (e) {
      setOptifineNotice({ tone: "bad", text: errorMessage(e) });
    } finally {
      setOptifineBusy(false);
    }
  };

  const editingInstance = editing ? (instances.find((i) => i.id === editing) ?? null) : null;

  return (
    <div className="page versions-page vx-page">
      <header className="page-head">
        <p className="eyebrow">Versions &amp; instances</p>
        <h1>Versions</h1>
        <p>
          Pick a release on the left and set it up on the right. Every install becomes its own instance, listed below the
          grid.
        </p>
      </header>

      {actionError && (
        <Banner tone="warn" title="That needs something first">
          {actionError}
        </Banner>
      )}

      <div className="vx">
        <div className="vx-main">
          <div className="vx-bar">
            <div className="search-box vx-search">
              <SearchIcon />
              <input
                type="search"
                aria-label="Search a version"
                placeholder="Search a version, e.g. 1.8.9…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={`btn vx-snap-toggle ${snapshotsOpen ? "is-on" : ""}`}
              aria-pressed={snapshotsOpen}
              onClick={() => setSnapshotsOpen((v) => !v)}
            >
              Snapshots
              <ChevronDownIcon />
            </button>
          </div>

          {catalogError && (
            <Banner tone="warn" title="Mojang's version list could not be read">
              {catalogError} Only the versions built into this launcher are shown.
            </Banner>
          )}

          {!catalog && <Skeleton label="Loading Minecraft versions" lines={4} />}

          {snapshotsOpen && (
            <div className="vx-snapshots" aria-label="Snapshots">
              {snapshotIds.length === 0 ? (
                <p className="muted small">Mojang lists no snapshots this build knows about.</p>
              ) : (
                <>
                  <p className="muted small vx-snap-label">
                    Snapshots · {grouped.snapshots} listed by Mojang, none installable here
                  </p>
                  <div className="vx-snap-row">
                    {snapshotIds.map((id) => (
                      <span key={id} className="vx-chip is-off" title="Snapshots cannot be installed by this build.">
                        {id}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {catalog && shown.length === 0 && (
            <div className="empty empty-big">
              <CubeIcon />
              <h2>No versions match</h2>
              <p className="muted">Try another search.</p>
              <button type="button" className="btn" onClick={() => setText("")}>
                Clear the search
              </button>
            </div>
          )}

          {shown.length > 0 && (
            <div className="vx-grid">
              {shown.map(({ family, versions }) => {
                const active = family.key === familyOf(version).key;
                const installedInFamily = versions.filter((v) => instances.some((i) => i.minecraft === v.id)).length;
                const chips = versions.slice(0, 8);
                return (
                  <article key={family.key} className={`vx-card ${active ? "is-active" : ""}`}>
                    <button
                      type="button"
                      className="vx-card-main"
                      aria-label={`Minecraft ${familyLabel(family.key)}`}
                      aria-pressed={active}
                      onClick={() => selection.setVersion(versions[0].id)}
                    >
                      <img className="vx-card-art" src={family.art} alt="" aria-hidden="true" loading="lazy" />
                      <span className="vx-card-shade" aria-hidden="true" />
                      <span className="vx-card-title">{familyLabel(family.key)}</span>
                      {installedInFamily > 0 && (
                        <span className="vx-card-installed">
                          <LibraryIcon /> {installedInFamily}
                        </span>
                      )}
                    </button>
                    <div className="vx-chips">
                      {chips.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          className={`vx-chip ${v.id === version ? "is-on" : ""}`.trim()}
                          aria-pressed={v.id === version}
                          title={instances.some((i) => i.minecraft === v.id) ? `${v.id} · installed` : v.id}
                          onClick={() => selection.setVersion(v.id)}
                        >
                          {v.id}
                        </button>
                      ))}
                      {versions.length > chips.length && (
                        <span className="vx-chip is-more">+{versions.length - chips.length}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <section className="vx-instances" aria-labelledby="vx-instances-title">
            <header className="vx-instances-head">
              <div>
                <h2 id="vx-instances-title">Your instances</h2>
                <p className="muted small">
                  {loaded
                    ? instances.length === 0
                      ? "Nothing is installed yet. Every version above becomes an instance once its files download."
                      : `${instances.length} ${instances.length === 1 ? "instance" : "instances"} on this PC, each with its own mods, worlds and settings.`
                    : "The instance list is available in the desktop app."}
                </p>
              </div>
              <div className="vx-instances-actions">
                <button type="button" className="btn btn-small" onClick={() => onNavigate("mods")}>
                  <ModsIcon /> Modpacks
                </button>
                <button type="button" className="btn btn-small btn-primary" onClick={() => setCreating(true)}>
                  <PlusIcon /> Create instance
                </button>
              </div>
            </header>

            {loaded && instances.length === 0 && (
              <p className="muted small vx-instances-empty">
                Choose a release above, then press its install button. Installing makes the instance for you.
              </p>
            )}

            {instances.length > 0 && (
              <div className="instance-grid library-grid">
                {sortInstances(instances, "recent").map((instance) => (
                  <InstanceCard
                    key={instance.id}
                    instance={instance}
                    selected={selection.instance?.id === instance.id}
                    onSelect={() => selection.selectInstance(instance)}
                    onLaunch={() => launch(instance)}
                    onMods={() => {
                      selection.selectInstance(instance);
                      onNavigate("mods");
                    }}
                    onSettings={() => setEditing(instance.id)}
                    onFolder={() => void api.openInstanceFolder(instance.id).catch((e) => setActionError(errorMessage(e)))}
                    launchDisabled={running || downloading}
                    launchTitle={
                      running ? "Minecraft is already running." : downloading ? "A download is running." : "Start this instance"
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="vx-rail" aria-label={`Minecraft ${version}`}>
          <div className="vx-rail-head">
            <img className="vx-rail-art" src={currentFamily.art} alt="" aria-hidden="true" />
            <span className="vx-rail-shade" aria-hidden="true" />
            <div className="vx-rail-title">
              <strong>{version}</strong>
              <span className="vx-rail-badges">
                <span className="vx-badge">{loader === "fabric" ? "Fabric" : "Vanilla"}</span>
                {installed && <span className="vx-badge vx-badge-good">Installed</span>}
                {released && <span className="vx-badge vx-badge-quiet">{new Date(released).toLocaleDateString()}</span>}
              </span>
            </div>
          </div>

          <div className="vx-rail-loaders" role="radiogroup" aria-label="Loader">
            {(
              [
                ["vanilla", "Vanilla"],
                ["fabric", "Fabric"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={loader === id}
                className={`vx-loader ${loader === id ? "is-on" : ""}`}
                onClick={() => selection.setLoader(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {optifineTarget && supportsOptifine(version) && (
            <div className="vx-optifine-block">
              <div className="vx-optifine-head">
                <span className="vx-optifine-name">
                  <OptifineIcon /> OptiFine
                </span>
                {optifineTarget.optifine ? (
                  <>
                    <span className="vx-badge vx-badge-good">{optifineTarget.optifine}</span>
                    <button
                      type="button"
                      className="link-inline"
                      disabled={optifineBusy}
                      onClick={() => void dropOptifine(optifineTarget)}
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={optifineBusy}
                    onClick={() => optifineFile.current?.click()}
                  >
                    {optifineBusy ? "Adding…" : "Choose jar…"}
                  </button>
                )}
              </div>
              <p className="muted small">
                {optifineTarget.optifine
                  ? `“${optifineTarget.name}” starts Minecraft ${version} through OptiFine ${optifineTarget.optifine}.`
                  : `Download OptiFine for ${version} from optifine.net, then choose that .jar for “${optifineTarget.name}”. It is checked before anything is installed.`}
              </p>
              {optifineNotice && (
                <p className={`vx-optifine-note small vx-note-${optifineNotice.tone}`} role="status">
                  {optifineNotice.text}
                </p>
              )}
              <input
                ref={optifineFile}
                className="visually-hidden"
                type="file"
                accept=".jar"
                aria-label="OptiFine jar"
                onChange={(e) => void addOptifine(e.target.files?.[0])}
              />
            </div>
          )}

          {!optifineTarget && supportsOptifine(version) && (
            <p className="vx-optifine muted small">
              {installedHere.length === 0 ? (
                <>
                  <strong>OptiFine</strong> can be added once {version} is installed: it attaches to an instance, not to a
                  download.
                </>
              ) : (
                <>
                  <strong>OptiFine</strong> needs a Vanilla instance of {version}: this version is only installed with a
                  loader, and OptiFine replaces the game&apos;s own launcher.
                </>
              )}
            </p>
          )}

          <div className="vx-rail-section">
            <header>
              <h2>Instances</h2>
              <button type="button" className="link-inline" onClick={() => setCreating(true)}>
                + New
              </button>
            </header>
            {installedHere.length === 0 ? (
              <p className="muted small">No instance uses Minecraft {version} yet.</p>
            ) : (
              <ul className="vx-packs">
                {installedHere.map((instance) => {
                  const on = selection.instance?.id === instance.id;
                  return (
                    <li key={instance.id}>
                      <button
                        type="button"
                        className={`vx-pack ${on ? "is-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => selection.selectInstance(instance)}
                      >
                        <span className="vx-pack-icon" aria-hidden="true">
                          {instance.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="vx-pack-main">
                          <strong>{instance.name}</strong>
                          <small>{lastPlayedText(instance.lastPlayed)}</small>
                        </span>
                        {instance.modCount > 0 && (
                          <Badge tone="neutral">
                            {instance.modCount} {instance.modCount === 1 ? "mod" : "mods"}
                          </Badge>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="vx-rail-note muted small">
            Every instance is its own copy of the game. Worlds, settings and mods are shared unless the instance has its
            own folder, and each one keeps a separate mods folder.
          </p>

          <div className="vx-rail-actions">
            <button type="button" className="btn btn-primary" onClick={start} disabled={running || downloading}>
              <PlayArrowIcon />
              {!chosen ? `Install ${version}` : installed ? "Play" : "Set up & play"}
            </button>
            <button type="button" className="btn" onClick={() => onNavigate("mods")}>
              <ModsIcon /> Mods &amp; more
            </button>
          </div>
        </aside>
      </div>

      {installing && (
        <InstallDialog version={installing} data={data} onClose={() => setInstalling(null)} onNavigate={onNavigate} />
      )}

      {creating && (
        <CreateInstanceDialog
          data={data}
          onClose={() => setCreating(false)}
          onCreated={(instance) => {
            setCreating(false);
            void data.reloadInstances();
            selection.selectInstance(instance);
          }}
        />
      )}

      {editingInstance && (
        <InstanceEditor
          instance={editingInstance}
          data={data}
          onClose={() => setEditing(null)}
          onChanged={() => data.reloadInstances()}
        />
      )}

      <p className="muted small vx-foot">
        {FAMILIES.length} families · Releases are checked against Mojang&apos;s hashes as they download.
      </p>
    </div>
  );
}

// `familyOf` is exported for the Home page's shortcuts and tests.
export { familyOf };
