import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, errorMessage } from "../api/client";
import type { InstalledPack, ModProvider, PackDetails, PackHit, PackSearchResult } from "../api/types";
import { notify } from "../core/notifications";
import { formatDownloads, formatFileSize } from "../core/mods";
import {
  PACK_PAGE_SIZE,
  PACK_RESOLUTIONS,
  PACK_SORTS,
  activeSummary,
  packCache,
  packDetailsKey,
  packMetaLine,
  packSearchKey,
  packSiteName,
  resolutionText,
} from "../core/packs";
import { DownloadIcon, ExternalIcon, RefreshArrowIcon, SearchIcon, TrashIcon } from "./Icons";
import { Pagination } from "./Pagination";
import { Banner, Skeleton, Spinner } from "./ui";

const PROVIDERS: Array<{ id: ModProvider; label: string }> = [
  { id: "modrinth", label: "Modrinth" },
  { id: "curseforge", label: "CurseForge" },
];

interface OpenPack {
  hit: PackHit;
  details: PackDetails | null;
  loading: boolean;
  error: string | null;
}

/**
 * Texture packs, as a second shelf of the same library: the same search line,
 * the same site switch and the same card language as mods, but with big
 * pictures, a details view and a separate list of installed packs.
 */
export function PackBrowser({
  version,
  profileId,
  gameInstalled,
}: {
  version: string;
  profileId?: string;
  /** Resource packs need an installed game folder to write into. */
  gameInstalled: boolean;
}) {
  const [tab, setTab] = useState<"browse" | "installed">("browse");
  const [provider, setProvider] = useState<ModProvider>("modrinth");
  const [curseforge, setCurseforge] = useState(false);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [resolution, setResolution] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);
  const [hits, setHits] = useState<PackHit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenPack | null>(null);
  const [preview, setPreview] = useState(0);
  const [installing, setInstalling] = useState(false);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [installed, setInstalled] = useState<InstalledPack[] | null>(null);
  const [installedError, setInstalledError] = useState<string | null>(null);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    void Promise.resolve()
      .then(() => api.curseforgeAvailable())
      .then((ok) => mounted.current && setCurseforge(ok === true))
      .catch(() => {});
  }, []);

  const search = useCallback(
    async (text: string, pageNo: number, options?: { provider?: ModProvider; resolution?: string; sort?: string }) => {
      const useProvider = options?.provider ?? provider;
      const useResolution = options?.resolution ?? resolution;
      const useSort = options?.sort ?? sort;
      const offset = (pageNo - 1) * PACK_PAGE_SIZE;
      const key = packSearchKey({
        provider: useProvider,
        query: text,
        version,
        resolution: useResolution,
        sort: useSort,
        offset,
      });
      const cached = packCache.get(key) as PackSearchResult | null;
      if (cached) {
        setHits(cached.hits);
        setTotal(cached.total);
        setPage(pageNo);
        setError(null);
        setSearching(false);
        return;
      }
      setSearching(true);
      setError(null);
      try {
        const result = await api.searchResourcePacks(useProvider, text, version, offset, useResolution || undefined, useSort || undefined);
        if (!mounted.current) return;
        packCache.set(key, result);
        setHits(result.hits);
        setTotal(result.total);
        setPage(pageNo);
      } catch (e) {
        if (mounted.current) {
          setError(errorMessage(e));
          setHits([]);
        }
      } finally {
        if (mounted.current) setSearching(false);
      }
    },
    [provider, resolution, sort, version],
  );

  // Popular packs for the chosen version and site.
  useEffect(() => {
    void search(submitted, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, version, resolution, sort]);

  const refreshInstalled = useCallback(async () => {
    try {
      const list = await (profileId ? api.listResourcePacks(version, profileId) : api.listResourcePacks(version));
      if (mounted.current) {
        setInstalled(list);
        setInstalledError(null);
      }
    } catch (e) {
      if (mounted.current) {
        setInstalled([]);
        setInstalledError(errorMessage(e));
      }
    }
  }, [version, profileId]);

  useEffect(() => {
    if (tab === "installed") void refreshInstalled();
  }, [tab, refreshInstalled]);

  useEffect(() => {
    setInstalled(null);
    setConfirmRemove(null);
    setOpen(null);
  }, [version, profileId]);

  const openPack = async (hit: PackHit) => {
    setOpen({ hit, details: null, loading: true, error: null });
    setPreview(0);
    setNotice(null);
    const key = packDetailsKey(hit.provider, hit.id, version);
    const cached = packCache.get(key) as PackDetails | null;
    if (cached) {
      setOpen({ hit, details: cached, loading: false, error: null });
      return;
    }
    try {
      const details = await api.resourcePackDetails(hit.provider, hit.id, version);
      if (!mounted.current) return;
      packCache.set(key, details);
      setOpen({ hit, details, loading: false, error: null });
    } catch (e) {
      if (mounted.current) setOpen({ hit, details: null, loading: false, error: errorMessage(e) });
    }
  };

  const installOpen = async () => {
    if (!open) return;
    setInstalling(true);
    setNotice(null);
    try {
      const pack = await api.installResourcePack(open.hit.provider, open.hit.id, version, profileId);
      if (!mounted.current) return;
      setNotice({
        tone: "good",
        text: `${pack.fileName} is installed. Turn it on in Installed — Cirrus never switches a pack on by itself.`,
      });
      notify({ title: "Texture pack installed", body: pack.fileName, tone: "good" });
      setInstalled((current) => (current ? [...current, pack] : current));
      if (tab === "installed") await refreshInstalled();
    } catch (e) {
      if (mounted.current) setNotice({ tone: "bad", text: errorMessage(e) });
    } finally {
      if (mounted.current) setInstalling(false);
    }
  };

  const toggle = async (pack: InstalledPack) => {
    setBusyFile(pack.fileName);
    setNotice(null);
    try {
      await api.setResourcePackEnabled(version, pack.fileName, !pack.enabled, profileId);
      await refreshInstalled();
    } catch (e) {
      setNotice({ tone: "bad", text: errorMessage(e) });
    } finally {
      if (mounted.current) setBusyFile(null);
    }
  };

  const remove = async (pack: InstalledPack) => {
    if (confirmRemove !== pack.fileName) {
      setConfirmRemove(pack.fileName);
      return;
    }
    setConfirmRemove(null);
    setBusyFile(pack.fileName);
    try {
      await api.removeResourcePack(version, pack.fileName, profileId);
      await refreshInstalled();
    } catch (e) {
      setNotice({ tone: "bad", text: errorMessage(e) });
    } finally {
      if (mounted.current) setBusyFile(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = query;
    setSubmitted(text);
    void search(text, 1);
  };

  const pages = Math.max(1, Math.ceil(total / PACK_PAGE_SIZE));
  const gallery = open?.details?.gallery ?? [];
  const large = gallery[preview] ?? open?.details?.iconUrl ?? open?.hit.iconUrl ?? null;

  return (
    <div className="packs-browser">
      <div className="browse-tabs" role="tablist" aria-label="Texture packs">
        {(
          [
            ["browse", "Browse packs"],
            ["installed", `Installed${installed ? ` (${installed.length})` : ""}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "browse-tab-on" : ""}
            onClick={() => {
              setTab(id);
              setNotice(null);
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="link-inline browse-tabs-end"
          onClick={() => {
            setTab("installed");
            void refreshInstalled();
          }}
        >
          <RefreshArrowIcon /> Refresh installed
        </button>
      </div>

      {notice && (
        <Banner tone={notice.tone} title={notice.tone === "good" ? "Done" : "That did not work"}>
          {notice.text}
        </Banner>
      )}

      {tab === "browse" && !open && (
        <div className="browse packs-browser-layout">
          <aside className="browse-filters" aria-label="Pack filters">
            <div className="filter-block">
              <h2 className="filter-title">Site</h2>
              <div className="seg seg-stack" role="tablist" aria-label="Pack site">
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
            </div>
            <div className="filter-block">
              <h2 className="filter-title">Minecraft version</h2>
              <p className="chip chip-wide">{version}</p>
            </div>
            <div className="filter-block">
              <div className="filter-title-row">
                <h2 className="filter-title" id="pack-res-label">
                  Resolution
                </h2>
                {resolution && (
                  <button type="button" className="link-inline" onClick={() => setResolution("")}>
                    Clear
                  </button>
                )}
              </div>
              <div className="radio-list" role="radiogroup" aria-labelledby="pack-res-label">
                {PACK_RESOLUTIONS.map((r) => (
                  <button
                    key={r.id || "any"}
                    type="button"
                    role="radio"
                    aria-checked={resolution === r.id}
                    className={`radio-row ${resolution === r.id ? "radio-on" : ""}`}
                    onClick={() => setResolution(r.id)}
                  >
                    <span className="radio-dot" aria-hidden="true" />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="browse-main">
            {provider === "curseforge" && !curseforge && (
              <p className="muted small">
                CurseForge browsing needs an API key from CurseForge, which this build does not include. Modrinth works
                without one.
              </p>
            )}
            <div className="browse-bar">
              <form className="search-box search-grow" onSubmit={onSubmit} role="search">
                <SearchIcon />
                <input
                  type="text"
                  aria-label="Search texture packs"
                  placeholder="Search texture packs…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-small" disabled={searching}>
                  Search
                </button>
              </form>
              <label className="sort-pick">
                <span className="visually-hidden">Sort by</span>
                <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
                  {PACK_SORTS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error && (
              <div className="browse-error" role="alert">
                <p className="error-text">{error}</p>
                <button type="button" className="btn btn-small" onClick={() => void search(submitted, page)}>
                  Try again
                </button>
              </div>
            )}
            {searching && hits === null && <Skeleton lines={4} label="Looking for texture packs" />}
            {!gameInstalled && !searching && (
              <p className="muted small">
                Browsing works now; install Minecraft {version} to be able to add a pack to it.
              </p>
            )}
            {hits && hits.length === 0 && !searching && !error && (
              <div className="empty">
                <SearchIcon />
                <h2>No packs found</h2>
                <p className="muted small">
                  Nothing matches {submitted ? `“${submitted}”` : "these filters"} for Minecraft {version}
                  {resolution ? ` at ${resolution}` : ""}. Try another search or another resolution.
                </p>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    setQuery("");
                    setSubmitted("");
                    setResolution("");
                    setSort("");
                    void search("", 1, { resolution: "", sort: "" });
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            {hits && hits.length > 0 && (
              <ul className={`pack-grid ${searching ? "is-loading" : ""}`} aria-label="Texture packs">
                {hits.map((hit) => (
                  <li key={`${hit.provider}:${hit.id}`}>
                    <button type="button" className="pack-card" onClick={() => void openPack(hit)}>
                      <span className="pack-card-art">
                        {hit.iconUrl ? (
                          <img src={hit.iconUrl} alt="" loading="lazy" width={180} height={120} referrerPolicy="no-referrer" />
                        ) : (
                          <span className="pack-card-fallback">{hit.title.slice(0, 1).toUpperCase()}</span>
                        )}
                        {hit.resolution && <span className="pack-card-res">{hit.resolution}</span>}
                      </span>
                      <span className="pack-card-body">
                        <span className="pack-card-title">{hit.title}</span>
                        <span className="pack-card-by muted small">{hit.author ? `by ${hit.author}` : "\u00a0"}</span>
                        <span className="pack-card-desc">{hit.description}</span>
                        <span className="pack-card-foot muted small">
                          <DownloadIcon />
                          {formatDownloads(hit.downloads)}
                          <span className="pack-card-site"> · {packSiteName(hit.provider)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={page} pages={pages} onPage={(n) => void search(submitted, n)} />
          </div>
        </div>
      )}

      {tab === "browse" && open && (
        <article className="pack-detail" aria-label={`${open.hit.title} details`}>
          <div className="pack-detail-back">
            <button
              type="button"
              className="link-inline"
              onClick={() => {
                setOpen(null);
                setNotice(null);
              }}
            >
              ← Back to texture packs
            </button>
            <span className="muted small">
              From {packSiteName(open.hit.provider)} · {open.hit.pageUrl ?? packSiteName(open.hit.provider)}
            </span>
          </div>

          {open.loading && <Skeleton lines={5} label="Loading pack details" />}
          {open.error && (
            <Banner tone="bad" title="This pack could not be loaded">
              {open.error}
            </Banner>
          )}

          {open.details && (
            <div className="pack-detail-body">
              <div className="pack-detail-gallery">
                {large ? (
                  <img
                    className="pack-detail-image"
                    src={large}
                    alt={`${open.details.title} preview`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="pack-detail-empty">
                    <span>{open.details.title.slice(0, 1).toUpperCase()}</span>
                    <p className="muted small">This pack has no preview picture.</p>
                  </div>
                )}
                {gallery.length > 1 && (
                  <div className="pack-detail-thumbs">
                    {gallery.map((image, index) => (
                      <button
                        key={image}
                        type="button"
                        className={`pack-thumb ${index === preview ? "is-on" : ""}`}
                        aria-label={`Preview ${index + 1}`}
                        aria-pressed={index === preview}
                        onClick={() => setPreview(index)}
                      >
                        <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pack-detail-info">
                <h2>{open.details.title}</h2>
                <p className="muted small">
                  {open.details.author || open.hit.author ? `by ${open.details.author || open.hit.author}` : "Author not listed"}
                  {" · "}
                  {resolutionText(open.details.resolution ?? open.hit.resolution)}
                  {" · "}
                  {formatDownloads(open.details.downloads || open.hit.downloads)} downloads
                </p>
                <p className="pack-detail-desc">{open.details.description || open.hit.description}</p>

                <dl className="pack-facts">
                  <div>
                    <dt>Supported Minecraft</dt>
                    <dd>
                      {open.details.versions.length > 0 ? open.details.versions.slice(0, 8).join(", ") : "Not listed"}
                    </dd>
                  </div>
                  <div>
                    <dt>File</dt>
                    <dd>
                      {open.details.fileName
                        ? `${open.details.fileName}${open.details.fileSize ? ` · ${formatFileSize(open.details.fileSize)}` : ""}`
                        : "No file for this Minecraft version"}
                    </dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>
                      {packSiteName(open.hit.provider)}
                      {open.hit.pageUrl ? ` · ${open.hit.pageUrl}` : ""}
                    </dd>
                  </div>
                </dl>

                <div className="pack-detail-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!gameInstalled || installing || !open.details.fileName}
                    onClick={() => void installOpen()}
                  >
                    {installing ? "Installing…" : "Install pack"}
                  </button>
                  {!open.details.fileName && (
                    <span className="muted small">No build for Minecraft {version}.</span>
                  )}
                  {!gameInstalled && <span className="muted small">Install Minecraft {version} first.</span>}
                  {open.hit.pageUrl && (
                    <span className="pack-detail-attribution muted small">
                      <ExternalIcon /> {packSiteName(open.hit.provider)}
                    </span>
                  )}
                </div>

                {open.details.longDescription && (
                  <div className="pack-detail-long">
                    <h3>About this pack</h3>
                    <p>{open.details.longDescription}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </article>
      )}

      {tab === "installed" && (
        <section className="pack-installed" aria-label="Installed texture packs">
          <div className="pack-installed-head">
            <div>
              <h2>Installed packs</h2>
              <p className="muted small">
                {activeSummary(installed ?? [])} · Minecraft {version}
              </p>
            </div>
            <button type="button" className="btn btn-small" onClick={() => void refreshInstalled()}>
              <RefreshArrowIcon /> Refresh
            </button>
          </div>

          {installedError && (
            <Banner tone="warn" title="Installed packs could not be read">
              {installedError}
            </Banner>
          )}
          {installed === null && !installedError && <Skeleton lines={3} label="Loading installed texture packs" />}
          {installed && installed.length === 0 && (
            <div className="empty">
              <DownloadIcon />
              <h2>No texture packs installed</h2>
              <p className="muted small">
                Install one from Browse packs. Packs are kept apart from mods, and Cirrus only lists the ones in this
                version's resourcepacks folder.
              </p>
              <button type="button" className="btn btn-small" onClick={() => setTab("browse")}>
                Browse packs
              </button>
            </div>
          )}
          {installed && installed.length > 0 && (
            <ul className="pack-installed-list">
              {installed.map((pack) => (
                <li key={pack.fileName} className={`pack-installed-item ${pack.enabled ? "is-on" : ""}`}>
                  <span className="pack-installed-icon" aria-hidden="true">
                    {pack.icon ? <img src={pack.icon} alt="" width={36} height={36} /> : pack.fileName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="pack-installed-body">
                    <p className="pack-installed-name">{pack.fileName}</p>
                    <p className="muted small">{pack.description ?? "No description in this pack."}</p>
                    <p className="muted small">{packMetaLine(pack, formatFileSize(pack.size))}</p>
                  </div>
                  <div className="pack-installed-actions">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={pack.enabled}
                      aria-label={`${pack.enabled ? "Switch off" : "Switch on"} ${pack.fileName}`}
                      className="toggle"
                      disabled={busyFile !== null}
                      onClick={() => void toggle(pack)}
                    />
                    <button
                      type="button"
                      className={`icon-btn icon-btn-danger ${confirmRemove === pack.fileName ? "confirm" : ""}`.trim()}
                      aria-label={confirmRemove === pack.fileName ? `Confirm removing ${pack.fileName}` : `Remove ${pack.fileName}`}
                      title={confirmRemove === pack.fileName ? "Click again to remove" : "Remove"}
                      disabled={busyFile !== null}
                      onClick={() => void remove(pack)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">
            Switching a pack on changes Minecraft's own options.txt, so it applies the next time the game starts.
            Removing a pack never touches your mods.
          </p>
        </section>
      )}

      {searching && hits !== null && <Spinner label="Looking for texture packs" />}
    </div>
  );
}
