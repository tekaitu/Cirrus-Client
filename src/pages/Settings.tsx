import { useEffect, useState, type ReactNode } from "react";
import { api, errorMessage } from "../api/client";
import type { SettingsState } from "../api/types";
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

function SettingsForm({ state, data }: { state: SettingsState; data: AppData }) {
  const saved = state.settings;
  const limits = { min: state.minMemoryMb, max: state.maxMemoryMb };

  const [draft, setDraft] = useState<Settings>(saved);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [javaTest, setJavaTest] = useState<JavaTest>({ status: "idle" });

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
      className="page"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      <header className="page-head">
        <h1>Settings</h1>
        <p className="muted">Saved on this PC. Memory, Java and game folder are used once launching is implemented.</p>
      </header>

      {state.status === "recoveredFromCorruption" && state.message && (
        <Banner tone="warn" title="Settings were restored to defaults">
          {state.message}
        </Banner>
      )}

      <Card title="Memory">
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
        </Field>
      </Card>

      <Card title="Java">
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

      <Card title="Game folder">
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

      <Card title="Microsoft sign-in">
        <Field
          id="ms-client-id"
          label="Azure application (client) ID"
          hint="Optional. Needed once to turn on Microsoft sign-in. It is an ID, not a secret. See docs/AUTH.md for how to register the app."
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

      <Card title="Interface">
        <label className="check">
          <input
            type="checkbox"
            checked={draft.reduceMotion}
            onChange={(e) => edit({ reduceMotion: e.target.checked })}
          />
          <span>Reduce motion (turns off animations and transitions)</span>
        </label>
      </Card>

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

      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
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
          Discard changes
        </button>
        <button type="button" className="btn btn-quiet" disabled={saving} onClick={() => setConfirmReset(true)}>
          Reset to defaults
        </button>
        {dirty && <span className="muted small">Unsaved changes</span>}
      </div>

      <p className="muted small">Settings file: {state.filePath}</p>
    </form>
  );
}

export function SettingsPage({ data }: { data: AppData }) {
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
  return <SettingsForm state={s.data} data={data} />;
}
