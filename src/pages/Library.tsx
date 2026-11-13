import { useState, type FormEvent } from "react";
import { api, errorMessage } from "../api/client";
import type { InstanceSummary, Profile } from "../api/types";
import { PackageIcon, PlayArrowIcon, PlusIcon, TrashIcon } from "../components/Icons";
import type { PageId } from "../components/Sidebar";
import { Badge, Banner, Card, Skeleton } from "../components/ui";
import type { LoaderId } from "../core/game";
import type { AppData } from "../hooks/useAppData";
import { useResource } from "../hooks/useResource";

function instanceName(i: InstanceSummary): string {
  return `Minecraft ${i.minecraft}`;
}

/** Create, play and delete named profiles. Each has its own version, loader, worlds and mods. */
function Profiles({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId) => void }) {
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

  const open = (p: Profile, page: PageId) => {
    selection.selectProfile(p);
    onNavigate(page);
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
                  onClick={() => open(p, "home")}
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

/** Everything that is installed on this PC, one card per game version and loader. */
export function LibraryPage({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId) => void }) {
  const { selection } = data;
  const installedNow = data.game.status?.installed ?? null;
  const list = useResource<InstanceSummary[]>(() => api.listInstances(), String(installedNow));

  const open = (i: InstanceSummary, page: PageId) => {
    const loader: LoaderId = i.loader ? "fabric" : "vanilla";
    selection.setVersion(i.minecraft);
    selection.setLoader(loader);
    onNavigate(page);
  };

  return (
    <div className="page library-page">
      <header className="page-head">
        <h1>Library</h1>
        <p className="muted">Your profiles and every Minecraft version installed on this PC.</p>
      </header>

      <Profiles data={data} onNavigate={onNavigate} />

      <h2 className="section-title">Installed versions</h2>
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
          <h2>Nothing installed yet</h2>
          <p className="muted">Press “Set up &amp; play” on the Home page. Your game will show up here.</p>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("home")}>
            Go to Home
          </button>
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
                    onClick={() => open(i, "home")}
                  >
                    <PlayArrowIcon />
                    Play
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
    </div>
  );
}
