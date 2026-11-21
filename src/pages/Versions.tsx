import { useEffect, useMemo, useState } from "react";
import type { InstanceSummary } from "../api/types";
import { CloseIcon, CubeIcon, PlayArrowIcon, SearchIcon } from "../components/Icons";
import { PlayPanel } from "../components/PlayPanel";
import { VersionCard } from "../components/VersionCard";
import { VersionSelector } from "../components/VersionSelector";
import type { PageId } from "../components/Navigation";
import { Badge, Banner, Card, Skeleton } from "../components/ui";
import { usernameError } from "../core/game";
import type { LoaderId } from "../core/game";
import type { AppData } from "../hooks/useAppData";
import { loaderLabel, loaderOf, useInstances } from "../hooks/useInstances";
import { usePlayAs } from "../hooks/usePlayAs";

function instanceName(i: InstanceSummary): string {
  return `Minecraft ${i.minecraft}`;
}

/** "Add a version" opens the same catalogue the launcher always used, without leaving the library. */
function AddVersionDialog({ data, onClose }: { data: AppData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal add-version-modal" role="dialog" aria-modal="true" aria-label="Add a version">
        <header className="add-version-head">
          <div>
            <h2 className="modal-title">Add a version</h2>
            <p className="muted small">
              Pick any Minecraft release or snapshot. Versions already on this PC are marked; Play downloads what is
              missing.
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close add version" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <VersionSelector data={data} onPicked={onClose} />
      </div>
    </div>
  );
}

/** Every installed version as a card, with search, a loader filter and Add Version in one toolbar. */
function Installations({
  data,
  onNavigate,
  onAddVersion,
}: {
  data: AppData;
  onNavigate: (page: PageId, section?: string) => void;
  onAddVersion: () => void;
}) {
  const { selection, game } = data;
  const playAs = usePlayAs();
  const list = useInstances(data);
  const [text, setText] = useState("");
  const [only, setOnly] = useState<"all" | "fabric" | "vanilla">("all");
  // A Launch click selects first; this remembers which card should start once its status is known.
  const [pending, setPending] = useState<{ version: string; loader: LoaderId } | null>(null);

  const java = data.java.status === "ready" ? data.java.data.selected : null;
  const running = game.run.phase === "running" || game.run.phase === "starting";
  const installing = game.installer.phase === "running";
  const nameProblem = playAs.mode === "offline" ? usernameError(playAs.name) : null;
  const canLaunch = java !== null && !nameProblem && !running && !installing;

  const shown = useMemo(() => {
    if (list.state.status !== "ready") return [];
    return list.state.data.filter((i) => {
      if (only !== "all" && loaderOf(i) !== only) return false;
      return i.minecraft.toLowerCase().includes(text.trim().toLowerCase());
    });
  }, [list.state, text, only]);

  const pick = (i: InstanceSummary, page: PageId | null) => {
    selection.setVersion(i.minecraft);
    selection.setLoader(loaderOf(i));
    if (page) onNavigate(page);
  };

  // The launch of a card runs here, once the game status belongs to the chosen version.
  useEffect(() => {
    if (!pending) return;
    if (selection.version !== pending.version || selection.loader !== pending.loader) return;
    if (!game.status) return;
    setPending(null);
    if (!java || !game.status.installed) return;
    game.play(java.path, playAs.mode, playAs.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, selection.version, selection.loader, game.status, java, playAs.mode, playAs.name]);

  const launch = (i: InstanceSummary) => {
    setPending({ version: i.minecraft, loader: loaderOf(i) });
    pick(i, null);
  };

  return (
    <section className="play-installations version-library" id="installations" aria-labelledby="library-title">
      <div className="library-head">
        <div>
          <h2 id="library-title" className="library-title">
            Your library
          </h2>
          <p className="muted small">
            {list.state.status === "ready"
              ? `${list.state.data.length} installed ${list.state.data.length === 1 ? "version" : "versions"} on this PC`
              : "Versions installed on this PC"}
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-small add-version-btn" onClick={onAddVersion}>
          <span className="add-version-plus" aria-hidden="true">
            +
          </span>
          Add Version
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <SearchIcon />
          <input
            type="text"
            aria-label="Search installed versions"
            placeholder="Search versions…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="seg" role="radiogroup" aria-label="Show loader">
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
              aria-label={`Show ${label.toLowerCase()} versions`}
              aria-checked={only === id}
              className={only === id ? "seg-on" : ""}
              onClick={() => setOnly(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
          <p className="muted">
            Press “Add Version” to pick a Minecraft version and loader. It downloads, then shows up here as a card.
          </p>
          <button type="button" className="btn btn-primary" onClick={onAddVersion}>
            Add your first version
          </button>
        </div>
      )}
      {list.state.status === "ready" && list.state.data.length > 0 && shown.length === 0 && (
        <p className="muted">No installed version matches.</p>
      )}
      {shown.length > 0 && (
        <ul className="vgrid">
          {shown.map((i) => {
            const l = loaderOf(i);
            const current = selection.version === i.minecraft && selection.loader === l;
            return (
              <li key={`${i.minecraft}-${l}`}>
                <VersionCard
                  version={i.minecraft}
                  loader={loaderLabel(l)}
                  line={l === "fabric" ? `Loader ${i.loader} · ${i.modCount} ${i.modCount === 1 ? "mod" : "mods"}` : "Vanilla"}
                  selected={current}
                  badge={current ? <Badge tone="info">Selected</Badge> : undefined}
                  onSelect={() => pick(i, null)}
                  selectLabel={`Select ${instanceName(i)} ${l === "fabric" ? "with Fabric" : "vanilla"}`}
                  actions={
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        aria-label={`Launch ${instanceName(i)} ${l === "fabric" ? "with Fabric" : "vanilla"}`}
                        disabled={!canLaunch}
                        title={canLaunch ? "Start Minecraft with this version" : launchHint({ java: java !== null, nameProblem, running, installing })}
                        onClick={() => launch(i)}
                      >
                        <PlayArrowIcon /> Launch
                      </button>
                      {l === "fabric" && (
                        <button
                          type="button"
                          className="btn btn-small"
                          aria-label={`Mods for ${instanceName(i)}`}
                          onClick={() => pick(i, "mods")}
                        >
                          Mods
                        </button>
                      )}
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function launchHint(state: { java: boolean; nameProblem: string | null; running: boolean; installing: boolean }): string {
  if (state.running) return "Minecraft is already starting or running.";
  if (state.installing) return "Game files are still downloading.";
  if (!state.java) return "Java is needed first. Set up and play installs it.";
  return state.nameProblem ?? "Fix the offline name before playing.";
}

/** The library on the left; the launch panel on the right, with nothing repeated between them. */
export function VersionsPage({
  data,
  onNavigate,
  onOpenAccount,
}: {
  data: AppData;
  onNavigate: (page: PageId, section?: string) => void;
  onOpenAccount: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <div className="page versions-page">
      <header className="page-head">
        <p className="eyebrow">Library</p>
        <h1>Versions</h1>
        <p>Every Minecraft version on this PC, one card per version and loader. Pick one, then press Play.</p>
      </header>
      <div className="versions-layout">
        <Installations data={data} onNavigate={onNavigate} onAddVersion={() => setAddOpen(true)} />
        <aside className="versions-side">
          <Card className="play-launch" id="launch" title="Launch" icon={<CubeIcon />} description="Account, selected version and the Play button.">
            <PlayPanel data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} variant="full" onChangeVersion={() => setAddOpen(true)} />
          </Card>
        </aside>
      </div>
      {addOpen && <AddVersionDialog data={data} onClose={() => setAddOpen(false)} />}
    </div>
  );
}
