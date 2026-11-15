import { useState, type FormEvent } from "react";
import { api, errorMessage } from "../api/client";
import type { Profile } from "../api/types";
import { PackageIcon, PlayArrowIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { VersionCard } from "../components/VersionCard";
import type { PageId } from "../components/Navigation";
import { Badge, Card, Skeleton } from "../components/ui";
import type { LoaderId } from "../core/game";
import type { AppData } from "../hooks/useAppData";

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
    <div className="modpacks-layout">
      <Card className="mp-create" title="Create a modpack" icon={<PlusIcon />} tone="pink" description="Your own setup, like “PvP” or “Building”. Each keeps its own mods and worlds.">
        <form className="profile-form" onSubmit={create}>
          <div className="pick">
            <label htmlFor="profile-name">Profile name</label>
            <input id="profile-name" type="text" value={name} maxLength={32} autoComplete="off" placeholder="e.g. PvP" onChange={(e) => setName(e.target.value)} />
          </div>
          <label className="pick">
            <span>Version</span>
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
                  aria-label={`${l === "fabric" ? "Fabric" : "Vanilla"} for the new profile`}
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
      </Card>

      {data.profiles.status === "loading" && <Skeleton label="Loading profiles" lines={2} />}
      {data.profiles.status === "ready" && list.length === 0 && (
        <div className="empty empty-big mp-empty">
          <PackageIcon />
          <h2>No modpacks yet</h2>
          <p className="muted">Create one on the left. It shows up here with its own version, loader, mods and worlds.</p>
        </div>
      )}
      {list.length > 0 && (
        <ul className="vgrid profile-grid">
          {list.map((p) => (
            <li key={p.id}>
              <VersionCard
                version={p.minecraft}
                loader={p.fabric ? "Fabric" : "Vanilla"}
                line={p.name}
                selected={selection.profile?.id === p.id}
                badge={selection.profile?.id === p.id ? <Badge tone="info">Selected</Badge> : undefined}
                actions={
                  <>
                    <button type="button" className="btn btn-primary btn-small" aria-label={`Play profile ${p.name}`} onClick={() => open(p, null)}>
                      <PlayArrowIcon />
                      Play
                    </button>
                    {p.fabric && (
                      <button type="button" className="btn btn-small" aria-label={`Mods for profile ${p.name}`} onClick={() => open(p, "mods")}>
                        Mods
                      </button>
                    )}
                    {confirm === p.id ? (
                      <button type="button" className="btn btn-danger btn-small" aria-label={`Confirm delete ${p.name}`} onClick={() => void remove(p)}>
                        <TrashIcon />
                        Really delete?
                      </button>
                    ) : (
                      <button type="button" className="btn btn-quiet btn-small" aria-label={`Delete profile ${p.name}`} onClick={() => setConfirm(p.id)}>
                        <TrashIcon />
                        Delete
                      </button>
                    )}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Named setups, each with its own version, loader, mods and worlds. */
export function ModpacksPage({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId, section?: string) => void }) {
  return (
    <div className="page modpacks-page">
      <header className="page-head">
        <p className="eyebrow">Library</p>
        <h1>Modpacks</h1>
        <p>Keep separate setups for different ways to play. Deleting one keeps its folder on disk, so worlds are never lost by accident.</p>
      </header>
      <Profiles data={data} onNavigate={onNavigate} />
    </div>
  );
}
