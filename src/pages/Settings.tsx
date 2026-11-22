import { useEffect, useState, type ReactNode } from "react";
import { api, errorMessage } from "../api/client";
import type { SettingsState, UpdateCheck } from "../api/types";
import { BrandIcon } from "../components/BrandIcon";
import {
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
  PlusIcon,
  RefreshArrowIcon,
  RocketIcon,
  SettingsIcon,
  UserIcon,
} from "../components/Icons";
import type { PageId } from "../components/Navigation";
import { PAGE_SHORTCUTS } from "../core/shortcuts";
import { usernameError, type LoaderId } from "../core/game";
import { JavaStatusBadge, javaTitle } from "../components/JavaStatus";
import { JavaInstallPanel } from "../components/JavaInstallPanel";
import { requiredJava } from "../core/instances";
import { Badge, Banner, Card, Skeleton, type Tone } from "../components/ui";
import { Button } from "../components/Button";
import { SkinHead } from "../components/SkinHead";
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
import { THEMES, getTheme, setTheme } from "../core/theme";
import { insideTauri, setNativeFrame, useNativeFrame } from "../core/windowFrame";
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
  | "account"
  | "keybinds"
  | "updates";

/**
 * The sections, grouped the way people think about them: what the game is,
 * how it runs, how Cirrus looks, who plays, and the rest.
 */
const TABS: Array<{ id: SettingsTab; label: string; icon: ReactNode; group: string }> = [
  { id: "minecraft", label: "Minecraft", icon: <CubeIcon />, group: "Game" },
  { id: "folder", label: "Game directory", icon: <FolderIcon />, group: "Game" },
  { id: "launch", label: "Launch settings", icon: <RocketIcon />, group: "Game" },
  { id: "performance", label: "Performance", icon: <CpuIcon />, group: "Performance" },
  { id: "memory", label: "Memory and RAM", icon: <MemoryIcon />, group: "Performance" },
  { id: "appearance", label: "Appearance", icon: <PaletteIcon />, group: "Appearance" },
  { id: "account", label: "Account", icon: <UserIcon />, group: "Account" },
  { id: "general", label: "General", icon: <SettingsIcon />, group: "More" },
  { id: "keybinds", label: "Keybinds", icon: <KeyboardIcon />, group: "More" },
  { id: "updates", label: "Updates", icon: <DownloadIcon />, group: "More" },
];

const TAB_GROUPS = TABS.reduce<Array<{ label: string; tabs: typeof TABS }>>((groups, tab) => {
  const last = groups[groups.length - 1];
  if (last && last.label === tab.group) last.tabs.push(tab);
  else groups.push({ label: tab.group, tabs: [tab] });
  return groups;
}, []);

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
  discord,
}: {
  state: SettingsState;
  data: AppData;
  initialTab: SettingsTab;
  onNavigate: (page: PageId, section?: string) => void;
  discord?: { enabled: boolean; onToggle: () => void };
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
  const [look, setLook] = useState(() => ({ theme: getTheme() }));
  const [characterSpin, setCharacterSpin] = useState(() => readLocal("cirrus.characterSpin") !== "off");

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
      className="page settings-page settings-glass-page"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      <header className="page-head settings-hero">
        <h1>Settings</h1>
        <p className="muted">Saved on this PC and used the next time you start the game.</p>
      </header>
      {state.status === "recoveredFromCorruption" && state.message && (
        <Banner tone="warn" title="Settings were restored to defaults">
          {state.message}
        </Banner>
      )}

      <div className="settings-layout settings-glass-layout">
        <nav className="settings-tabs settings-glass-nav" aria-label="Settings sections" role="tablist" aria-orientation="vertical">
          {TAB_GROUPS.map((group) => (
            <div className="settings-tab-group" role="presentation" key={group.label}>
              <p className="settings-tab-group-label" aria-hidden="true">
                {group.label}
              </p>
              {group.tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="settings-panel"
                  className={`settings-tab settings-glass-tab ${tab === t.id ? "active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="settings-panel settings-glass-panel" id="settings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === "general" && (
            <>
      <Card
        id="sec-about"
        title="Community"
        tone="blue"
        icon={<BrandIcon name="discord" />}
        description="Questions, bug reports and ideas are welcome."
      >
        <div className="row">
          <button
            type="button"
            className="btn btn-discord"
            onClick={() => void api.openCommunity().catch((e: unknown) => setNotice({ tone: "bad", text: errorMessage(e) }))}
          >
            <BrandIcon name="discord" />
            Join the Discord community
          </button>
        </div>
        {discord && (
          <label className="switch-row">
            <span>
              <strong>Show what I&apos;m playing on Discord</strong>
              <span className="muted small"> Your Discord status shows Cirrus Client and the version you play.</span>
            </span>
            <input type="checkbox" role="switch" aria-label="Discord Presence" checked={discord.enabled} onChange={discord.onToggle} />
          </label>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={() => onNavigate("about")}>
            About
          </button>
          <button type="button" className="btn" onClick={() => onNavigate("diagnostics")}>
            Diagnostics
          </button>
          <button type="button" className="btn" onClick={data.reloadJava}>
            Re-scan Java
          </button>
        </div>
      </Card>
      <Card title="Settings file" icon={<InfoIcon />} description="Everything on the other tabs is stored here.">
        <p className="path">{state.filePath}</p>
      </Card>
            </>
          )}
          {tab === "appearance" && (
            <>
      <Card id="sec-interface" title="Appearance" icon={<PaletteIcon />} description="Applied at once.">
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
        {insideTauri() && <NativeFrameSwitch />}
        <label className="check switch">
          <input
            type="checkbox"
            checked={draft.reduceMotion}
            onChange={(e) => edit({ reduceMotion: e.target.checked })}
          />
          <span>Reduce motion (turns off animations and transitions)</span>
        </label>
        <label className="check switch">
          <input
            type="checkbox"
            checked={characterSpin}
            onChange={(e) => {
              setCharacterSpin(e.target.checked);
              writeLocal("cirrus.characterSpin", e.target.checked ? "on" : "off");
            }}
          />
          <span>
            Turn the character preview automatically
            <small className="muted"> Off keeps the figure still until you drag it.</small>
          </span>
        </label>
      </Card>
            </>
          )}
          {tab === "performance" && (
            <>
      <Card id="sec-java" title="Java" tone="amber" icon={<JavaIcon />} description="What is installed, what this Minecraft version needs, and which runtime starts it.">
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

        <div className="java-list" aria-label="Detected Java installations">
          <p className="field-label">Detected Java</p>
          {data.java.status === "loading" && <Skeleton label="Scanning for Java" lines={2} />}
          {data.java.status === "error" && <p className="muted small">Java could not be scanned in this window.</p>}
          {data.java.status === "ready" && data.java.data.analyses.length === 0 && (
            <p className="muted small">
              No Java was found. Install one below; it is kept inside Cirrus' own folder and Windows is not changed.
            </p>
          )}
          {data.java.status === "ready" && data.java.data.analyses.length > 0 && (
            <ul className="java-rows">
              {data.java.data.analyses.map((a) => {
                const needed = requiredJava(data.selection.version);
                const fits = a.major !== null && a.major >= needed;
                return (
                  <li key={a.path} className="java-row">
                    <div>
                      <strong>{javaTitle(a)}</strong>
                      <span className="muted small path">{a.path}</span>
                    </div>
                    <span className="row">
                      {a.status !== "compatible" ? (
                        <Badge tone="bad">{a.status === "too-old" ? "Too old for this version" : "Unusable"}</Badge>
                      ) : (
                        <Badge tone={fits ? "good" : "warn"}>{fits ? "Compatible" : `Needs Java ${needed}`}</Badge>
                      )}
                      {draft.javaPath === a.path && <Badge tone="info">Selected</Badge>}
                      <button type="button" className="btn btn-small" onClick={() => edit({ javaPath: a.path })}>
                        Use this
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="muted small">
            Minecraft {data.selection.version} needs Java {requiredJava(data.selection.version)} or newer. An instance can
            use a different Java from its own settings in the Library.
          </p>
        </div>

        <div className="row">
          <button type="button" className="btn" onClick={data.reloadJava} disabled={data.installer.state.phase === "running"}>
            <RefreshArrowIcon /> Refresh detection
          </button>
          {[8, 17, 21].map((major) => (
            <button
              key={major}
              type="button"
              className="btn btn-small"
              onClick={() => data.installer.start(major)}
              disabled={data.installer.state.phase === "running"}
            >
              Install Java {major}
            </button>
          ))}
        </div>
        <JavaInstallPanel installer={data.installer} needed={false} />
      </Card>
      <Card title="JVM options" tone="cyan" icon={<CpuIcon />} description="Extra options passed to Java, after the memory limit.">
        <Field
          id="jvm-args"
          label="Extra JVM options"
          hint="Leave empty unless you know what you need. Separate options with spaces, for example -XX:+UseG1GC."
          error={errors.jvmArgs}
        >
          <input
            id="jvm-args"
            type="text"
            placeholder="-XX:+UseG1GC"
            value={draft.jvmArgs}
            aria-invalid={errors.jvmArgs ? true : undefined}
            onChange={(e) => edit({ jvmArgs: e.target.value })}
          />
        </Field>
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
      <Card title="Game window" icon={<RocketIcon />} description="The size Minecraft opens at.">
        <div className="resolution-row">
          <Field id="window-width" label="Window width" error={errors.windowWidth}>
            <input
              id="window-width"
              type="number"
              inputMode="numeric"
              min={640}
              max={7680}
              step={10}
              value={Number.isFinite(draft.windowWidth) ? draft.windowWidth : ""}
              aria-invalid={errors.windowWidth ? true : undefined}
              onChange={(e) => edit({ windowWidth: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
            />
          </Field>
          <Field id="window-height" label="Window height" error={errors.windowHeight}>
            <input
              id="window-height"
              type="number"
              inputMode="numeric"
              min={480}
              max={7680}
              step={10}
              value={Number.isFinite(draft.windowHeight) ? draft.windowHeight : ""}
              aria-invalid={errors.windowHeight ? true : undefined}
              onChange={(e) => edit({ windowHeight: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
            />
          </Field>
        </div>
        <p className="muted small">Passed to Minecraft as --width and --height. Press F11 in game for fullscreen.</p>
      </Card>
            </>
          )}
          {tab === "account" && (
            <>
      <Card title="Active account" icon={<UserIcon />} description="The account Play signs in with.">
        {data.account.state.phase === "signedIn" ? (
          <div className="settings-account-row">
            <SkinHead uuid={data.account.state.profile.id} name={data.account.state.profile.name} size={44} />
            <div className="account-list-text">
              <strong>{data.account.state.profile.name}</strong>
              <span className="muted small">Microsoft account · connected</span>
            </div>
            <Badge tone="good">Active</Badge>
          </div>
        ) : (
          <p className="muted small">
            {data.account.state.phase === "checking"
              ? "Checking your Microsoft account…"
              : "No Microsoft account is signed in. Offline play works without one."}
          </p>
        )}
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("accounts")}>
            Manage accounts
          </button>
          <button type="button" className="btn" onClick={() => data.account.signIn()}>
            <PlusIcon />
            Add account
          </button>
        </div>
        <p className="muted small">
          Sign-ins are kept in Windows Credential Manager, one entry per account. No token is ever written to the
          settings file or shown here.
        </p>
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
      <Card title="Launcher updates" icon={<DownloadIcon />} description="Checked against the official Cirrus releases on GitHub.">
        <UpdateCheckPanel />
      </Card>
      <Card title="What an update keeps" icon={<InfoIcon />} description="Updating Cirrus never touches your game data.">
        <p className="muted small">
          Accounts, settings, instances, mods, worlds and Java choices live outside the launcher file and are kept when a
          new build replaces it.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => void api.openGithub().catch((e: unknown) => setNotice({ tone: "bad", text: errorMessage(e) }))}
          >
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

      <div className="actions action-bar settings-glass-actions">
        <Button type="submit" variant="primary" size="md" disabled={!dirty} loading={saving} loadingLabel="Saving…" icon={<CheckIcon />}>
          Save settings
        </Button>
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

/** Manual and automatic checking of official Cirrus releases. */
function UpdateCheckPanel() {
  const [state, setState] = useState<{ phase: "idle" | "checking" | "done" | "error"; check?: UpdateCheck; message?: string }>({
    phase: "idle",
  });

  const check = () => {
    setState({ phase: "checking" });
    void api
      .checkForUpdates()
      .then((result) => setState({ phase: "done", check: result }))
      .catch((e) => setState({ phase: "error", message: errorMessage(e) }));
  };

  useEffect(() => {
    check();
  }, []);

  return (
    <div className="update-panel" aria-live="polite">
      {state.phase === "checking" && (
        <p className="muted small">Checking for a newer Cirrus release…</p>
      )}
      {state.phase === "error" && <p className="error-text">{state.message}</p>}
      {state.phase === "done" && state.check && (
        <>
          <p>
            <strong>v{state.check.current}</strong>
            {state.check.available ? (
              <>
                {" → "}
                <strong>v{state.check.latest} available</strong>
              </>
            ) : (
              <span className="muted"> · you are on the newest release</span>
            )}
          </p>
          {state.check.available && state.check.notes && (
            <details className="update-notes">
              <summary>What changed</summary>
              <p>{state.check.notes}</p>
            </details>
          )}
          {state.check.available && <p className="muted small">{state.check.installMessage}</p>}
          <div className="row">
            <button type="button" className="btn" onClick={check}>
              <RefreshArrowIcon /> Check again
            </button>
            {state.check.available && state.check.pageUrl && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void api.openUpdatePage(state.check!.pageUrl!).catch((e) => setState({ phase: "error", message: errorMessage(e) }))}
              >
                <DownloadIcon /> Open the update
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Back to the normal Windows frame if the Cirrus title bar ever misbehaves. */
function NativeFrameSwitch() {
  const native = useNativeFrame();
  return (
    <label className="check switch">
      <input type="checkbox" checked={native} onChange={(e) => setNativeFrame(e.target.checked)} />
      <span>Use the normal Windows title bar instead of the Cirrus one</span>
    </label>
  );
}

export function SettingsPage({
  data,
  section,
  onNavigate,
  discord,
}: {
  data: AppData;
  section?: string;
  onNavigate: (page: PageId, section?: string) => void;
  discord?: { enabled: boolean; onToggle: () => void };
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
  return <SettingsForm state={s.data} data={data} initialTab={isSettingsTab(section) ? section : "general"} onNavigate={onNavigate} discord={discord} />;
}
