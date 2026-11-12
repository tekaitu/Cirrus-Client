import { api } from "../api/client";
import type { InstanceSummary } from "../api/types";
import type { PageId } from "../components/Sidebar";
import { Badge, Banner, Skeleton } from "../components/ui";
import type { LoaderId } from "../core/game";
import type { AppData } from "../hooks/useAppData";
import { useResource } from "../hooks/useResource";

function instanceName(i: InstanceSummary): string {
  return `Minecraft ${i.minecraft}`;
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
        <p className="muted">Every Minecraft setup installed on this PC. Each one keeps its own mods.</p>
      </header>

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
