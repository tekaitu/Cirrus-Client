import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { InstanceView } from "../api/types";
import { Button } from "../components/Button";
import { InstanceCard } from "../components/InstanceCard";
import { LibraryIcon, PlusIcon, SearchIcon } from "../components/Icons";
import { InstanceEditor } from "../components/InstanceEditor";
import type { PageId } from "../components/Navigation";
import { Banner, Skeleton } from "../components/ui";
import { usernameError } from "../core/game";
import { recentSearchText, sortInstances } from "../core/instances";
import type { AppData } from "../hooks/useAppData";
import { usePlayAs } from "../hooks/usePlayAs";

type Sort = "recent" | "name" | "version";

/**
 * The Library: installed instances only, each with its own name, icon, folder
 * and settings. A version appears here after its installation finished, never
 * before, and every action applies to one instance.
 */
export function LibraryPage({
  data,
  onNavigate,
  onOpenAccount,
}: {
  data: AppData;
  onNavigate: (page: PageId) => void;
  onOpenAccount: () => void;
}) {
  const playAs = usePlayAs();
  const { game, selection, instances } = data;
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<"all" | "fabric" | "vanilla">("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = instances.status === "ready" ? instances.data : [];
  const java = data.java.status === "ready" ? data.java.data.selected : null;
  const running = game.run.phase === "running" || game.run.phase === "starting";
  const installing = game.installer.phase === "running";
  const nameProblem = playAs.mode === "offline" ? usernameError(playAs.name) : null;

  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    const filtered = list.filter((i) => {
      if (filter !== "all" && i.loader !== filter) return false;
      return q === "" || recentSearchText(i).includes(q);
    });
    return sortInstances(filtered, sort);
  }, [list, text, filter, sort]);

  const editingInstance = editing ? list.find((i) => i.id === editing) ?? null : null;

  // Launching a card selects it first; this starts the game once the status of
  // that selection is known, so the click is never lost to a race.
  useEffect(() => {
    if (!pending) return;
    if (selection.instance?.id !== pending) return;
    if (!game.status) return;
    setPending(null);
    if (!java || !game.status.installed) return;
    game.play(java.path, playAs.mode, playAs.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, selection.instance?.id, game.status, java, playAs.mode, playAs.name]);

  const launch = (instance: InstanceView) => {
    setActionError(null);
    if (running) {
      setActionError("Minecraft is already starting or running.");
      return;
    }
    if (installing) {
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

  const openFolder = (instance: InstanceView) => {
    void api.openInstanceFolder(instance.id).catch((e) => setActionError(errorMessage(e)));
  };

  return (
    <div className="page library-page">
      <header className="page-head page-head-row library-page-head">
        <div>
          <p className="eyebrow">Installed</p>
          <h1>Library</h1>
          <p>Every instance on this PC, with its own settings, mods, worlds and Java.</p>
        </div>
        <Button variant="primary" onClick={() => onNavigate("versions")} icon={<PlusIcon />}>
          Add Version
        </Button>
      </header>

      {list.length > 0 && (
        <div className="toolbar">
          <div className="search-box">
            <SearchIcon />
            <input
              type="search"
              aria-label="Search instances"
              placeholder="Search your instances…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="seg" role="radiogroup" aria-label="Filter by loader">
            {(
              [
                ["all", "All"],
                ["fabric", "Fabric"],
                ["vanilla", "Vanilla"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={filter === id}
                className={filter === id ? "seg-on" : ""}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="sort-field">
            <span className="muted small">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort instances">
              <option value="recent">Recently played</option>
              <option value="name">Name</option>
              <option value="version">Newest version</option>
            </select>
          </label>
        </div>
      )}

      {actionError && (
        <Banner tone="warn" title="That action needs something first">
          {actionError}
        </Banner>
      )}

      {instances.status === "loading" && <Skeleton label="Loading your library" lines={3} />}
      {instances.status === "error" && (
        <Banner
          tone="warn"
          title="The library is only available in the desktop app"
          actions={
            <button type="button" className="btn" onClick={data.reloadInstances}>
              Try again
            </button>
          }
        >
          {instances.message}
        </Banner>
      )}

      {instances.status === "ready" && list.length === 0 && (
        <div className="empty empty-big">
          <LibraryIcon />
          <h2>Your library is empty</h2>
          <p className="muted">
            Nothing is installed yet. Pick a Minecraft version on the Versions page; Vanilla and Fabric both install in a
            few minutes and appear here as their own instance.
          </p>
          <Button variant="primary" onClick={() => onNavigate("versions")}>
            Browse versions
          </Button>
        </div>
      )}

      {list.length > 0 && shown.length === 0 && (
        <div className="empty">
          <SearchIcon />
          <h2>No instance matches</h2>
          <p className="muted">Try another name, or clear the loader filter.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setText("");
              setFilter("all");
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {shown.length > 0 && (
        <div className="instance-grid library-grid">
          {shown.map((instance) => {
            const selected = selection.instance?.id === instance.id;
            return (
              <InstanceCard
                key={instance.id}
                instance={instance}
                selected={selected}
                onSelect={() => selection.selectInstance(instance)}
                onLaunch={() => launch(instance)}
                onMods={() => {
                  selection.selectInstance(instance);
                  onNavigate("mods");
                }}
                onSettings={() => setEditing(instance.id)}
                onFolder={() => openFolder(instance)}
                launchDisabled={running || installing || !game.status?.installed}
                launchTitle={
                  !game.status?.installed
                    ? "Game files are being checked…"
                    : running
                      ? "Minecraft is already running."
                      : installing
                        ? "A download is running."
                        : "Start this instance"
                }
              />
            );
          })}
        </div>
      )}

      {list.length > 0 && (
        <p className="muted small library-foot">
          Play starts the selected instance with its own Java, memory and folder. Duplicate, repair and delete live in each
          instance's settings.
        </p>
      )}

      {editingInstance && (
        <InstanceEditor
          instance={editingInstance}
          data={data}
          onClose={() => setEditing(null)}
          onChanged={() => data.reloadInstances()}
        />
      )}
    </div>
  );
}
