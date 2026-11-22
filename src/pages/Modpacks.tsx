import { useMemo, useState } from "react";
import { Badge, Skeleton } from "../components/ui";
import { LibraryIcon, ModsIcon, PlayArrowIcon, PlusIcon } from "../components/Icons";
import type { PageId } from "../components/Navigation";
import { lastPlayedText, sortInstances } from "../core/instances";
import type { AppData } from "../hooks/useAppData";

/**
 * Modpacks are instances. v0.3.3 gives every installed game its own mods folder,
 * so a "PvP" setup and a "Building" setup are simply two instances — one system,
 * not a second list that could drift away from the Library.
 */
export function ModpacksPage({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId, section?: string) => void }) {
  const [onlyModded, setOnlyModded] = useState(false);
  const instances = data.instances.status === "ready" ? data.instances.data : [];
  const shown = useMemo(() => {
    const list = sortInstances(instances, "recent");
    return onlyModded ? list.filter((i) => i.modCount > 0) : list;
  }, [instances, onlyModded]);

  return (
    <div className="page modpacks-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Setups</p>
          <h1>Modpacks</h1>
          <p>
            Each instance keeps its own mods, worlds and settings, so one can be a PvP pack and another a building
            world without touching each other.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => onNavigate("versions")}>
          <PlusIcon /> New setup
        </button>
      </header>

      <div className="toolbar">
        <div className="seg" role="radiogroup" aria-label="Which setups">
          <button type="button" role="radio" aria-checked={!onlyModded} className={!onlyModded ? "seg-on" : ""} onClick={() => setOnlyModded(false)}>
            Every instance
          </button>
          <button type="button" role="radio" aria-checked={onlyModded} className={onlyModded ? "seg-on" : ""} onClick={() => setOnlyModded(true)}>
            With mods
          </button>
        </div>
      </div>

      {data.instances.status === "loading" && <Skeleton label="Loading setups" lines={2} />}

      {data.instances.status === "ready" && shown.length === 0 && (
        <div className="empty empty-big">
          <LibraryIcon />
          <h2>{onlyModded ? "No instance has mods yet" : "No setups yet"}</h2>
          <p className="muted">
            {onlyModded
              ? "Open an instance's mods from the Library, or upload a .jar there, and it will show up here."
              : "Install a version first; every install becomes its own instance with its own folder."}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("versions")}>
            Install a version
          </button>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="setup-list">
          {shown.map((instance) => (
            <li key={instance.id} className="setup-row">
              <span className={`lib-icon lib-icon-${instance.icon % 8}`} aria-hidden="true">
                ◆
              </span>
              <div className="setup-main">
                <div className="lib-title-row">
                  <h2>{instance.name}</h2>
                  <Badge tone={instance.loader === "fabric" ? "info" : "neutral"}>
                    {instance.loader === "fabric" ? `Fabric ${instance.loaderVersion ?? ""}`.trim() : "Vanilla"}
                  </Badge>
                </div>
                <p className="muted small">
                  Minecraft {instance.minecraft} · {instance.modCount} {instance.modCount === 1 ? "mod" : "mods"} ·{" "}
                  {lastPlayedText(instance.lastPlayed)}
                </p>
              </div>
              <div className="lib-actions">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    data.selection.selectInstance(instance);
                    onNavigate("mods");
                  }}
                >
                  <ModsIcon /> Mods
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => {
                    data.selection.selectInstance(instance);
                    onNavigate("library");
                  }}
                >
                  <PlayArrowIcon /> Play
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="muted small">
        Need a modpack's mods in a new setup? Duplicate the instance in the Library; the copy gets its own folder.
      </p>
    </div>
  );
}
