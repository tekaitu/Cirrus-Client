import { useState } from "react";
import { api, errorMessage } from "../api/client";
import { CubeIcon, FolderIcon, JavaIcon, MemoryIcon } from "./Icons";
import { Card, Skeleton } from "./ui";
import { formatMemory } from "../core/format";
import { javaTitle } from "./JavaStatus";
import type { AppData } from "../hooks/useAppData";
import type { PageId } from "./Navigation";

const MEMORY_PRESETS_MB = [2048, 4096, 6144, 8192];

/**
 * Memory, Java and game folder at a glance. Every value is the real setting the
 * game is started with; memory changes are saved at once, while Java and the
 * folder lead to the Settings section that owns them.
 */
export function LaunchConfig({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId, section?: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const settings = data.settings.status === "ready" ? data.settings.data : null;
  const java = data.java.status === "ready" ? data.java.data.selected : null;

  const setMemory = async (mb: number) => {
    if (!settings || saving) return;
    setSaving(true);
    setError(null);
    try {
      const outcome = await api.saveSettings({ ...settings.settings, memoryMb: mb });
      if (outcome.ok && outcome.state) data.applySettings(outcome.state);
      else setError(outcome.errors[0]?.message ?? "The memory setting was not saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="play-config" id="launch-config" title="Launch configuration" icon={<CubeIcon />} description="What the game starts with.">
      {!settings ? (
        <Skeleton label="Loading launch settings" lines={3} />
      ) : (
        <dl className="config-list">
          <div>
            <dt>
              <MemoryIcon /> Memory
            </dt>
            <dd>
              <strong>{formatMemory(settings.settings.memoryMb)}</strong>
              <span className="muted small"> of {formatMemory(settings.totalRamMb)} installed</span>
              <div className="presets" role="group" aria-label="Memory for the game">
                {MEMORY_PRESETS_MB.filter((mb) => mb >= settings.minMemoryMb && mb <= settings.maxMemoryMb).map((mb) => (
                  <button
                    key={mb}
                    type="button"
                    className={`chip ${settings.settings.memoryMb === mb ? "chip-on" : ""}`}
                    aria-pressed={settings.settings.memoryMb === mb}
                    disabled={saving}
                    onClick={() => void setMemory(mb)}
                  >
                    {mb / 1024} GB
                  </button>
                ))}
              </div>
            </dd>
          </div>
          <div>
            <dt>
              <JavaIcon /> Java
            </dt>
            <dd>
              {java ? <strong>{javaTitle(java)}</strong> : <span className="muted">Not found yet. Set up &amp; play installs it.</span>}
              <button type="button" className="link-inline" onClick={() => onNavigate("settings", "performance")}>
                Change
              </button>
            </dd>
          </div>
          <div>
            <dt>
              <FolderIcon /> Game folder
            </dt>
            <dd>
              <span className="path">{settings.settings.gameDir}</span>
              <button type="button" className="link-inline" onClick={() => onNavigate("settings", "folder")}>
                Change
              </button>
            </dd>
          </div>
        </dl>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
