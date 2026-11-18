import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { api, errorMessage } from "../api/client";
import type { SkinEntry, SkinModel } from "../api/types";
import { PlusIcon, RefreshArrowIcon, ShirtIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { SkinFigure } from "../components/SkinModel";
import { usePlayerSkin } from "../components/SkinHead";
import { Badge, Banner, Card, Skeleton } from "../components/ui";
import { Button } from "../components/Button";
import { capeOptions, capeTexture, type CapeId } from "../core/capes";
import { SKIN_PRESETS, presetBase64, type SkinPreset } from "../core/skinPresets";
import { usePlayerAppearance } from "../hooks/useAppearance";
import type { AppData } from "../hooks/useAppData";
import cirrusCape from "../assets/capes/cirrus.png";

const APPLIED_KEY = "cirrus.appliedSkin";
const PREVIOUS_KEY = "cirrus.previousSkin";

function readApplied(): string | null {
  try {
    return window.localStorage.getItem(APPLIED_KEY);
  } catch {
    return null;
  }
}

function readPrevious(): string | null {
  try {
    return window.localStorage.getItem(PREVIOUS_KEY);
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
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<string | null>(readApplied);
  const [previous, setPrevious] = useState<string | null>(readPrevious);
  const [zoom, setZoom] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [subject, setSubject] = useState<"account" | "library">("account");
  const [capeId, setCapeId] = useState<CapeId>("account");
  const fileRef = useRef<HTMLInputElement>(null);

  const acct = data.account.state;
  const player = acct.phase === "signedIn" ? acct.profile : null;
  const accountSkin = usePlayerSkin(player?.id ?? null);
  const appearanceState = usePlayerAppearance(player?.id ?? null);
  const accountCharacter = appearanceState.appearance;
  // The account's own character is the default subject; a library skin can be
  // previewed next to it without changing the account.
  const hasAccountCharacter = Boolean(player && accountCharacter);
  const showingAccount = subject === "account" && hasAccountCharacter;
  useEffect(() => {
    // "Your Minecraft cape" is not an option when the account has none; fall
    // back to the honest empty choice instead of leaving nothing selected.
    if (accountCharacter && !accountCharacter.cape) setCapeId((current) => (current === "account" ? "none" : current));
  }, [accountCharacter]);

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
        // Ask Mojang for the account's new look instead of keeping the old head.
        appearanceState.reload();
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
        appearanceState.reload();
      },
      () => `Restored “${target.name}”.`,
    );
  };

  const addPreset = (preset: SkinPreset) => {
    void run(
      async () => {
        const added = await api.addSkinFile(preset.name, preset.model, presetBase64(preset));
        await reload();
        setSelectedId(added.id);
        return added;
      },
      (r) => `Added “${(r as SkinEntry).name}” to your library.`,
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
        <h1>Character</h1>
        <p className="muted">
          Your Minecraft character, skin library and capes. Everything here shows the account Cirrus is signed in with.
        </p>
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

          <div className="field">
            <span className="field-label">Cirrus presets</span>
            <div className="preset-row">
              {SKIN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="preset-button"
                  aria-label={`Add preset ${preset.name}`}
                  disabled={busy}
                  onClick={() => addPreset(preset)}
                >
                  <span aria-hidden="true">
                    <SkinFigure skin={preset.dataUrl} model={preset.model} view="front" scale={1.1} label="" />
                  </span>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

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

        <Card
          title="Preview"
          icon={<ShirtIcon />}
          description={
            showingAccount
              ? `${player?.name}'s Minecraft character`
              : selected
                ? selected.name
                : "Pick a skin to preview it."
          }
        >
          {hasAccountCharacter && selected && (
            <div className="seg skin-subject" role="radiogroup" aria-label="What to preview">
              <button
                type="button"
                role="radio"
                aria-checked={showingAccount}
                className={showingAccount ? "seg-on" : ""}
                onClick={() => setSubject("account")}
              >
                Your character
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!showingAccount}
                className={!showingAccount ? "seg-on" : ""}
                onClick={() => setSubject("library")}
              >
                Selected skin
              </button>
            </div>
          )}

          {(showingAccount || selected) && (
            <div className="skin-zoom">
              <span className="field-label" id="skin-zoom-label">Zoom</span>
              <input
                type="range"
                min={6}
                max={16}
                step={1}
                value={zoom}
                aria-labelledby="skin-zoom-label"
                aria-valuetext={`${Math.round((zoom / 10) * 100)} percent`}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <span className="skin-zoom-value">{Math.round((zoom / 10) * 100)}%</span>
            </div>
          )}

          {showingAccount && accountCharacter ? (
            <>
              <div className="skin-preview">
                <SkinFigure
                  skin={accountCharacter.skin}
                  model={accountCharacter.model}
                  view={view}
                  scale={zoom}
                  legacy={accountCharacter.legacy ?? false}
                  draggable
                  cape={capeTexture(capeId, accountCharacter.cape, cirrusCape)}
                  label={`${accountCharacter.name}, ${MODEL_LABEL[accountCharacter.model]} model${capeId === "none" ? "" : ", cape"}`}
                />
                <span className="skin-floor" aria-hidden="true" />
                <p className="skin-hint small">Drag to turn · double-click to reset</p>
              </div>

              <div className="skin-controls">
                <div className="field">
                  <span className="field-label">Model</span>
                  <p className="skin-model-value">{MODEL_LABEL[accountCharacter.model]}</p>
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
              </div>

              <div className="field cape-field">
                <span id="cape-label" className="field-label">
                  Cape
                </span>
                <div className="cape-options" role="radiogroup" aria-labelledby="cape-label">
                  {capeOptions(Boolean(accountCharacter.cape)).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={capeId === option.id}
                      className={`cape-option ${capeId === option.id ? "cape-option-on" : ""}`}
                      onClick={() => setCapeId(option.id)}
                    >
                      <span className="cape-option-name">
                        {option.label}
                        {option.id === "cirrus" && <Badge tone="info">Preview</Badge>}
                      </span>
                      <span className="muted small">{option.detail}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="btn" disabled={capeId === "account"} onClick={() => setCapeId("account")}>
                  Reset to my account's look
                </button>
                <p className="muted small">
                  Your Minecraft cape is read from your account and appears in game. Capes can only be equipped on
                  minecraft.net; the Cirrus cape is a local preview and does not change your account.
                </p>
              </div>
            </>
          ) : (
            <>
              {player && (appearanceState.loading || appearanceState.error) && (
                <p className="muted small">
                  {appearanceState.loading
                    ? "Loading your Minecraft character…"
                    : "Your character could not be loaded, so the selected skin is shown instead."}
                </p>
              )}
              {selected ? (
                <>
                  <div className="skin-preview">
                    <SkinFigure
                      skin={selected.dataUrl}
                      model={selected.model}
                      view={view}
                      scale={zoom}
                      draggable
                      label={`${selected.name}, ${MODEL_LABEL[selected.model]} model`}
                    />
                    <span className="skin-floor" aria-hidden="true" />
                    <p className="skin-hint small">Drag to turn · double-click to reset</p>
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
                  </div>
                </>
              ) : (
                <div className="empty">
                  <p className="muted">Nothing selected.</p>
                </div>
              )}
            </>
          )}

          {selected && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-wide"
                aria-label="Apply to my account"
                disabled={busy || applyBlocked !== null}
                onClick={apply}
              >
                Apply “{selected.name}” to my account
              </button>
              {applyBlocked && <p className="muted small">{applyBlocked}</p>}
              {previous && previous !== applied && skins?.some((s) => s.id === previous) && (
                <Button
                  variant="secondary"
                  size="md"
                  className="btn-wide"
                  icon={<RefreshArrowIcon />}
                  disabled={busy || applyBlocked !== null}
                  onClick={restorePrevious}
                >
                  Restore previous skin
                </Button>
              )}
            </>
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
