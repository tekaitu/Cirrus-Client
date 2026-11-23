import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { VersionEntry } from "../api/types";
import { InstallDialog } from "../components/InstallDialog";
import type { PageId } from "../components/Navigation";
import { Badge, Banner, Skeleton } from "../components/ui";
import { ChevronDownIcon, CubeIcon, LibraryIcon, PlayArrowIcon, SearchIcon } from "../components/Icons";
import { FAMILIES, familyOf, groupByFamily, type FamilyGroup } from "../core/instances";
import type { AppData } from "../hooks/useAppData";

type Sort = "newest" | "oldest";
type Filter = "all" | "available" | "installed";

/**
 * Versions: what can be installed. Installed games are the Library's job, so the
 * two pages never fight over the same card. Releases are grouped into families,
 * each with its own artwork, and every family expands into the individual
 * releases Mojang lists.
 */
export function VersionsPage({
  data,
  onNavigate,
}: {
  data: AppData;
  onNavigate: (page: PageId) => void;
}) {
  const [catalog, setCatalog] = useState<VersionEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [filter, setFilter] = useState<Filter>("all");
  const [openFamily, setOpenFamily] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  const instances = data.instances.status === "ready" ? data.instances.data : [];
  const installedVersions = useMemo(() => new Set(instances.map((i) => i.minecraft)), [instances]);

  useEffect(() => {
    let alive = true;
    void api
      .listVersionCatalog()
      .then((list) => {
        if (alive) setCatalog(list);
      })
      .catch((e) => {
        if (!alive) return;
        setError(errorMessage(e));
        // Without the desktop backend the picker still offers the versions the
        // launcher knows about, marked as releases with no date.
        setCatalog(data.selection.versions.map((id) => ({ id, kind: "release", released: null, supported: true, javaMajor: null })));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    if (!catalog) return { groups: [] as FamilyGroup[], snapshots: 0 };
    const { groups, snapshots } = groupByFamily(catalog);
    const q = text.trim().toLowerCase();
    return {
      snapshots,
      groups: groups
        .map((g) => ({
          ...g,
          versions: g.versions
            .filter((v) => {
              if (q && !`${v.id} ${g.family.title}`.toLowerCase().includes(q)) return false;
              if (filter === "available") return !installedVersions.has(v.id);
              if (filter === "installed") return installedVersions.has(v.id);
              return true;
            })
            .sort((a, b) => (sort === "newest" ? compareRelease(b.id, a.id) : compareRelease(a.id, b.id))),
        }))
        .filter((g) => g.versions.length > 0),
    };
  }, [catalog, text, filter, sort, installedVersions]);

  // When a search leaves one family, it opens by itself so the result is visible.
  const visibleAuthentic = grouped.groups.length === 1 ? grouped.groups[0].family.key : openFamily;

  return (
    <div className="page versions-page">
      <header className="page-head page-head-row">
        <div>
          <p className="eyebrow">Available</p>
          <h1>Versions</h1>
          <p>Choose a Minecraft release to install. Each one becomes its own instance in your Library.</p>
        </div>
        <button type="button" className="btn" onClick={() => onNavigate("library")}>
          <LibraryIcon /> Your Library
        </button>
      </header>

      <div className="toolbar">
        <div className="search-box">
          <SearchIcon />
          <input
            type="search"
            aria-label="Search Minecraft versions"
            placeholder="Search versions, e.g. 1.20.1…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="seg" role="radiogroup" aria-label="Show versions">
          {(
            [
              ["all", "All"],
              ["available", "Not installed"],
              ["installed", "Installed"],
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
          <span className="muted small">Order</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Order versions">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {error && (
        <Banner tone="warn" title="Mojang's version list could not be read">
          {error} Only the versions built into this launcher are shown.
        </Banner>
      )}

      {!catalog && <Skeleton label="Loading Minecraft versions" lines={4} />}

      {catalog && grouped.groups.length === 0 && (
        <div className="empty empty-big">
          <CubeIcon />
          <h2>No versions match</h2>
          <p className="muted">Try another search, or switch the filter back to All.</p>
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

      {grouped.groups.length > 0 && (
        <p className="muted small versions-note">
          {FAMILIES.length} families · {grouped.snapshots > 0 ? `${grouped.snapshots} snapshots are listed by Mojang but cannot be installed by this build.` : "Releases installed through this build are checked against Mojang's hashes."}
        </p>
      )}

      <div className="families">
        {grouped.groups.map(({ family, versions }) => {
          const open = visibleAuthentic === family.key;
          const installed = versions.filter((v) => installedVersions.has(v.id)).length;
          return (
            <section key={family.key} className={`family ${open ? "is-open" : ""}`} aria-labelledby={`family-${family.key}`}>
              <button
                type="button"
                className="family-head"
                aria-expanded={open}
                aria-controls={`family-body-${family.key}`}
                onClick={() => setOpenFamily(open ? null : family.key)}
              >
                <img className="family-art" src={family.art} alt="" aria-hidden="true" loading="lazy" />
                <span className="family-shade" aria-hidden="true" />
                <span className="family-text">
                  <span className="family-kicker">{versions.length} {versions.length === 1 ? "release" : "releases"}</span>
                  <span className="family-title" id={`family-${family.key}`}>
                    {family.title}
                  </span>
                  <span className="family-blurb">{family.blurb}</span>
                </span>
                {installed > 0 && <span className="family-installed">{installed} installed</span>}
                <span className="family-chevron" aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </button>

              {open && (
                <div className="family-body" id={`family-body-${family.key}`}>
                  <ul className="release-list">
                    {versions.map((version) => {
                      const isInstalled = installedVersions.has(version.id);
                      return (
                        <li key={version.id} className="release-row">
                          <span className="release-name">Minecraft {version.id}</span>
                          <span className="release-meta muted small">
                            {version.released ? new Date(version.released).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Release"}
                            {version.javaMajor ? ` · Java ${version.javaMajor}` : ""}
                          </span>
                          {isInstalled ? (
                            <span className="release-actions">
                              <Badge tone="good">In your Library</Badge>
                              <button type="button" className="btn btn-small" onClick={() => onNavigate("library")}>
                                <PlayArrowIcon /> Play
                              </button>
                            </span>
                          ) : (
                            <span className="release-actions">
                              <button
                                type="button"
                                className="btn btn-primary btn-small"
                                onClick={() => setInstalling(version.id)}
                              >
                                Install
                              </button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {installing && (
        <InstallDialog
          version={installing}
          data={data}
          onClose={() => setInstalling(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

/** Newest-first ordering for release ids ("1.21.11" > "1.21.4" > "1.8.9"). */
function compareRelease(a: string, b: string): number {
  const pa = a.split(".").map((p) => Number(p) || 0);
  const pb = b.split(".").map((p) => Number(p) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

// `familyOf` is exported for the Home page's shortcuts and tests.
export { familyOf };
