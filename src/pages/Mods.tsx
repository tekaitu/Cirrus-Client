import { notify } from "../core/notifications";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { InstalledMod, ModHit, ModProvider } from "../api/types";
import { CompassIcon, DownloadIcon, GridIcon, ListIcon, ModsIcon, SearchIcon, SparkIcon, TrashIcon } from "../components/Icons";
import type { PageId } from "../components/Navigation";
import { Banner, Card, Spinner } from "../components/ui";
import { MOD_CATEGORIES, MOD_PACKS, MOD_SORTS, PAGE_SIZE, formatDownloads, formatFileSize, pageWindow, type ModPack } from "../core/mods";
import type { AppData } from "../hooks/useAppData";

const PROVIDERS: Array<{ id: ModProvider; label: string }> = [
  { id: "modrinth", label: "Modrinth" },
  { id: "curseforge", label: "CurseForge" },
];

/** The pages of results, like 1 2 3 … 40, with first/previous/next/last. */
function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <button type="button" className="pager-btn" aria-label="First page" disabled={page === 1} onClick={() => onPage(1)}>
        «
      </button>
      <button type="button" className="pager-btn" aria-label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      {pageWindow(page, pages).map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button key={n} type="button" className={`pager-btn ${n === page ? "pager-on" : ""}`} aria-label={`Page ${n}`} aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)}>
            {n}
          </button>
        ),
      )}
      <button type="button" className="pager-btn" aria-label="Next page" disabled={page === pages} onClick={() => onPage(page + 1)}>
        ›
      </button>
      <button type="button" className="pager-btn" aria-label="Last page" disabled={page === pages} onClick={() => onPage(pages)}>
        »
      </button>
    </nav>
  );
}

export function ModsPage({ data, mode, onNavigate }: { data: AppData; mode: "manage" | "browse"; onNavigate: (page: PageId) => void }) {
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
  const view = mode;
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState<string>("");
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
    async (text: string, pageNo: number, cat: string = category, order: string = sort) => {
      setSearching(true);
      setSearchError(null);
      const offset = (pageNo - 1) * PAGE_SIZE;
      const catArg = cat && provider === "modrinth" ? cat : undefined;
      try {
        const result = await (order
          ? api.searchMods(provider, text, version, offset, catArg, order)
          : catArg
            ? api.searchMods(provider, text, version, offset, catArg)
            : api.searchMods(provider, text, version, offset));
        if (!mounted.current) return;
        setHits(result.hits);
        setTotal(result.total);
        setPage(pageNo);
      } catch (e) {
        if (mounted.current) {
          setSearchError(errorMessage(e));
          setHits([]);
        }
      } finally {
        if (mounted.current) setSearching(false);
      }
    },
    [provider, version, category, sort],
  );

  // Popular mods for the chosen version and site.
  useEffect(() => {
    setDone([]);
    setNotice(null);
    if (view === "browse") void search(query, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, version, category, sort, view]);

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
      if (added > 0) notify({ title: `${label} installed`, body: `Minecraft ${version}`, tone: "good" });
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
    void search(query, 1);
  };

  const clearFilters = () => {
    setCategory("");
    setSort("");
    setQuery("");
    void search("", 1, "", "");
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const versionLabel = `${version} · ${selection.loader === "fabric" ? "Fabric" : "Vanilla"}`;

  return (
    <div className={`page mods-page ${view === "browse" ? "browse-page" : ""}`}>
      <header className="page-head page-head-row">
        <div>
          <p className="eyebrow">{view === "browse" ? "Discover" : "Library"}</p>
          <h1>{view === "browse" ? "Browse mods" : "Mod manager"}</h1>
          <p>
            {view === "browse"
              ? `Fabric mods for Minecraft ${version}, from Modrinth and CurseForge.`
              : selection.profile
                ? `Installed in your “${selection.profile.name}” profile · Minecraft ${version}`
                : `Installed for Minecraft ${version} with Fabric. Each version keeps its own mods.`}
          </p>
        </div>
        <div className="page-actions">
          {view === "browse" ? (
            <label className="for-picker">
              <span>for</span>
              <select aria-label="Minecraft version for mods" value={version} onChange={(e) => selection.setVersion(e.target.value)}>
                {selection.versions.map((v) => (
                  <option key={v} value={v}>
                    {v} · {selection.loader === "fabric" ? "Fabric" : "Vanilla"}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="chip" title="Change the version on the Versions page">
              {versionLabel}
            </span>
          )}
          {selection.profile && <span className="chip chip-accent">{selection.profile.name}</span>}
          {view === "browse" ? (
            <button type="button" className="btn" onClick={() => onNavigate("mods")}>
              Back to my mods
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => onNavigate("browse")}>
              <CompassIcon />
              Browse mods
            </button>
          )}
        </div>
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
          Press <strong>Set up &amp; play</strong> on the Home or Versions page. Once it finishes, you can add mods here.
        </Banner>
      )}

      {notice && (
        <Banner tone={notice.tone} title={notice.tone === "good" ? "Done" : "Something went wrong"}>
          {notice.text}
        </Banner>
      )}

      {view === "manage" && (
        <>
          <Card id="mod-manager" title="Installed mods" icon={<ModsIcon />}>
            {installed.length === 0 ? (
              <div className="empty empty-big">
                <ModsIcon />
                <p>
                  <strong>{fabricReady ? "No mods installed yet" : "Nothing to show yet"}</strong>
                </p>
                <p className="muted small">
                  {fabricReady
                    ? "Install a pack below or browse for a mod. Installed mods appear here, where you can switch them off or remove them."
                    : "Install Minecraft with Fabric first. Then your mods show up here."}
                </p>
                {fabricReady && (
                  <button type="button" className="btn btn-primary" onClick={() => onNavigate("browse")}>
                    Browse for mods
                  </button>
                )}
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
                  <div className="seg seg-icons" role="radiogroup" aria-label="Layout">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={layout === "grid"}
                      aria-label="Grid layout"
                      className={layout === "grid" ? "seg-on" : ""}
                      onClick={() => setLayout("grid")}
                    >
                      <GridIcon />
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={layout === "list"}
                      aria-label="List layout"
                      className={layout === "list" ? "seg-on" : ""}
                      onClick={() => setLayout("list")}
                    >
                      <ListIcon />
                    </button>
                  </div>
                </div>
                {shownMods.length === 0 && <p className="muted small">No installed mod matches.</p>}
                <ul className={`mod-grid ${layout === "list" ? "mod-grid-list" : ""}`}>
                  {shownMods.map((m) => {
                    const off = m.enabled === false;
                    const label = m.fileName.replace(/\.disabled$/i, "");
                    const title = m.name ?? label;
                    return (
                      <li key={m.fileName} className={`mod-tile ${off ? "mod-off" : ""}`}>
                        <span className="mod-tile-icon" aria-hidden="true">
                          {m.icon ? <img src={m.icon} alt="" /> : title.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="mod-tile-body">
                          <h3 title={title}>{title}</h3>
                          <p className="mod-tile-meta muted small">
                            {m.version ? `v${m.version} · ${formatFileSize(m.size)}` : formatFileSize(m.size)}
                            {m.authors && m.authors.length > 0 ? ` · ${m.authors.join(", ")}` : ""}
                          </p>
                          <p className="mod-tile-desc muted small">
                            {m.description ?? (m.name ? label : "No description in this mod.")}
                          </p>
                        </div>
                        <div className="mod-tile-actions">
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            disabled={busy !== null}
                            aria-label={`Remove ${m.fileName}`}
                            title="Remove"
                            onClick={() => remove(m.fileName)}
                          >
                            <TrashIcon />
                          </button>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={!off}
                            aria-label={`${off ? "Enable" : "Disable"} ${label}`}
                            className="toggle"
                            disabled={busy !== null}
                            onClick={() => void toggle(m)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="muted small">
                  Switched-off mods stay installed but are not loaded the next time the game starts.
                </p>
              </>
            )}
          </Card>

          <section className="packs" aria-label="Quick packs">
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
          </section>
        </>
      )}

      {view === "browse" && (
        <div className="browse mods-browser-layout">
          <aside className="browse-filters" aria-label="Filters">
            <div className="filter-block">
              <h2 className="filter-title">Site</h2>
              <div className="seg seg-stack" role="tablist" aria-label="Mod site">
                {PROVIDERS.map((p) => (
                  <button key={p.id} type="button" role="tab" aria-selected={provider === p.id} className={provider === p.id ? "seg-on" : ""} onClick={() => setProvider(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-block">
              <h2 className="filter-title">Minecraft version</h2>
              <p className="chip chip-wide">{version}</p>
            </div>
            {provider === "modrinth" && (
              <div className="filter-block filter-cats">
                <div className="filter-title-row">
                  <h2 className="filter-title" id="cat-label">
                    Categories
                  </h2>
                  <button type="button" className="link-inline" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
                <div className="radio-list" role="radiogroup" aria-labelledby="cat-label">
                  {[{ id: "", label: "All" }, ...MOD_CATEGORIES].map((c) => (
                    <button key={c.id || "all"} type="button" role="radio" aria-checked={category === c.id} className={`radio-row ${category === c.id ? "radio-on" : ""}`} onClick={() => setCategory(c.id)}>
                      <span className="radio-dot" aria-hidden="true" />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div className="browse-main">
            {provider === "curseforge" && !curseforge && (
              <p className="muted small">
                CurseForge search needs an API key from CurseForge, which this build does not include. Modrinth works without one.
              </p>
            )}
            <div className="browse-bar">
              <div className="seg seg-icons" role="radiogroup" aria-label="Result layout">
                <button type="button" role="radio" aria-checked={layout === "grid"} aria-label="Grid results" className={layout === "grid" ? "seg-on" : ""} onClick={() => setLayout("grid")}>
                  <GridIcon />
                </button>
                <button type="button" role="radio" aria-checked={layout === "list"} aria-label="List results" className={layout === "list" ? "seg-on" : ""} onClick={() => setLayout("list")}>
                  <ListIcon />
                </button>
              </div>
              <form className="search-box search-grow" onSubmit={onSubmit} role="search">
                <SearchIcon />
                <input type="text" aria-label="Search mods" placeholder="Search for content…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <button type="submit" className="btn btn-primary btn-small" disabled={searching}>
                  Search
                </button>
              </form>
              <label className="sort-pick">
                <span className="visually-hidden">Sort by</span>
                <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
                  {MOD_SORTS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {searchError && <p className="error-text" role="alert">{searchError}</p>}
            {searching && hits === null && <Spinner label="Searching" />}
            {hits && hits.length === 0 && !searching && !searchError && <p className="muted">No Fabric mods found for Minecraft {version}.</p>}
            {hits && hits.length > 0 && (
              <ul className={`mod-results ${layout === "list" ? "mod-results-list" : ""} ${searching ? "is-loading" : ""}`}>
                {hits.map((h) => {
                  const key = `${h.provider}:${h.id}`;
                  const isDone = done.includes(key);
                  return (
                    <li key={key} className="mod-card">
                      <div className="mod-card-art" aria-hidden="true">
                        {h.iconUrl && <img className="mod-card-blur" src={h.iconUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                        {h.iconUrl ? (
                          <img className="mod-icon" src={h.iconUrl} alt="" loading="lazy" width={72} height={72} referrerPolicy="no-referrer" />
                        ) : (
                          <span className="mod-icon mod-icon-empty">{h.title.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="mod-body">
                        <h3>{h.title}</h3>
                        <p className="mod-by">{h.author ? `by ${h.author}` : "\u00a0"}</p>
                        <p className="mod-desc">{h.description}</p>
                      </div>
                      <div className="mod-foot">
                        <span className="mod-downloads">
                          <DownloadIcon />
                          {formatDownloads(h.downloads)}
                          <span className="visually-hidden"> downloads</span>
                        </span>
                        <button
                          type="button"
                          className="btn btn-primary btn-small"
                          disabled={!fabricReady || busy !== null || isDone}
                          aria-label={`Install ${h.title}`}
                          onClick={() => install(h.provider, h.id, h.title)}
                        >
                          {isDone ? "Installed" : busy === h.id ? "Installing…" : "Install"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Pagination page={page} pages={pages} onPage={(n) => void search(query, n)} />
          </div>
        </div>
      )}
    </div>
  );
}
