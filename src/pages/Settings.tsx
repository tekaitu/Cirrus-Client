import { useEffect, useState, type ReactNode } from "react";
import { api, errorMessage } from "../api/client";
import type { SettingsState } from "../api/types";
import {
  ChatIcon,
  CheckIcon,
  CpuIcon,
  CubeIcon,
  DownloadIcon,
  FolderIcon,
  InfoIcon,
  JavaIcon,
  KeyboardIcon,
  MemoryIcon,
  PaletteIcon,
  RefreshArrowIcon,
  RocketIcon,
  SettingsIcon,
  UserIcon,
} from "../components/Icons";
import type { PageId } from "../components/Sidebar";
import { PAGE_SHORTCUTS } from "../core/shortcuts";
import { usernameError, type LoaderId } from "../core/game";
import { JavaStatusBadge, javaTitle } from "../components/JavaStatus";
import { Banner, Card, Skeleton, type Tone } from "../components/ui";
import { formatMemory } from "../core/format";
import { analyzeJava, type JavaAnalysis } from "../core/java";
import {
  MEMORY_STEP_MB,
  clampMemory,
  hasErrors,
  normalizeDraft,
  settingsEqual,
  validateDraft,
  type Settings,
  type SettingsErrors,
} from "../core/settings";
import { ACCENTS, THEMES, getAccent, getTheme, setAccent, setTheme } from "../core/theme";
import type { AppData } from "../hooks/useAppData";

type JavaTest = { status: "idle" } | { status: "running" } | { status: "done"; result: JavaAnalysis } | { status: "error"; message: string };

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="muted small">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export type SettingsTab =
  | "general"
  | "appearance"
  | "performance"
  | "minecraft"
  | "memory"
  | "folder"
  | "launch"
  | "keybinds"
  | "updates";

const TABS: Array<{ id: SettingsTab; label: string; icon: ReactNode }> = [
  { id: "general", label: "General", icon: <SettingsIcon /> },
  { id: "appearance", label: "Appearance", icon: <PaletteIcon /> },
  { id: "performance", label: "Performance", icon: <CpuIcon /> },
  { id: "minecraft", label: "Minecraft", icon: <CubeIcon /> },
  { id: "memory", label: "Memory and RAM", icon: <MemoryIcon /> },
  { id: "folder", label: "Game directory", icon: <FolderIcon /> },
  { id: "launch", label: "Launch settings", icon: <RocketIcon /> },
  { id: "keybinds", label: "Keybinds", icon: <KeyboardIcon /> },
  { id: "updates", label: "Updates", icon: <DownloadIcon /> },
];

export function isSettingsTab(value: string | undefined): value is SettingsTab {
  return TABS.some((t) => t.id === value);
}

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* a remembered choice is a convenience only */
  }
}

function SettingsForm({
  state,
  data,
  initialTab,
  onNavigate,
}: {
  state: SettingsState;
  data: AppData;
  initialTab: SettingsTab;
  onNavigate: (page: PageId, section?: string) => void;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  const [playMode, setPlayMode] = useState<"microsoft" | "offline">(() =>
    readLocal("unlimited.playMode") === "offline" ? "offline" : "microsoft",
  );
  const [playerName, setPlayerName] = useState(() => readLocal("unlimited.username") ?? "");
  const nameProblem = playerName.trim() === "" ? null : usernameError(playerName);
  const saved = state.settings;
  const limits = { min: state.minMemoryMb, max: state.maxMemoryMb };

  const [draft, setDraft] = useState<Settings>(saved);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [javaTest, setJavaTest] = useState<JavaTest>({ status: "idle" });
  const [look, setLook] = useState(() => ({ theme: getTheme(), accent: getAccent() }));

  // After a successful save or reset the backend hands back a new settings object.
  useEffect(() => {
    setDraft(state.settings);
    setErrors({});
  }, [state.settings]);

  const dirty = !settingsEqual(normalizeDraft(draft), saved);
  const detected =
    data.java.status === "ready" ? data.java.data.analyses.filter((a) => a.status === "compatible") : [];

  function edit(patch: Partial<Settings>) {
    setDraft((d) => ({ ...d, ...patch }));
    setNotice(null);
    setJavaTest({ status: "idle" });
  }

  async function save() {
    const cleaned = normalizeDraft(draft);
    const local = validateDraft(cleaned, limits);
    if (hasErrors(local)) {
      setErrors(local);
      setNotice({ tone: "bad", text: "Fix the highlighted fields, then save again." });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const outcome = await api.saveSettings(cleaned);
      if (outcome.ok && outcome.state) {
        data.applySettings(outcome.state);
        setNotice({ tone: "good", text: "Settings saved." });
      } else {
        const next: SettingsErrors = {};
        for (const e of outcome.errors) next[e.field] = e.message;
        setErrors(next);
        setNotice({ tone: "bad", text: "Some settings were not saved. Fix the highlighted fields." });
      }
    } catch (e) {
      setNotice({ tone: "bad", text: `Could not save settings: ${errorMessage(e)}` });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setConfirmReset(false);
    setSaving(true);
    try {
      const fresh = await api.resetSettings();
      data.applySettings(fresh);
      setNotice({ tone: "good", text: "Settings were reset to their defaults." });
    } catch (e) {
      setNotice({ tone: "bad", text: `Could not reset settings: ${errorMessage(e)}` });
    } finally {
      setSaving(false);
    }
  }

  async function testJava() {
    const path = draft.javaPath?.trim();
    if (!path) return;
    setJavaTest({ status: "running" });
    try {
      setJavaTest({ status: "done", result: analyzeJava(await api.inspectJava(path)) });
    } catch (e) {
      setJavaTest({ status: "error", message: errorMessage(e) });
    }
  }

  return (
    <form
      className="page settings-page"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      <header className="page-head">
        <h1>Settings</h1>
        <p className="muted">Saved on this PC and used the next time you start the game.</p>
      </header>
      {state.status === "recoveredFromCorruption" && state.message && (
        <Banner tone="warn" title="Settings were restored to defaults">
          {state.message}
        </Banner>
      )}

      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Settings sections" role="tablist" aria-orientation="vertical">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="settings-panel"
              className={`settings-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="settings-panel" id="settings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === "general" && (
            <>
      <Card
        id="sec-about"
        title="Community"
        tone="blue"
        icon={<ChatIcon />}
        description="Questions, bug reports and ideas are welcome."
      >
        <div className="row">
          <button
            type="button"
            className="btn btn-discord"
            onClick={() => void api.openCommunity().catch((e: unknown) => setNotice({ tone: "bad", text: errorMessage(e) }))}
          >
            <ChatIcon />
            Join the Discord community
          </button>
          <span className="muted small">
            Cirrus Client {data.app.status === "ready" ? `v${data.app.data.version}` : ""} · early build
          </span>
        </div>
      </Card>
      <Card id="sec-account" title="Microsoft sign-in" tone="pink" icon={<UserIcon />} description="Advanced: normally nothing to change here.">
        <Field
          id="ms-client-id"
          label="Azure application (client) ID"
          hint="Advanced and optional. Leave blank to use the app ID built into Cirrus Client. It is an ID, not a secret. See docs/AUTH.md."
          error={errors.msClientId}
        >
          <input
            id="ms-client-id"
            type="text"
            spellCheck={false}
            autoComplete="off"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={draft.msClientId ?? ""}
            aria-invalid={errors.msClientId ? true : undefined}
            onChange={(e) => edit({ msClientId: e.target.value })}
          />
        </Field>
      </Card>
      <Card title="Settings file" icon={<InfoIcon />} description="Everything on the other tabs is stored here.">
        <p className="path">{state.filePath}</p>
      </Card>
            </>
          )}
          {tab === "appearance" && (
            <>
      <Card id="sec-interface" title="Theme and colours" icon={<PaletteIcon />} description="Applied at once.">
        <div className="field">
          <span id="theme-label" className="field-label">
            Theme
          </span>
          <div className="theme-grid" role="radiogroup" aria-labelledby="theme-label">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={look.theme === t.id}
                aria-label={`${t.label} theme`}
                className={`theme-card ${look.theme === t.id ? "theme-on" : ""}`}
                onClick={() => {
                  setTheme(t.id);
                  setLook((l) => ({ ...l, theme: t.id }));
                }}
              >
                <span className="theme-preview" style={{ background: t.swatch[0] }} aria-hidden="true">
                  <i style={{ background: t.swatch[1] }} />
                  <i style={{ background: t.swatch[2] }} />
                  <b />
                </span>
                <span className="theme-name">{t.label}</span>
                <span className="muted small">{t.blurb}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span id="accent-label" className="field-label">
            Accent colour
          </span>
          <div className="accent-row" role="radiogroup" aria-labelledby="accent-label">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={look.accent === a.id}
                aria-label={`${a.label} accent`}
                title={a.label}
                className={`accent-dot ${look.accent === a.id ? "accent-on" : ""}`}
                style={{ background: a.color, color: a.ink }}
                onClick={() => {
                  setAccent(a.id);
                  setLook((l) => ({ ...l, accent: a.id }));
                }}
              >
                {look.accent === a.id && <CheckIcon />}
              </button>
            ))}
          </div>
        </div>
        <label className="check switch">
          <input
            type="checkbox"
            checked={draft.reduceMotion}
            onChange={(e) => edit({ reduceMotion: e.target.checked })}
          />
          <span>Reduce motion (turns off animations and transitions)</span>
        </label>
      </Card>
            </>
          )}
          {tab === "performance" && (
            <>
      <Card id="sec-java" title="Java" tone="amber" icon={<JavaIcon />} description="Which Java runs the game (21 or newer).">
        <Field
          id="java-path"
          label="Java executable"
          hint="Leave empty to detect Java automatically."
          error={errors.javaPath}
        >
          <input
            id="java-path"
            type="text"
            placeholder="Automatic (e.g. C:\Program Files\Eclipse Adoptium\jdk-21\bin\java.exe)"
            value={draft.javaPath ?? ""}
            aria-invalid={errors.javaPath ? true : undefined}
            onChange={(e) => edit({ javaPath: e.target.value })}
          />
        </Field>

        <div className="row">
          {detected.length > 0 && (
            <select
              aria-label="Pick a detected Java"
              value=""
              onChange={(e) => e.target.value && edit({ javaPath: e.target.value })}
            >
              <option value="">Choose a detected Java…</option>
              {detected.map((a) => (
                <option key={a.path} value={a.path}>
                  {javaTitle(a)} — {a.path}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => void testJava()}
            disabled={!draft.javaPath?.trim() || javaTest.status === "running"}
          >
            <RefreshArrowIcon />
            {javaTest.status === "running" ? "Testing…" : "Test this Java"}
          </button>
        </div>

        {javaTest.status === "done" && (
          <p className="test-result" role="status">
            <JavaStatusBadge status={javaTest.result.status} /> {javaTest.result.message}
          </p>
        )}
        {javaTest.status === "error" && (
          <p className="error-text" role="alert">
            {javaTest.message}
          </p>
        )}
      </Card>
      <Card title="Performance mods" tone="cyan" icon={<RocketIcon />} description="More FPS comes mostly from mods, not from launcher settings.">
        <p className="muted small">
          The Mods page can install a ready-made performance pack (Sodium, Lithium and others) in one click. It needs
          Fabric.
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={() => onNavigate("mods")}>
            <CubeIcon />
            Open Mods
          </button>
        </div>
      </Card>
            </>
          )}
          {tab === "minecraft" && (
            <>
      <Card title="Default version" icon={<CubeIcon />} description="What Play starts with. Applied at once.">
        <div className="pick-row">
          <label className="pick">
            <span>Minecraft version</span>
            <select
              aria-label="Default Minecraft version"
              value={data.selection.version}
              onChange={(e) => data.selection.setVersion(e.target.value)}
            >
              {data.selection.versions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="pick">
            <span id="default-loader-label">Loader</span>
            <div className="seg" role="radiogroup" aria-labelledby="default-loader-label">
              {(["fabric", "vanilla"] as LoaderId[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={data.selection.loader === l}
                  className={data.selection.loader === l ? "seg-on" : ""}
                  onClick={() => data.selection.setLoader(l)}
                >
                  {l === "fabric" ? "Fabric" : "Vanilla"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="muted small">
          Fabric is the mod loader. Vanilla is the plain game and cannot load mods. Each version and loader keeps its own
          worlds and mods.
        </p>
      </Card>
      <Card title="Why no OptiFine?" icon={<InfoIcon />} description="Short answer: it cannot be downloaded automatically.">
        <p className="muted small">
          OptiFine&apos;s download page requires a person to click through it, and its license does not allow other
          launchers to redistribute it. On Fabric, Sodium, Lithium and similar mods give the same kind of FPS boost.
        </p>
      </Card>
            </>
          )}
          {tab === "memory" && (
            <>
      <Card id="sec-memory" title="Memory" tone="cyan" icon={<MemoryIcon />} description="How much RAM Minecraft may use.">
        <Field
          id="memory"
          label="Memory for Minecraft"
          hint={`${formatMemory(draft.memoryMb)} of ${formatMemory(state.totalRamMb)} installed. More memory is not automatically faster; leave room for Windows.`}
          error={errors.memoryMb}
        >
          <div className="memory-row">
            <input
              type="range"
              aria-label="Memory slider"
              min={limits.min}
              max={limits.max}
              step={MEMORY_STEP_MB}
              value={clampMemory(draft.memoryMb, limits)}
              onChange={(e) => edit({ memoryMb: Number(e.target.value) })}
            />
            <input
              id="memory"
              type="number"
              inputMode="numeric"
              aria-label="Memory in MB"
              min={limits.min}
              max={limits.max}
              step={MEMORY_STEP_MB}
              value={Number.isFinite(draft.memoryMb) ? draft.memoryMb : ""}
              aria-invalid={errors.memoryMb ? true : undefined}
              onChange={(e) => edit({ memoryMb: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
            />
            <span className="muted">MB</span>
          </div>
          <div className="presets" role="group" aria-label="Memory presets">
            {[2048, 4096, 6144, 8192]
              .filter((mb) => mb >= limits.min && mb <= limits.max)
              .map((mb) => (
                <button
                  key={mb}
                  type="button"
                  className={`chip ${draft.memoryMb === mb ? "chip-on" : ""}`}
                  aria-pressed={draft.memoryMb === mb}
                  onClick={() => edit({ memoryMb: mb })}
                >
                  Use {mb / 1024} GB
                </button>
              ))}
          </div>
        </Field>
      </Card>
            </>
          )}
          {tab === "folder" && (
            <>
      <Card id="sec-folder" title="Game folder" tone="green" icon={<FolderIcon />} description="Where game data will be stored.">
        <Field
          id="game-dir"
          label="Game directory"
          hint="Where instances and game data will live. Type or paste a full path."
          error={errors.gameDir}
        >
          <input
            id="game-dir"
            type="text"
            value={draft.gameDir}
            aria-invalid={errors.gameDir ? true : undefined}
            onChange={(e) => edit({ gameDir: e.target.value })}
          />
        </Field>
      </Card>
            </>
          )}
          {tab === "launch" && (
            <>
      <Card title="Who plays" icon={<UserIcon />} description="The way Play signs you in by default. Applied at once.">
        <div className="field">
          <span id="default-mode-label" className="field-label">
            Play as
          </span>
          <div className="seg" role="radiogroup" aria-labelledby="default-mode-label">
            {(["microsoft", "offline"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={playMode === m}
                className={playMode === m ? "seg-on" : ""}
                onClick={() => {
                  setPlayMode(m);
                  writeLocal("unlimited.playMode", m);
                }}
              >
                {m === "microsoft" ? "Microsoft account" : "Offline name"}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="default-player-name">Offline player name</label>
          <input
            id="default-player-name"
            type="text"
            value={playerName}
            maxLength={16}
            autoComplete="off"
            spellCheck={false}
            placeholder="Steve"
            aria-invalid={nameProblem ? true : undefined}
            onChange={(e) => {
              setPlayerName(e.target.value);
              writeLocal("unlimited.username", e.target.value);
            }}
          />
          <p className={nameProblem ? "error-text" : "muted small"}>
            {nameProblem ?? "Used for offline play. 3 to 16 letters, numbers or underscores."}
          </p>
        </div>
      </Card>
      <Card title="Java for launching" icon={<JavaIcon />} description="Which Java starts the game.">
        <p className="muted small">
          Cirrus finds Java 21 automatically and can install it for you. To pick one yourself or test a path, open
          Performance.
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={() => setTab("performance")}>
            <CpuIcon />
            Open Performance
          </button>
        </div>
      </Card>
            </>
          )}
          {tab === "keybinds" && (
            <>
      <Card title="Shortcuts" icon={<KeyboardIcon />} description="Press these anywhere in the launcher.">
        <table className="key-table">
          <tbody>
            {PAGE_SHORTCUTS.map((s) => (
              <tr key={s.key}>
                <th scope="row">{s.label}</th>
                <td>
                  <kbd>Alt</kbd> + <kbd>{s.key}</kbd>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          These shortcuts are fixed for now. In-game keybinds come with the in-game client, which is not part of this
          release.
        </p>
      </Card>
            </>
          )}
          {tab === "updates" && (
            <>
      <Card title="Version" icon={<DownloadIcon />} description="What is installed right now.">
        <dl className="config-list">
          <div>
            <dt>Cirrus Client</dt>
            <dd>
              <strong>{data.app.status === "ready" ? `v${data.app.data.version}` : "…"}</strong>
              <span className="muted small"> · early build</span>
            </dd>
          </div>
          <div>
            <dt>Built for</dt>
            <dd>
              <strong>{data.app.status === "ready" ? `Minecraft ${data.app.data.target_minecraft}` : "…"}</strong>
            </dd>
          </div>
        </dl>
      </Card>
      <Card title="Getting updates" icon={<InfoIcon />} description="Cirrus does not update itself yet.">
        <p className="muted small">
          New builds are published on GitHub. Download the newest one and replace the old file; your settings, profiles
          and worlds live in a separate folder and carry over.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => void api.openGithub().catch((e: unknown) => setNotice({ tone: "bad", text: errorMessage(e) }))}
          >
            <DownloadIcon />
            Open the GitHub page
          </button>
        </div>
      </Card>
            </>
          )}
        </div>
      </div>

      {notice && (
        <Banner tone={notice.tone} title={notice.text} />
      )}

      {confirmReset && (
        <Banner
          tone="warn"
          title="Reset all settings to their defaults?"
          actions={
            <>
              <button type="button" className="btn btn-danger" onClick={() => void reset()}>
                Yes, reset
              </button>
              <button type="button" className="btn" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </>
          }
        />
      )}

      <div className="actions action-bar">
        <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
          <CheckIcon />
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!dirty || saving}
          onClick={() => {
            setDraft(saved);
            setErrors({});
            setNotice(null);
          }}
        >
          <RefreshArrowIcon />
          Discard changes
        </button>
        <button type="button" className="btn btn-quiet" disabled={saving} onClick={() => setConfirmReset(true)}>
          Reset to defaults
        </button>
        {dirty && <span className="unsaved small">Unsaved changes</span>}
      </div>

    </form>
  );
}

export function SettingsPage({
  data,
  section,
  onNavigate,
}: {
  data: AppData;
  section?: string;
  onNavigate: (page: PageId, section?: string) => void;
}) {
  const s = data.settings;
  if (s.status === "loading") {
    return (
      <div className="page">
        <h1>Settings</h1>
        <Skeleton label="Loading settings" lines={4} />
      </div>
    );
  }
  if (s.status === "error") {
    return (
      <div className="page">
        <h1>Settings</h1>
        <Banner
          tone="bad"
          title="Settings could not be loaded"
          actions={
            <button type="button" className="btn" onClick={data.reloadSettings}>
              Try again
            </button>
          }
        >
          {s.message}
        </Banner>
      </div>
    );
  }
  return <SettingsForm state={s.data} data={data} initialTab={isSettingsTab(section) ? section : "general"} onNavigate={onNavigate} />;
}
