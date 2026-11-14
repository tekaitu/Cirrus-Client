import { useState, type FormEvent } from "react";
import { api, errorMessage } from "../api/client";
import type { InstanceSummary, Profile } from "../api/types";
import { CubeIcon, FolderIcon, JavaIcon, MemoryIcon, PackageIcon, PlayArrowIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { PlayPanel } from "../components/PlayPanel";
import type { PageId } from "../components/Sidebar";
import { formatMemory } from "../core/format";
import { javaTitle } from "../components/JavaStatus";
import { Badge, Banner, Card, Skeleton } from "../components/ui";
import type { LoaderId } from "../core/game";
import type { AppData } from "../hooks/useAppData";
import { useResource } from "../hooks/useResource";

function instanceName(i: InstanceSummary): string {
  return `Minecraft ${i.minecraft}`;
}

/** Create, play and delete named profiles. Each has its own version, loader, worlds and mods. */
function Profiles({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId, section?: string) => void }) {
  const { selection } = data;
  const list = data.profiles.status === "ready" ? data.profiles.data : [];
  const [name, setName] = useState("");
  const [version, setVersion] = useState(selection.version);
  const [loader, setLoader] = useState<LoaderId>("fabric");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the profile a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const made = await api.createProfile(name.trim(), version, loader);
      setName("");
      data.reloadProfiles();
      selection.selectProfile(made);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Profile) => {
    setConfirm(null);
    try {
      await api.deleteProfile(p.id);
      if (selection.profile?.id === p.id) selection.selectProfile(null);
      data.reloadProfiles();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const open = (p: Profile, page: PageId | null) => {
    selection.selectProfile(p);
    if (page) onNavigate(page);
    else window.scrollTo?.({ top: 0 });
  };

  return (
    <Card
      id="profiles"
      title="Profiles"
      tone="pink"
      icon={<PackageIcon />}
      description="Your own setups, like “PvP” or “Building”. Each keeps its own mods and worlds."
    >
      <form className="profile-form" onSubmit={create}>
        <div className="pick">
          <label htmlFor="profile-name">Profile name</label>
          <input
            id="profile-name"
            type="text"
            value={name}
            maxLength={32}
            autoComplete="off"
            placeholder="e.g. PvP"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <label className="pick">
          <span>Minecraft version</span>
          <select aria-label="Profile version" value={version} onChange={(e) => setVersion(e.target.value)}>
            {selection.versions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="pick">
          <span id="profile-loader-label">Loader</span>
          <div className="seg" role="radiogroup" aria-labelledby="profile-loader-label">
            {(["fabric", "vanilla"] as LoaderId[]).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={loader === l}
                className={loader === l ? "seg-on" : ""}
                onClick={() => setLoader(l)}
              >
                {l === "fabric" ? "Fabric" : "Vanilla"}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <PlusIcon />
          {busy ? "Creating…" : "Create profile"}
        </button>
      </form>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {data.profiles.status === "loading" && <Skeleton label="Loading profiles" lines={2} />}
      {data.profiles.status === "ready" && list.length === 0 && (
        <p className="muted small">No profiles yet. Create one above and it will show up here.</p>
      )}
      {list.length > 0 && (
        <ul className="instance-grid profile-grid">
          {list.map((p) => (
            <li key={p.id} className="instance-card">
              <span className={`instance-icon hue-${p.color % 6}`} aria-hidden="true">
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="instance-body">
                <h3>{p.name}</h3>
                <p className="muted small">
                  Minecraft {p.minecraft} · {p.fabric ? "Fabric" : "Vanilla"}
                </p>
                {selection.profile?.id === p.id && <Badge tone="info">Selected</Badge>}
              </div>
              <div className="instance-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  aria-label={`Play profile ${p.name}`}
                  onClick={() => open(p, null)}
                >
                  <PlayArrowIcon />
                  Play
                </button>
                {p.fabric && (
                  <button type="button" className="btn" aria-label={`Mods for profile ${p.name}`} onClick={() => open(p, "mods")}>
                    Mods
                  </button>
                )}
                {confirm === p.id ? (
                  <button type="button" className="btn btn-danger" aria-label={`Confirm delete ${p.name}`} onClick={() => void remove(p)}>
                    <TrashIcon />
                    Really delete?
                  </button>
                ) : (
                  <button type="button" className="btn btn-quiet" aria-label={`Delete profile ${p.name}`} onClick={() => setConfirm(p.id)}>
                    <TrashIcon />
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.length > 0 && <p className="muted small">Deleting a profile keeps its folder on disk, so worlds are never lost by accident.</p>}
    </Card>
  );
}

const MEMORY_PRESETS_MB = [2048, 4096, 6144, 8192];

/** Memory, Java and game folder at a glance. Memory changes are saved at once through the real settings. */
function LaunchConfig({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId, section?: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const settings = data.settings.status === "ready" ? data.settings.data : null;
  const java = data.java.status === "ready" ? data.java.data.selected : null;

  const setMemory = async (mb: number) => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const outcome = await api.saveSettings({ ...settings.settings, memoryMb: mb });
      if (outcome.ok && outcome.state) data.applySettings(outcome.state);
      else setError(outcome.errors[0]?.message ?? "The memory setting was not saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id="launch-config" title="Launch configuration" icon={<CubeIcon />} description="What the game starts with.">
      {!settings ? (
        <Skeleton label="Loading launch settings" lines={3} />
      ) : (
        <dl className="config-list">
          <div>
            <dt>
              <MemoryIcon /> Memory
            </dt>
            <dd>
              <strong>{formatMemory(settings.settings.memoryMb)}</strong>
              <span className="muted small"> of {formatMemory(settings.totalRamMb)} installed</span>
              <div className="presets" role="group" aria-label="Memory for the game">
                {MEMORY_PRESETS_MB.filter((mb) => mb >= settings.minMemoryMb && mb <= settings.maxMemoryMb).map((mb) => (
                  <button
                    key={mb}
                    type="button"
                    className={`chip ${settings.settings.memoryMb === mb ? "chip-on" : ""}`}
                    aria-pressed={settings.settings.memoryMb === mb}
                    disabled={saving}
                    onClick={() => void setMemory(mb)}
                  >
                    {mb / 1024} GB
                  </button>
                ))}
              </div>
            </dd>
          </div>
          <div>
            <dt>
              <JavaIcon /> Java
            </dt>
            <dd>
              {java ? <strong>{javaTitle(java)}</strong> : <span className="muted">Not found yet. Set up &amp; play installs it.</span>}
              <button type="button" className="link-inline" onClick={() => onNavigate("settings", "performance")}>
                Change
              </button>
            </dd>
          </div>
          <div>
            <dt>
              <FolderIcon /> Game folder
            </dt>
            <dd>
              <span className="path">{settings.settings.gameDir}</span>
              <button type="button" className="link-inline" onClick={() => onNavigate("settings", "folder")}>
                Change
              </button>
            </dd>
          </div>
        </dl>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

/** Everything that is installed on this PC, one card per game version and loader. */
function Installations({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId, section?: string) => void }) {
  const { selection } = data;
  const installedNow = data.game.status?.installed ?? null;
  const list = useResource<InstanceSummary[]>(() => api.listInstances(), String(installedNow));

  const open = (i: InstanceSummary, page: PageId | null) => {
    const loader: LoaderId = i.loader ? "fabric" : "vanilla";
    selection.setVersion(i.minecraft);
    selection.setLoader(loader);
    if (page) onNavigate(page);
    else window.scrollTo?.({ top: 0 });
  };

  return (
    <Card id="installations" title="Installed versions" icon={<CubeIcon />} description="Every Minecraft version on this PC, one card per version and loader.">
      {list.state.status === "loading" && <Skeleton label="Loading library" lines={3} />}
      {list.state.status === "error" && (
        <Banner
          tone="warn"
          title="The library is only available in the desktop app"
          actions={
            <button type="button" className="btn" onClick={list.reload}>
              Try again
            </button>
          }
        >
          {list.state.message}
        </Banner>
      )}
      {list.state.status === "ready" && list.state.data.length === 0 && (
        <div className="empty empty-big">
          <CubeIcon />
          <h2>Nothing installed yet</h2>
          <p className="muted">Press “Set up &amp; play” above. The version you pick is downloaded and shows up here.</p>
        </div>
      )}
      {list.state.status === "ready" && list.state.data.length > 0 && (
        <ul className="instance-grid">
          {list.state.data.map((i) => {
            const current = selection.version === i.minecraft && (selection.loader === "fabric") === (i.loader !== null);
            return (
              <li key={`${i.minecraft}-${i.loader ?? "vanilla"}`} className="instance-card">
                <span className={`instance-icon ${i.loader ? "instance-fabric" : ""}`} aria-hidden="true">
                  {i.minecraft.split(".").slice(0, 2).join(".")}
                </span>
                <div className="instance-body">
                  <h3>{instanceName(i)}</h3>
                  <p className="muted small">
                    {i.loader ? `Fabric ${i.loader}` : "Vanilla"}
                    {i.loader ? ` · ${i.modCount} ${i.modCount === 1 ? "mod" : "mods"}` : ""}
                  </p>
                  {current && <Badge tone="info">Selected</Badge>}
                </div>
                <div className="instance-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    aria-label={`Play ${instanceName(i)} ${i.loader ? "with Fabric" : "vanilla"}`}
                    onClick={() => open(i, null)}
                  >
                    <PlayArrowIcon />
                    Select
                  </button>
                  {i.loader && (
                    <button
                      type="button"
                      className="btn"
                      aria-label={`Mods for ${instanceName(i)}`}
                      onClick={() => open(i, "mods")}
                    >
                      Mods
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Version, installation and launch controls in one place. Home keeps only the big Play button. */
export function PlayPage({
  data,
  onNavigate,
  onOpenAccount,
}: {
  data: AppData;
  onNavigate: (page: PageId, section?: string) => void;
  onOpenAccount: () => void;
}) {
  return (
    <div className="page play-page">
      <header className="page-head">
        <h1>Play</h1>
        <p className="muted">Choose a version, set up what it needs, and start the game.</p>
      </header>
      <div className="play-grid">
        <Card id="launch" title="Launch" icon={<PlayArrowIcon />} description="Version, loader, player and the Play button.">
          <PlayPanel data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} variant="full" />
        </Card>
        <LaunchConfig data={data} onNavigate={onNavigate} />
      </div>
      <Profiles data={data} onNavigate={onNavigate} />
      <Installations data={data} onNavigate={onNavigate} />
    </div>
  );
}
