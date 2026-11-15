import { useMemo, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { InstanceSummary } from "../api/types";
import { CubeIcon, FolderIcon, JavaIcon, MemoryIcon, SearchIcon } from "../components/Icons";
import { PlayPanel } from "../components/PlayPanel";
import { VersionCard } from "../components/VersionCard";
import type { PageId } from "../components/Navigation";
import { formatMemory } from "../core/format";
import { javaTitle } from "../components/JavaStatus";
import { Badge, Banner, Card, Skeleton } from "../components/ui";
import type { AppData } from "../hooks/useAppData";
import { loaderLabel, loaderOf, useInstances } from "../hooks/useInstances";

function instanceName(i: InstanceSummary): string {
  return `Minecraft ${i.minecraft}`;
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
    <Card className="play-config" id="launch-config" title="Launch configuration" icon={<CubeIcon />} description="What the game starts with.">
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

/** Every version on this PC as a card, with a search box and a loader filter. */
function Installations({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId, section?: string) => void }) {
  const { selection } = data;
  const list = useInstances(data);
  const [text, setText] = useState("");
  const [only, setOnly] = useState<"all" | "fabric" | "vanilla">("all");

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

  return (
    <section className="play-installations" id="installations" aria-label="Installed versions">
      <div className="toolbar">
        <div className="search-box">
          <SearchIcon />
          <input type="text" aria-label="Search installed versions" placeholder="Search versions…" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="seg" role="radiogroup" aria-label="Show loader">
          {(
            [
              ["all", "All"],
              ["fabric", "Fabric"],
              ["vanilla", "Vanilla"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={only === id} className={only === id ? "seg-on" : ""} onClick={() => setOnly(id)}>
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
          <p className="muted">Press “Set up &amp; play” on the right. The version you pick is downloaded and shows up here.</p>
        </div>
      )}
      {list.state.status === "ready" && list.state.data.length > 0 && shown.length === 0 && <p className="muted">No installed version matches.</p>}
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
                  actions={
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        aria-label={`Play ${instanceName(i)} ${l === "fabric" ? "with Fabric" : "vanilla"}`}
                        onClick={() => pick(i, null)}
                      >
                        Select
                      </button>
                      {l === "fabric" && (
                        <button type="button" className="btn btn-small" aria-label={`Mods for ${instanceName(i)}`} onClick={() => pick(i, "mods")}>
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

/** Pick, install and launch versions; the launch settings sit beside them. */
export function VersionsPage({
  data,
  onNavigate,
  onOpenAccount,
}: {
  data: AppData;
  onNavigate: (page: PageId, section?: string) => void;
  onOpenAccount: () => void;
}) {
  return (
    <div className="page versions-page">
      <header className="page-head">
        <p className="eyebrow">Library</p>
        <h1>Versions</h1>
        <p>Every Minecraft version on this PC, one card per version and loader. Pick one, then press Play.</p>
      </header>
      <div className="versions-layout">
        <Installations data={data} onNavigate={onNavigate} />
        <aside className="versions-side">
          <Card className="play-launch" id="launch" title="Launch" icon={<CubeIcon />} description="Version, loader, player and the Play button.">
            <PlayPanel data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} variant="full" />
          </Card>
          <LaunchConfig data={data} onNavigate={onNavigate} />
        </aside>
      </div>
    </div>
  );
}
