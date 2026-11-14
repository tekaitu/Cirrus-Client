import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { InstalledMod, ModHit, ModProvider } from "../api/types";
import { DownloadIcon, ModsIcon, SearchIcon, SparkIcon, TrashIcon } from "../components/Icons";
import { Banner, Card, Spinner } from "../components/ui";
import { MOD_PACKS, formatDownloads, formatFileSize, type ModPack } from "../core/mods";
import type { AppData } from "../hooks/useAppData";

const PROVIDERS: Array<{ id: ModProvider; label: string }> = [
  { id: "modrinth", label: "Modrinth" },
  { id: "curseforge", label: "CurseForge" },
];

export function ModsPage({ data }: { data: AppData }) {
  const { selection, game } = data;
  const version = selection.version;
  const profileId = selection.profile?.id;
  const [provider, setProvider] = useState<ModProvider>("modrinth");
  const [curseforge, setCurseforge] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ModHit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<InstalledMod[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [modFilter, setModFilter] = useState("");
  const [filter, setFilter] = useState<"all" | "on" | "off">("all");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fabricReady = selection.loader === "fabric" && game.status?.installed === true;

  useEffect(() => {
    void Promise.resolve()
      .then(() => api.curseforgeAvailable())
      .then((ok) => mounted.current && setCurseforge(ok === true))
      .catch(() => {});
  }, []);

  const refreshInstalled = useCallback(async () => {
    try {
      const list = await (profileId ? api.listMods(version, profileId) : api.listMods(version));
      if (mounted.current) setInstalled(list);
    } catch {
      if (mounted.current) setInstalled([]);
    }
  }, [version, profileId]);

  const search = useCallback(
    async (text: string, offset: number) => {
      setSearching(true);
      setSearchError(null);
      try {
        const result = await api.searchMods(provider, text, version, offset);
        if (!mounted.current) return;
        setHits((prev) => (offset > 0 && prev ? [...prev, ...result.hits] : result.hits));
        setTotal(result.total);
      } catch (e) {
        if (mounted.current) {
          setSearchError(errorMessage(e));
          if (offset === 0) setHits([]);
        }
      } finally {
        if (mounted.current) setSearching(false);
      }
    },
    [provider, version],
  );

  // Popular mods for the chosen version and site.
  useEffect(() => {
    setDone([]);
    setNotice(null);
    void search(query, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, version]);

  useEffect(() => {
    setDone([]);
  }, [profileId]);

  useEffect(() => {
    if (fabricReady) void refreshInstalled();
    else setInstalled([]);
  }, [fabricReady, refreshInstalled]);

  const install = async (p: ModProvider, id: string, label: string) => {
    setBusy(id);
    setNotice(null);
    try {
      const report = await (profileId ? api.installMod(p, id, version, profileId) : api.installMod(p, id, version));
      const added = report.installed.length;
      setNotice({
        tone: "good",
        text:
          added > 0
            ? `${label} installed (${added} file${added === 1 ? "" : "s"}, including anything it requires).`
            : `${label} was already installed.`,
      });
      setDone((d) => [...d, `${p}:${id}`]);
      await refreshInstalled();
    } catch (e) {
      setNotice({ tone: "bad", text: `${label} could not be installed: ${errorMessage(e)}` });
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const installPack = async (pack: ModPack) => {
    setBusy(`pack:${pack.id}`);
    setNotice(null);
    const failed: string[] = [];
    const skipped: string[] = [];
    for (const mod of pack.mods) {
      try {
        await (profileId ? api.installMod("modrinth", mod.slug, version, profileId) : api.installMod("modrinth", mod.slug, version));
      } catch (e) {
        const text = errorMessage(e);
        if (text.startsWith("No version of this mod is available")) skipped.push(mod.name);
        else failed.push(`${mod.name} (${text})`);
      }
    }
    if (!mounted.current) return;
    const skippedText = skipped.length ? ` Not available for Minecraft ${version} yet: ${skipped.join(", ")}.` : "";
    setNotice(
      failed.length === 0
        ? { tone: "good", text: `${pack.title} installed. Start the game to use it.${skippedText}` }
        : { tone: "bad", text: `Some mods could not be installed: ${failed.join("; ")}.${skippedText}` },
    );
    setBusy(null);
    await refreshInstalled();
  };

  const remove = async (fileName: string) => {
    setBusy(fileName);
    try {
      await (profileId ? api.removeMod(version, fileName, profileId) : api.removeMod(version, fileName));
      await refreshInstalled();
    } catch (e) {
      setNotice({ tone: "bad", text: errorMessage(e) });
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const toggle = async (m: InstalledMod) => {
    setBusy(m.fileName);
    try {
      const on = m.enabled === false;
      await (profileId
        ? api.setModEnabled(version, m.fileName, on, profileId)
        : api.setModEnabled(version, m.fileName, on));
      await refreshInstalled();
    } catch (e) {
      setNotice({ tone: "bad", text: errorMessage(e) });
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const shownMods = installed.filter((m) => {
    if (filter !== "all" && (m.enabled === false) !== (filter === "off")) return false;
    return m.fileName.toLowerCase().includes(modFilter.trim().toLowerCase());
  });
  const offCount = installed.filter((m) => m.enabled === false).length;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void search(query, 0);
  };

  return (
    <div className="page mods-page">
      <header className="page-head">
        <h1>Mods</h1>
        <p className="muted">
          Fabric mods for Minecraft {version}, from Modrinth and CurseForge.{" "}
          {selection.profile
            ? `They go into your “${selection.profile.name}” profile.`
            : "Each Minecraft version keeps its own mods."}
        </p>
      </header>

      {selection.loader !== "fabric" && (
        <Banner
          tone="warn"
          title="Mods need Fabric"
          actions={
            <button type="button" className="btn btn-pill" onClick={() => selection.setLoader("fabric")}>
              Switch to Fabric
            </button>
          }
        >
          Vanilla Minecraft cannot load mods. Switch the loader to Fabric to add mods.
        </Banner>
      )}
      {selection.loader === "fabric" && game.status && !game.status.installed && (
        <Banner tone="info" title={`Install Minecraft ${version} with Fabric first`}>
          Press <strong>Set up &amp; play</strong> on the Home or Play page. Once it finishes, you can add mods here.
        </Banner>
      )}

      {notice && (
        <Banner tone={notice.tone} title={notice.tone === "good" ? "Done" : "Something went wrong"}>
          {notice.text}
        </Banner>
      )}

      <div className="mods-layout">
        <div className="mods-main">
        <Card title="Find mods">
          <div className="seg" role="tablist" aria-label="Mod site">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={provider === p.id}
                className={provider === p.id ? "seg-on" : ""}
                onClick={() => setProvider(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {provider === "curseforge" && !curseforge && (
            <p className="muted small hero-note">
              CurseForge search needs an API key from CurseForge, which this build does not include. Modrinth works
              without one.
            </p>
          )}
          <form className="search-row" onSubmit={onSubmit} role="search">
            <input
              type="text"
              aria-label="Search mods"
              placeholder="Search mods…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-pill" disabled={searching}>
              <SearchIcon />
              Search
            </button>
          </form>

          {searchError && <p className="error-text" role="alert">{searchError}</p>}
          {searching && hits === null && <Spinner label="Searching" />}
          {hits && hits.length === 0 && !searching && !searchError && (
            <p className="muted">No Fabric mods found for Minecraft {version}.</p>
          )}
          {hits && hits.length > 0 && (
            <ul className="mod-list">
              {hits.map((h) => {
                const key = `${h.provider}:${h.id}`;
                const isDone = done.includes(key);
                return (
                  <li key={key} className="mod-card">
                    {h.iconUrl ? (
                      <img className="mod-icon" src={h.iconUrl} alt="" loading="lazy" width={56} height={56} referrerPolicy="no-referrer" />
                    ) : (
                      <span className="mod-icon mod-icon-empty" aria-hidden="true">
                        {h.title.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="mod-body">
                      <h3>{h.title}</h3>
                      <p className="muted small">{h.description}</p>
                      <p className="muted small">
                        {h.author && <>by {h.author} · </>}
                        {formatDownloads(h.downloads)} downloads
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-pill"
                      disabled={!fabricReady || busy !== null || isDone}
                      aria-label={`Install ${h.title}`}
                      onClick={() => install(h.provider, h.id, h.title)}
                    >
                      {!isDone && busy !== h.id && <DownloadIcon />}
                      {isDone ? "Installed" : busy === h.id ? "Installing…" : "Install"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {hits && hits.length < total && !searching && (
            <button type="button" className="btn btn-pill" onClick={() => search(query, hits.length)}>
              Show more
            </button>
          )}
        </Card>
        </div>
        <aside className="mods-side" aria-label="Your mods">
        {MOD_PACKS.map((pack) => (
          <Card
            key={pack.id}
            title={pack.title}
            tone={pack.id === "hud" ? "cyan" : undefined}
            description={pack.description}
            action={
              <button
                type="button"
                className="btn btn-primary btn-pill"
                disabled={!fabricReady || busy !== null}
                onClick={() => void installPack(pack)}
              >
                <SparkIcon />
                {busy === `pack:${pack.id}` ? "Installing…" : `Install ${pack.id === "hud" ? "HUD pack" : "performance pack"}`}
              </button>
            }
          >
            <ul className="pack-list">
              {pack.mods.map((m) => (
                <li key={m.slug}>
                  <strong>{m.name}</strong> <span className="muted small">{m.why}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}

        <Card title="Installed mods" description={selection.profile ? `In your “${selection.profile.name}” profile` : `In the Minecraft ${version} Fabric profile`}>
          {installed.length === 0 ? (
            <div className="empty empty-big">
              <ModsIcon />
              <p>
                <strong>{fabricReady ? "No mods installed yet" : "Nothing to show yet"}</strong>
              </p>
              <p className="muted small">
                {fabricReady
                  ? "Install a pack or search for a mod. Installed mods appear here, where you can switch them off or remove them."
                  : "Install Minecraft with Fabric first. Then your mods show up here."}
              </p>
            </div>
          ) : (
            <>
              <div className="mod-filter">
                <input
                  type="text"
                  aria-label="Filter installed mods"
                  placeholder="Filter installed mods…"
                  value={modFilter}
                  onChange={(e) => setModFilter(e.target.value)}
                />
                <div className="seg" role="radiogroup" aria-label="Show mods">
                  {(
                    [
                      ["all", "All"],
                      ["on", "On"],
                      ["off", `Off${offCount ? ` (${offCount})` : ""}`],
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
              </div>
              {shownMods.length === 0 && <p className="muted small">No installed mod matches.</p>}
              <ul className="installed-list">
                {shownMods.map((m) => {
                  const off = m.enabled === false;
                  const label = m.fileName.replace(/\.disabled$/i, "");
                  return (
                    <li key={m.fileName} className={off ? "mod-off" : ""}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!off}
                        aria-label={`${off ? "Enable" : "Disable"} ${label}`}
                        className="toggle"
                        disabled={busy !== null}
                        onClick={() => void toggle(m)}
                      />
                      <span className="path">{label}</span>
                      <span className="muted small">{off ? "Off" : formatFileSize(m.size)}</span>
                      <button
                        type="button"
                        className="btn btn-pill btn-quiet"
                        disabled={busy !== null}
                        aria-label={`Remove ${m.fileName}`}
                        onClick={() => remove(m.fileName)}
                      >
                        <TrashIcon />
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="muted small">Switched-off mods stay installed but are not loaded the next time the game starts.</p>
            </>
          )}
        </Card>
        </aside>
      </div>
    </div>
  );
}
