import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { api, errorMessage } from "../api/client";
import type { SkinEntry, SkinModel } from "../api/types";
import { Button } from "../components/Button";
import {
  PlusIcon,
  RefreshArrowIcon,
  ShirtIcon,
  TrashIcon,
  UploadIcon,
  WarningIcon,
} from "../components/Icons";
import { SkinViewer } from "../components/SkinViewer";
import { SkinHead } from "../components/SkinHead";
import { Badge, Banner, Skeleton } from "../components/ui";
import { usePlayerAppearance } from "../hooks/useAppearance";
import type { AppData } from "../hooks/useAppData";
import type { PageId } from "../components/Navigation";

const APPLIED_KEY = "cirrus.appliedSkin";
const PREVIOUS_KEY = "cirrus.previousSkin";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function remember(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* only used to mark which skin is in use */
  }
}

const MODEL_LABEL: Record<SkinModel, string> = { classic: "Classic", slim: "Slim" };

/** Reads a chosen file as base64 (without the "data:" prefix). */
function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.onload = () => {
      const text = String(reader.result ?? "");
      resolve(text.slice(text.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

function sourceLabel(source: string): string {
  if (source.startsWith("player:")) return `Copied from ${source.slice(7)}`;
  if (source === "url") return "From a link";
  return "From a file";
}

/**
 * The Character Studio: the signed-in account's real Minecraft character in the
 * middle, its own skin, arm model and equipped cape on screen, and the ways to
 * change that skin through the account. Everything the figure shows is the
 * appearance Mojang returns for this account; the library only holds skins the
 * player added or uploaded themselves.
 */
export function SkinsPage({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId) => void }) {
  const [skins, setSkins] = useState<SkinEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [input, setInput] = useState("");
  const [newModel, setNewModel] = useState<SkinModel>("classic");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<string | null>(() => read(APPLIED_KEY));
  const [previous, setPrevious] = useState<string | null>(() => read(PREVIOUS_KEY));
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [preview, setPreview] = useState<"account" | "library">("account");
  const fileRef = useRef<HTMLInputElement>(null);

  const account = data.account.state;
  const player = account.phase === "signedIn" ? account.profile : null;
  const { appearance, loading, error, reload } = usePlayerAppearance(player?.id ?? null);

  const reloadLibrary = useCallback(async () => {
    try {
      const list = await api.listSkins();
      setSkins(list);
      setLoadError(null);
      setSelectedId((cur) => (cur && list.some((s) => s.id === cur) ? cur : (list[0]?.id ?? null)));
    } catch (e) {
      setLoadError(errorMessage(e));
      setSkins([]);
    }
  }, []);
  useEffect(() => {
    void reloadLibrary();
  }, [reloadLibrary]);

  // A new account means a new character: show it, not a skin from the old one.
  useEffect(() => {
    setPreview("account");
    setConfirmDelete(null);
  }, [player?.id]);

  const selected = skins?.find((s) => s.id === selectedId) ?? null;
  const showingLibrary = preview === "library" && selected !== null;
  const accountModel = appearance?.model ?? "classic";
  const stageModel: SkinModel = showingLibrary ? (selected?.model ?? accountModel) : accountModel;

  const run = async (work: () => Promise<SkinEntry | void>, done: (r: SkinEntry | void) => string) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await work();
      setNotice({ tone: "good", text: done(result) });
    } catch (e) {
      setNotice({ tone: "bad", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const addFile = (file: File) => {
    if (!/\.png$/i.test(file.name) && file.type !== "image/png") {
      setNotice({ tone: "bad", text: "Choose a PNG skin: Maple only sends PNG files to Minecraft." });
      return;
    }
    void run(
      async () => {
        const base64 = await readFileBase64(file);
        const name = file.name.replace(/\.png$/i, "").slice(0, 32) || "My skin";
        const added = await api.addSkinFile(name, newModel, base64);
        await reloadLibrary();
        setSelectedId(added.id);
        setPreview("library");
        return added;
      },
      (r) => `Added “${(r as SkinEntry).name}”. Check it, then apply it to your account.`,
    );
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) addFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropping(false);
    const file = e.dataTransfer.files?.[0];
    if (file) addFile(file);
  };

  const addFromInput = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) {
      setNotice({ tone: "bad", text: "Enter a Minecraft username or a skin link first." });
      return;
    }
    const isLink = /^https?:\/\//i.test(text);
    void run(
      async () => {
        const added = isLink ? await api.addSkinUrl(text, "Skin from a link", newModel) : await api.addSkinPlayer(text);
        setInput("");
        await reloadLibrary();
        setSelectedId(added.id);
        setPreview("library");
        return added;
      },
      (r) => `Added “${(r as SkinEntry).name}”.`,
    );
  };

  const changeModel = (model: SkinModel) => {
    if (!selected || selected.model === model) return;
    void run(
      async () => {
        const updated = await api.setSkinModel(selected.id, model);
        await reloadLibrary();
        return updated;
      },
      () => `Skin type changed to ${MODEL_LABEL[model]}.`,
    );
  };

  const apply = () => {
    if (!selected) return;
    const target = selected;
    void run(
      async () => {
        await api.applySkin(target.id);
        // Keep the skin that was in use so it can be restored with one click.
        if (applied && applied !== target.id) {
          remember(PREVIOUS_KEY, applied);
          setPrevious(applied);
        }
        remember(APPLIED_KEY, target.id);
        setApplied(target.id);
        setPreview("account");
        // Ask Mojang for the account's new look instead of keeping the old figure.
        reload();
      },
      () => `“${target.name}” is now your skin. It shows up in game after the next launch.`,
    );
  };

  const restorePrevious = () => {
    const target = skins?.find((s) => s.id === previous);
    if (!target) return;
    const before = applied;
    void run(
      async () => {
        await api.applySkin(target.id);
        remember(APPLIED_KEY, target.id);
        remember(PREVIOUS_KEY, before);
        setApplied(target.id);
        setPrevious(before);
        setSelectedId(target.id);
        setPreview("account");
        reload();
      },
      () => `Restored “${target.name}”.`,
    );
  };

  const remove = (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setConfirmDelete(null);
    void run(
      async () => {
        await api.removeSkin(id);
        await reloadLibrary();
      },
      () => "Skin removed from the library.",
    );
  };

  const saveAccountSkin = () => {
    if (!player) return;
    void run(
      async () => {
        const added = await api.addSkinPlayer(player.name);
        await reloadLibrary();
        setSelectedId(added.id);
        return added;
      },
      () => "Your current skin was saved to the library.",
    );
  };

  const applyBlocked = !player
    ? "Sign in with Microsoft to change your account's skin. Offline players have no account skin."
    : null;

  return (
    <div className="page studio-page">
      <header className="page-head">
        <p className="eyebrow">Character Studio</p>
        <h1>Character</h1>
        <p className="muted">
          {player
            ? `${player.name}'s Minecraft character, read from the account Maple is signed in with.`
            : "Sign in with Microsoft to see and change your Minecraft character."}
        </p>
      </header>

      {notice && (
        <Banner tone={notice.tone} title={notice.tone === "good" ? "Done" : "That did not work"}>
          {notice.text}
        </Banner>
      )}
      {loadError && (
        <Banner tone="warn" title="Your saved skins are only available in the desktop app">
          {loadError}
        </Banner>
      )}

      <div className="studio-grid">
        <section className="studio-stage-card" aria-label="Character preview">
          <div
            className={`studio-stage ${dropping ? "is-dropping" : ""}`.trim()}
            onDragOver={(e) => {
              e.preventDefault();
              setDropping(true);
            }}
            onDragLeave={() => setDropping(false)}
            onDrop={onDrop}
          >
            {!player ? (
              <div className="studio-stage-empty">
                <span className="studio-stage-icon" aria-hidden="true">
                  <ShirtIcon />
                </span>
                <h2>No account connected</h2>
                <p className="muted small">
                  Your character, its skin and its cape come from your own Minecraft account. Sign in with Microsoft to
                  load them.
                </p>
                <Button variant="primary" size="md" onClick={() => onNavigate("accounts")}>
                  Sign in with Microsoft
                </Button>
              </div>
            ) : loading && !appearance ? (
              <div className="studio-stage-loading" role="status" aria-label="Loading your Minecraft character">
                <Skeleton lines={4} label="Loading your Minecraft character" />
              </div>
            ) : !appearance ? (
              <div className="studio-stage-empty" role="alert">
                <span className="studio-stage-icon studio-stage-icon-bad" aria-hidden="true">
                  <WarningIcon />
                </span>
                <h2>Your character could not be loaded</h2>
                <p className="muted small">{error ?? "Minecraft did not return a skin for this account."}</p>
                <Button variant="secondary" size="md" icon={<RefreshArrowIcon />} onClick={reload}>
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <div className="studio-figure">
                  <SkinViewer
                    key={`${showingLibrary ? "library" : "account"}-${showingLibrary ? selected?.id : appearance.id}`}
                    skin={showingLibrary && selected ? selected.dataUrl : appearance.skin}
                    model={stageModel}
                    legacy={showingLibrary ? false : (appearance.legacy ?? false)}
                    cape={showingLibrary ? null : appearance.cape}
                    initialScale={11}
                    label={
                      showingLibrary && selected
                        ? `${selected.name}, ${MODEL_LABEL[selected.model]} model, preview`
                        : `${appearance.name}, ${MODEL_LABEL[appearance.model]} model${appearance.cape ? ", cape" : ""}`
                    }
                  />
                </div>
                <div className="studio-badge-row">
                  <span className="studio-badge">{MODEL_LABEL[stageModel]} model</span>
                  <span className="studio-badge">
                    {showingLibrary ? "Preview only" : appearance.cape ? "Account cape" : "No cape"}
                  </span>
                  {showingLibrary && applied !== selected?.id && (
                    <span className="studio-badge studio-badge-accent">Not applied yet</span>
                  )}
                </div>
              </>
            )}
            <div className="studio-drop">
              <UploadIcon />
              <span>Drop a 64 × 64 PNG skin here</span>
            </div>
          </div>

          <div className="studio-toolbar">
            <div className="studio-toolbar-end">
              {showingLibrary && (
                <Button size="sm" variant="ghost" onClick={() => setPreview("account")}>
                  Back to my character
                </Button>
              )}
              <span className={`studio-sync studio-sync-${error ? "bad" : loading ? "busy" : "good"}`}>
                <span className="dot" aria-hidden="true" />
                {error ? "Out of sync" : loading ? "Syncing…" : "In sync with Minecraft"}
              </span>
            </div>
          </div>
        </section>

        <aside className="studio-side">
          <section className="studio-panel" aria-label="Account appearance">
            <div className="studio-panel-head">
              <h2>Your account</h2>
              {player && <Badge tone="info">{appearance ? MODEL_LABEL[accountModel] : "Loading"}</Badge>}
            </div>
            {player ? (
              <>
                <p className="studio-account-name">{player.name}</p>
                <dl className="studio-facts">
                  <div>
                    <dt>Skin</dt>
                    <dd>{appearance ? "From your Minecraft profile" : loading ? "Loading…" : "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt>Cape</dt>
                    <dd className="studio-cape-fact">
                      {appearance?.cape ? "Equipped and synced" : "No cape equipped"}
                    </dd>
                  </div>
                </dl>
                {!appearance?.cape && (
                  <p className="muted small">
                    Capes can only be equipped on minecraft.net. Maple shows the cape your account already owns and
                    never adds one that is not there.
                  </p>
                )}
                <div className="studio-panel-actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<RefreshArrowIcon />}
                    loading={loading}
                    loadingLabel="Refreshing…"
                    onClick={reload}
                  >
                    Refresh
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy || !appearance} onClick={saveAccountSkin}>
                    Save skin to library
                  </Button>
                </div>
              </>
            ) : (
              <p className="muted small">
                Sign in with Microsoft to load the character, skin and cape that belong to your account.
              </p>
            )}
          </section>

          <section className="studio-panel" aria-label="Change skin">
            <div className="studio-panel-head">
              <h2>Change skin</h2>
            </div>
            <p className="muted small">
              Upload a 64 × 64 PNG or copy a skin from a username or link. Pick it in the library, then apply it to your
              account.
            </p>

            <button type="button" className="studio-upload" disabled={busy} onClick={() => fileRef.current?.click()}>
              <span className="studio-upload-icon" aria-hidden="true">
                <UploadIcon />
              </span>
              <span>
                <strong>Choose a PNG file</strong>
                <span className="muted small">or drop it on the preview</span>
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png"
              aria-label="Skin file"
              className="visually-hidden"
              tabIndex={-1}
              onChange={onFile}
            />

            <form className="studio-add" onSubmit={addFromInput} role="search">
              <input
                type="text"
                aria-label="Username or skin link"
                placeholder="Username or textures.minecraft.net link"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
              />
              <Button type="submit" size="md" variant="secondary" icon={<PlusIcon />} disabled={busy}>
                Add
              </Button>
            </form>

            <div className="studio-model-row">
              <span id="new-skin-type" className="field-label">
                Type for new skins
              </span>
              <div className="seg" role="radiogroup" aria-labelledby="new-skin-type">
                {(["classic", "slim"] as SkinModel[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={newModel === m}
                    aria-label={`${MODEL_LABEL[m]} for new skins`}
                    className={newModel === m ? "seg-on" : ""}
                    onClick={() => setNewModel(m)}
                  >
                    {MODEL_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <div className="studio-selected">
                <div>
                  <p className="studio-selected-name">{selected.name}</p>
                  <p className="muted small">
                    {MODEL_LABEL[selected.model]} · {sourceLabel(selected.source)}
                    {applied === selected.id ? " · currently applied" : ""}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  block
                  className="studio-apply"
                  icon={<ShirtIcon />}
                  loading={busy}
                  loadingLabel="Applying…"
                  disabled={busy || applyBlocked !== null}
                  onClick={apply}
                >
                  Apply to my account
                </Button>
                {applyBlocked && <p className="muted small">{applyBlocked}</p>}
                {previous && previous !== applied && skins?.some((s) => s.id === previous) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="btn-wide"
                    icon={<RefreshArrowIcon />}
                    disabled={busy || applyBlocked !== null}
                    onClick={restorePrevious}
                  >
                    Restore previous skin
                  </Button>
                )}
              </div>
            )}
          </section>

          <section className="studio-panel" aria-label="Skin library">
            <div className="studio-panel-head">
              <h2>Library</h2>
              {skins && skins.length > 0 && <span className="muted small">{skins.length}</span>}
            </div>

            {skins === null && <Skeleton label="Loading skins" lines={2} />}
            {skins && skins.length === 0 && (
              <div className="empty">
                <ShirtIcon />
                <h2>No skins yet</h2>
                <p className="muted small">
                  Upload a PNG, add a username, or save your current skin{player ? " above." : " after signing in."}
                </p>
              </div>
            )}
            {skins && skins.length > 0 && (
              <ul className="studio-library">
                {skins.map((s) => (
                  <li key={s.id} className={`studio-library-item ${selectedId === s.id ? "is-selected" : ""}`.trim()}>
                    <button
                      type="button"
                      className="studio-library-main"
                      aria-label={`Select ${s.name}`}
                      aria-pressed={selectedId === s.id}
                      onClick={() => {
                        setSelectedId(s.id);
                        setPreview("library");
                        setConfirmDelete(null);
                      }}
                    >
                      <span className="studio-library-art">
                        <SkinHead dataUrl={s.dataUrl} name={s.name} size={40} />
                      </span>
                      <span className="studio-library-text">
                        <span className="studio-library-name">{s.name}</span>
                        <span className="muted small">{MODEL_LABEL[s.model]}</span>
                      </span>
                      {applied === s.id && <Badge tone="good">In use</Badge>}
                    </button>
                    <button
                      type="button"
                      className={`icon-btn icon-btn-danger studio-library-delete ${
                        confirmDelete === s.id ? "confirm" : ""
                      }`.trim()}
                      aria-label={confirmDelete === s.id ? `Confirm removing ${s.name}` : `Remove ${s.name}`}
                      title={confirmDelete === s.id ? "Click again to remove" : "Remove"}
                      disabled={busy}
                      onClick={() => remove(s.id)}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {selected && (
              <div className="studio-type">
                <span id="skin-type-label" className="field-label">
                  Skin type
                </span>
                <div className="seg" role="radiogroup" aria-labelledby="skin-type-label">
                  {(["classic", "slim"] as SkinModel[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={selected.model === m}
                      className={selected.model === m ? "seg-on" : ""}
                      disabled={busy}
                      onClick={() => changeModel(m)}
                    >
                      {MODEL_LABEL[m]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
