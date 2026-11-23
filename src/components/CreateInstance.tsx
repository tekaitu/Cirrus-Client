import { useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { InstanceView, VersionEntry } from "../api/types";
import { Button } from "./Button";
import {
  CheckIcon,
  CloseIcon,
  CubeIcon,
  DownloadIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
  UploadIcon,
} from "./Icons";
import { Banner, Badge } from "./ui";
import { INSTANCE_ICONS, iconLabel } from "../core/instances";
import { VersionArt } from "./VersionCard";
import { readImageFile } from "../core/instanceIcons";
import type { AppData } from "../hooks/useAppData";

type Step = "type" | "setup";
type InstanceType = "custom" | "project" | "upload" | "import";
type Loader = "vanilla" | "fabric";

const TYPES: Array<{
  id: InstanceType;
  title: string;
  blurb: string;
  icon: JSX.Element;
  available: boolean;
  why?: string;
}> = [
  {
    id: "custom",
    title: "Custom setup",
    blurb: "Start from scratch by picking a loader and game version.",
    icon: <CubeIcon />,
    available: true,
  },
  {
    id: "project",
    title: "Start from a mod or modpack",
    blurb: "Choose a project and we'll use its latest version.",
    icon: <SparkIcon />,
    available: false,
    why: "This build has no modpack installer: the Mods page installs individual mods into an instance that already exists.",
  },
  {
    id: "upload",
    title: "Upload a modpack",
    blurb: "Install a modpack from an .mrpack file on your device.",
    icon: <UploadIcon />,
    available: false,
    why: "Reading .mrpack archives and resolving their mod list is not implemented in this build, so no upload is offered rather than accepting a file that would not install.",
  },
  {
    id: "import",
    title: "Import instance",
    blurb: "Import an instance from Prism, CurseForge, or similar.",
    icon: <PackageIcon />,
    available: false,
    why: "No importer exists in this build. Instances created here are stored by the launcher itself.",
  },
];

/** A folder-safe instance id from the name, with a suffix so two names can never collide. */
function instanceId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  return `i-${slug || "instance"}-${Date.now().toString(36)}`;
}

/**
 * Create Instance: the two-step widget from the design reference.
 *
 * Step one picks how the instance is made. Step two is the real configuration -
 * picture, name, loader and Minecraft version taken from Mojang's catalogue -
 * and the Create button writes the instance record through the same backend
 * command the Library uses. Only loaders the backend can actually install are
 * offered (Vanilla and Fabric).
 */
export function CreateInstanceDialog({
  data,
  onClose,
  onCreated,
}: {
  data: AppData;
  onClose: () => void;
  onCreated: (instance: InstanceView) => void;
}) {
  const [step, setStep] = useState<Step>("type");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<InstanceType>("custom");
  const [name, setName] = useState("");
  const [loader, setLoader] = useState<Loader>("fabric");
  const [version, setVersion] = useState(data.selection.version);
  const [icon, setIcon] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [iconGrid, setIconGrid] = useState(false);
  const [catalog, setCatalog] = useState<VersionEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loaderVersion, setLoaderVersion] = useState<string | null>(null);
  const [loaderLoading, setLoaderLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void api
      .listVersionCatalog()
      .then((list) => {
        if (!alive) return;
        setCatalog(list);
        const supported = list.filter((v) => v.supported && v.kind === "release");
        if (supported.length > 0) {
          setVersion((current) => (supported.some((v) => v.id === current) ? current : supported[0].id));
        }
      })
      .catch((e) => {
        if (!alive) return;
        setCatalogError(errorMessage(e));
        setCatalog([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Fabric's own list decides which loader builds exist for the chosen version.
  useEffect(() => {
    if (loader !== "fabric") {
      setLoaderVersion(null);
      setLoaderLoading(false);
      return;
    }
    let alive = true;
    setLoaderVersion(null);
    setLoaderLoading(true);
    void api
      .fabricLoaderVersions(version)
      .then((list) => {
        if (!alive) return;
        const stable = list.filter((l) => l.stable);
        setLoaderVersion((stable[0] ?? list[0])?.version ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setLoaderVersion(null);
      })
      .finally(() => {
        if (alive) setLoaderLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loader, version]);

  const versions = useMemo(() => {
    const supported = (catalog ?? [])
      .filter((v) => v.supported && v.kind === "release")
      .map((v) => v.id);
    const list = supported.length > 0 ? supported : data.selection.versions;
    return list.slice().sort((a, b) => compare(a, b));
  }, [catalog, data.selection.versions]);

  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TYPES;
    return TYPES.filter((t) => `${t.title} ${t.blurb}`.toLowerCase().includes(q));
  }, [search]);

  const chooseType = (t: (typeof TYPES)[number]) => {
    if (!t.available) return;
    setType(t.id);
    setError(null);
    setStep("setup");
    if (!name.trim()) setName(version ? `Minecraft ${version}` : "New instance");
  };

  const pickRandom = () => {
    setPhoto(null);
    setIcon(Math.floor(Math.random() * INSTANCE_ICONS.length));
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const url = await readImageFile(file);
      setPhoto(url);
      setIconGrid(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const create = async () => {
    const clean = name.trim();
    if (!clean) {
      setError("Give the instance a name.");
      return;
    }
    if (!version) {
      setError("Choose a Minecraft version.");
      return;
    }
    setBusy(true);
    setError(null);
    const id = instanceId(clean);
    try {
      const saved = await api.saveInstance({
        id,
        minecraft: version,
        loader,
        loaderVersion: loader === "fabric" ? loaderVersion : null,
        name: clean,
        icon,
        javaPath: null,
        memoryMb: null,
        gameDir: null,
        jvmArgs: "",
        lastPlayed: 0,
        clonedFrom: null,
      });
      if (photo) {
        const { writeInstanceIcon } = await import("../core/instanceIcons");
        writeInstanceIcon(saved.id, photo);
      }
      onCreated(saved);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal create-instance" role="dialog" aria-modal="true" aria-labelledby="create-instance-title">
        <header className="create-head">
          <h2 id="create-instance-title">Create instance</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} disabled={busy}>
            <CloseIcon />
          </button>
        </header>

        {step === "type" ? (
          <div className="create-body">
            <label className="create-search">
              <span className="create-label">Already know what you want to play?</span>
              <span className="search-box">
                <SearchIcon />
                <input
                  type="search"
                  aria-label="Search mods, modpacks, and more"
                  placeholder="Search mods, modpacks, and more..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </span>
            </label>
            <p className="create-or" aria-hidden="true">
              or
            </p>
            <p className="create-label">Choose instance type</p>
            <ul className="create-types">
              {options.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`create-type ${t.available ? "" : "is-unavailable"}`}
                    aria-disabled={!t.available}
                    title={t.why}
                    onClick={() => chooseType(t)}
                  >
                    <span className="create-type-icon" aria-hidden="true">
                      {t.icon}
                    </span>
                    <span className="create-type-text">
                      <strong>
                        {t.title}
                        {!t.available && <Badge tone="neutral">Not in this build</Badge>}
                      </strong>
                      <span className="muted small">{t.blurb}</span>
                      {!t.available && t.why && <span className="create-why small">{t.why}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {options.length === 0 && <p className="muted small">Nothing matches that search.</p>}
          </div>
        ) : (
          <div className="create-body">
            <p className="eyebrow">{TYPES.find((t) => t.id === type)?.title ?? "Custom setup"}</p>
            <div className="create-image-row">
              <div className={`create-image ${photo ? "has-photo" : ""}`}>
                {photo ? (
                  <img src={photo} alt="" />
                ) : (
                  <VersionArt version={version} extra={loader} className="create-image-art" />
                )}
              </div>
              <div className="create-image-actions">
                <Button size="sm" icon={<UploadIcon />} onClick={() => fileInput.current?.click()}>
                  Upload
                </Button>
                <Button size="sm" icon={<SparkIcon />} onClick={pickRandom}>
                  Randomize
                </Button>
                <Button size="sm" icon={<PackageIcon />} onClick={() => setIconGrid((v) => !v)} aria-expanded={iconGrid}>
                  Choose icon
                </Button>
                <input
                  ref={fileInput}
                  className="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Upload an instance picture"
                  onChange={(e) => void upload(e.target.files?.[0])}
                />
              </div>
            </div>

            {iconGrid && (
              <div className="icon-picker create-icons" role="radiogroup" aria-label="Instance icon">
                {INSTANCE_ICONS.map((choice, i) => (
                  <button
                    key={choice.label}
                    type="button"
                    role="radio"
                    aria-checked={!photo && icon === i}
                    aria-label={choice.label}
                    title={choice.label}
                    className={`icon-choice ${!photo && icon === i ? "is-on" : ""}`}
                    onClick={() => {
                      setPhoto(null);
                      setIcon(i);
                    }}
                  >
                    <span aria-hidden="true">{choice.glyph}</span>
                  </button>
                ))}
                <span className="muted small create-icon-name">{photo ? "Custom picture" : iconLabel(icon)}</span>
              </div>
            )}

            <label className="field">
              <span>Name</span>
              <input
                value={name}
                maxLength={40}
                placeholder={version ? `Minecraft ${version}` : "My instance"}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <div className="field">
              <span id="create-loader-label">Loader</span>
              <div className="seg" role="radiogroup" aria-labelledby="create-loader-label">
                {(
                  [
                    ["vanilla", "Vanilla"],
                    ["fabric", "Fabric"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={loader === id}
                    className={loader === id ? "seg-on" : ""}
                    onClick={() => setLoader(id)}
                  >
                    {loader === id && <CheckIcon />}
                    {label}
                  </button>
                ))}
              </div>
              <small className="muted">
                Vanilla and Fabric are the two loaders this build can install and launch. NeoForge, Forge and Quilt are
                not supported by the launcher yet, so they are not offered.
              </small>
            </div>

            <label className="field">
              <span>Game version</span>
              <select value={version} onChange={(e) => setVersion(e.target.value)} aria-label="Game version">
                {versions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              {catalogError && <small className="muted">Mojang&apos;s list could not be read: {catalogError}</small>}
              {loader === "fabric" && (
                <small className="muted">
                  {loaderLoading
                    ? "Choosing a loader build…"
                    : loaderVersion
                      ? `Fabric Loader ${loaderVersion} will be installed.`
                      : "Fabric has no loader build listed for this version yet."}
                </small>
              )}
            </label>

            {!data.game.status?.installed && version === data.selection.version && (
              <p className="create-note muted small">
                <DownloadIcon /> Minecraft {version} is not downloaded yet. The game files download when the instance is
                launched for the first time, with progress shown on the Play panel.
              </p>
            )}

            {error && <Banner tone="bad" title="The instance was not created">{error}</Banner>}

            <footer className="create-foot">
              <Button icon={<CloseIcon />} onClick={() => setStep("type")} disabled={busy}>
                Back
              </Button>
              <Button
                variant="primary"
                icon={<PlusIcon />}
                loading={busy}
                loadingLabel="Creating…"
                onClick={() => void create()}
                disabled={!name.trim() || !version || loaderLoading || (loader === "fabric" && !loaderVersion)}
              >
                Create instance
              </Button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

function compare(a: string, b: string): number {
  const pa = a.split(".").map((p) => Number(p) || 0);
  const pb = b.split(".").map((p) => Number(p) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return y - x;
  }
  return 0;
}
