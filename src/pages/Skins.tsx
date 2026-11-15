import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { api, errorMessage } from "../api/client";
import type { SkinEntry, SkinModel } from "../api/types";
import { PlusIcon, ShirtIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { SkinFigure } from "../components/SkinModel";
import { usePlayerSkin } from "../components/SkinHead";
import { Badge, Banner, Card, Skeleton } from "../components/ui";
import type { AppData } from "../hooks/useAppData";

const APPLIED_KEY = "cirrus.appliedSkin";

function readApplied(): string | null {
  try {
    return window.localStorage.getItem(APPLIED_KEY);
  } catch {
    return null;
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

function skinSource(s: SkinEntry): string {
  if (s.source.startsWith("player:")) return `From ${s.source.slice(7)}`;
  if (s.source === "url") return "From a link";
  return "From a file";
}

/** Skin library with a turnable preview, import from a file, a player name or a texture link, and apply to the account. */
export function SkinsPage({ data }: { data: AppData }) {
  const [skins, setSkins] = useState<SkinEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [input, setInput] = useState("");
  const [newModel, setNewModel] = useState<SkinModel>("classic");
  const [view, setView] = useState<"spin" | "front" | "back">("spin");
  const [backdrop, setBackdrop] = useState<"sky" | "night" | "plain">("sky");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<string | null>(readApplied);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const acct = data.account.state;
  const player = acct.phase === "signedIn" ? acct.profile : null;
  const accountSkin = usePlayerSkin(player?.id ?? null);

  const reload = useCallback(async () => {
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
    void reload();
  }, [reload]);

  const selected = skins?.find((s) => s.id === selectedId) ?? null;

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
        await reload();
        setSelectedId(added.id);
        return added;
      },
      (r) => `Added “${(r as SkinEntry).name}”.`,
    );
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void run(
      async () => {
        const base64 = await readFileBase64(file);
        const name = file.name.replace(/\.png$/i, "").slice(0, 32) || "My skin";
        const added = await api.addSkinFile(name, newModel, base64);
        await reload();
        setSelectedId(added.id);
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
        await reload();
        return updated;
      },
      () => `Skin type changed to ${MODEL_LABEL[model]}.`,
    );
  };

  const apply = () => {
    if (!selected) return;
    void run(
      async () => {
        await api.applySkin(selected.id);
        try {
          window.localStorage.setItem(APPLIED_KEY, selected.id);
        } catch {
          /* only used to mark the skin as in use */
        }
        setApplied(selected.id);
      },
      () => `“${selected.name}” is now your skin. It shows up in game after the next launch.`,
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
        await reload();
      },
      () => "Skin removed from the library.",
    );
  };

  const saveAccountSkin = () => {
    if (!player) return;
    void run(
      async () => {
        const added = await api.addSkinPlayer(player.name);
        await reload();
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
    <div className="page skins-page">
      <header className="page-head">
        <h1>Skins</h1>
        <p className="muted">Keep your skins in one place and put one on your Minecraft account.</p>
      </header>

      {notice && (
        <Banner tone={notice.tone} title={notice.tone === "good" ? "Done" : "That did not work"}>
          {notice.text}
        </Banner>
      )}
      {loadError && (
        <Banner tone="warn" title="The skin library is only available in the desktop app">
          {loadError}
        </Banner>
      )}

      <div className="skins-layout">
        <Card title="Library" icon={<ShirtIcon />} description="Add a skin by username, link or file.">
          <form className="skin-add" onSubmit={addFromInput} role="search">
            <input
              type="text"
              aria-label="Username or skin link"
              placeholder="Enter a username or a textures.minecraft.net link"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <PlusIcon />
              Add
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              <UploadIcon />
              Choose file
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
          </form>
          <div className="skin-add-type">
            <span id="new-skin-type" className="muted small">
              Type for files and links
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
          <p className="muted small">
            Usernames copy that player&apos;s public skin. Links must be on textures.minecraft.net. Files must be 64 × 64
            PNG images.
          </p>

          {skins === null && <Skeleton label="Loading skins" lines={3} />}
          {skins && skins.length === 0 && (
            <div className="empty empty-big">
              <ShirtIcon />
              <h2>No skins yet</h2>
              <p className="muted">
                Type a username above, choose a PNG file, or save your current skin
                {player ? " with the button on the right." : " after signing in."}
              </p>
            </div>
          )}
          {skins && skins.length > 0 && (
            <ul className="skin-grid">
              {skins.map((s) => (
                <li key={s.id} className={`skin-card ${selectedId === s.id ? "skin-card-on" : ""}`}>
                  <button
                    type="button"
                    className="skin-card-main"
                    aria-label={`Select ${s.name}`}
                    aria-pressed={selectedId === s.id}
                    onClick={() => {
                      setSelectedId(s.id);
                      setConfirmDelete(null);
                    }}
                  >
                    <SkinFigure skin={s.dataUrl} model={s.model} view="front" scale={2.6} label={`${s.name} preview`} />
                    <span className="skin-card-name">{s.name}</span>
                    <span className="muted small">
                      {MODEL_LABEL[s.model]} · {skinSource(s)}
                    </span>
                  </button>
                  {applied === s.id && <Badge tone="good">In use</Badge>}
                  <button
                    type="button"
                    className={`icon-btn icon-btn-danger skin-card-delete ${confirmDelete === s.id ? "confirm" : ""}`}
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
        </Card>

        <Card title="Preview" icon={<ShirtIcon />} description={selected ? selected.name : "Pick a skin to preview it."}>
          {selected ? (
            <>
              <div className={`skin-preview skin-bg-${backdrop}`}>
                <SkinFigure
                  skin={selected.dataUrl}
                  model={selected.model}
                  view={view}
                  scale={7}
                  label={`${selected.name}, ${MODEL_LABEL[selected.model]} model`}
                />
              </div>
              <div className="skin-controls">
                <div className="field">
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
                <div className="field">
                  <span id="skin-view-label" className="field-label">
                    View
                  </span>
                  <div className="seg" role="radiogroup" aria-labelledby="skin-view-label">
                    {(["spin", "front", "back"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={view === v}
                        aria-label={`${v === "spin" ? "Turning" : v === "front" ? "Front" : "Back"} view`}
                        className={view === v ? "seg-on" : ""}
                        onClick={() => setView(v)}
                      >
                        {v === "spin" ? "Turn" : v === "front" ? "Front" : "Back"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span id="skin-bg-label" className="field-label">
                    Background
                  </span>
                  <div className="seg" role="radiogroup" aria-labelledby="skin-bg-label">
                    {(["sky", "night", "plain"] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        role="radio"
                        aria-checked={backdrop === b}
                        aria-label={`${b === "sky" ? "Sky" : b === "night" ? "Night" : "Plain"} background`}
                        className={backdrop === b ? "seg-on" : ""}
                        onClick={() => setBackdrop(b)}
                      >
                        {b === "sky" ? "Sky" : b === "night" ? "Night" : "Plain"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-primary btn-wide" disabled={busy || applyBlocked !== null} onClick={apply}>
                Apply to my account
              </button>
              {applyBlocked && <p className="muted small">{applyBlocked}</p>}
            </>
          ) : (
            <div className="empty">
              <p className="muted">Nothing selected.</p>
            </div>
          )}

          {player && (
            <div className="skin-account">
              <h3>Your current skin</h3>
              <p className="muted small">
                {player.name} · {accountSkin ? "as set on your Minecraft account" : "no custom skin found"}
              </p>
              <button type="button" className="btn" disabled={busy || !accountSkin} onClick={saveAccountSkin}>
                Save it to the library
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
