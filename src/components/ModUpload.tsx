import { useRef, useState, type DragEvent } from "react";
import { api, errorMessage } from "../api/client";
import type { ModInspection } from "../api/types";
import { notify } from "../core/notifications";
import {
  fileProblem,
  formatBytes,
  groupProblems,
  installSummary,
  inspectionLine,
  needsConfirmation,
  readBase64,
} from "../core/upload";
import { UploadIcon } from "./Icons";
import { Banner, Card } from "./ui";

type FileState = "inspecting" | "ready" | "installing" | "installed" | "failed";

interface ChosenFile {
  key: string;
  file: File;
  /** The file itself, as base64, read once while it is inspected. */
  data: string | null;
  inspection: ModInspection | null;
  /** Why the file could not even be read. */
  readError: string | null;
  /** The person agreed to replace an existing mod or file. */
  overwrite: boolean;
  state: FileState;
  /** What the backend said when it refused or failed. */
  message: string | null;
}

let nextKey = 0;

function fromFile(file: File): ChosenFile {
  nextKey += 1;
  return {
    key: `upload-${nextKey}`,
    file,
    data: null,
    inspection: null,
    readError: null,
    overwrite: false,
    state: "inspecting",
    message: null,
  };
}

/**
 * Local mod uploads.
 *
 * Chosen jars are inspected before anything is written, shown with what they
 * are and what is wrong with them, and only installed when the person presses
 * Install. A file that is not a usable Fabric mod is never installed, and a mod
 * that is already there is only replaced after an explicit tick.
 */
export function ModUpload({
  version,
  profileId,
  fabricReady,
  onInstalled,
}: {
  version: string;
  profileId?: string;
  fabricReady: boolean;
  /** Called after a successful install so the installed list can refresh. */
  onInstalled: () => void | Promise<void>;
}) {
  const [files, setFiles] = useState<ChosenFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "bad" | "warn"; text: string } | null>(null);
  const [dropping, setDropping] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: string, changes: Partial<ChosenFile>) =>
    setFiles((list) => list.map((entry) => (entry.key === key ? { ...entry, ...changes } : entry)));

  const inspect = async (entry: ChosenFile) => {
    const problem = fileProblem(entry.file);
    if (problem) {
      patch(entry.key, { readError: problem, state: "failed" });
      return;
    }
    try {
      const data = await readBase64(entry.file);
      patch(entry.key, { data });
      const inspection = await api.inspectModFile(entry.file.name, data, version, profileId);
      patch(entry.key, { inspection, state: "ready" });
    } catch (e) {
      patch(entry.key, { readError: errorMessage(e), state: "failed" });
    }
  };

  const add = (selected: FileList | File[]) => {
    const list = Array.from(selected);
    if (list.length === 0) return;
    const chosen = list.map(fromFile);
    setFiles((current) => [...current, ...chosen]);
    setNotice(null);
    for (const entry of chosen) void inspect(entry);
  };

  const onPick = (picked: FileList | null) => {
    if (!picked) return;
    add(picked);
    if (input.current) input.current.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropping(false);
    if (e.dataTransfer.files?.length) add(e.dataTransfer.files);
  };

  const clear = () => {
    setFiles([]);
    setNotice(null);
    setProgress(null);
  };

  const removeOne = (key: string) => setFiles((list) => list.filter((entry) => entry.key !== key));

  const installable = files.filter((entry) => entry.inspection?.installable && entry.data);
  const blocked = files.filter((entry) => entry.inspection && !entry.inspection.installable);

  const install = async () => {
    if (installable.length === 0) return;
    setBusy(true);
    setNotice(null);
    const results: Array<{ fileName: string; status: string; message: string | null }> = [];
    let done = 0;
    setProgress({ done, total: installable.length });
    for (const entry of installable) {
      const inspection = entry.inspection as ModInspection;
      const confirmed = !needsConfirmation(inspection) || entry.overwrite;
      if (!confirmed) {
        results.push({
          fileName: entry.file.name,
          status: "conflict",
          message: "already installed; tick Replace to install this copy",
        });
        done += 1;
        setProgress({ done, total: installable.length });
        continue;
      }
      patch(entry.key, { state: "installing", message: null });
      try {
        const outcome = await api.installUploadedMod(
          entry.file.name,
          entry.data as string,
          version,
          profileId,
          entry.overwrite,
        );
        results.push({ fileName: entry.file.name, status: outcome.status, message: outcome.message });
        patch(entry.key, {
          state: outcome.status === "installed" ? "installed" : "failed",
          message: outcome.message,
        });
      } catch (e) {
        const message = errorMessage(e);
        results.push({ fileName: entry.file.name, status: "failed", message });
        patch(entry.key, { state: "failed", message });
      }
      done += 1;
      setProgress({ done, total: installable.length });
    }

    const summary = installSummary(results);
    setNotice({ tone: summary.tone === "warn" ? "warn" : summary.tone, text: summary.text });
    if (summary.installed > 0) {
      notify({
        title: summary.installed === 1 ? "Mod installed" : `${summary.installed} mods installed`,
        body: `Minecraft ${version}`,
        tone: "good",
      });
      await onInstalled();
      // Files that went in are no longer part of the pending list.
      setFiles((list) => list.filter((entry) => entry.state !== "installed"));
    }
    setBusy(false);
    setProgress(null);
  };

  return (
    <Card
      id="mod-upload"
      title="Upload mods"
      icon={<UploadIcon />}
      description="Install .jar mods you already have. Each file is checked before anything is written."
    >
      <div
        className={`upload-drop ${dropping ? "is-dropping" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
      >
        <span className="upload-drop-icon" aria-hidden="true">
          <UploadIcon />
        </span>
        <div className="upload-drop-text">
          <strong>Choose .jar files</strong>
          <span className="muted small">or drop them here · several mods at once is fine</span>
        </div>
        <button
          type="button"
          className="btn btn-small"
          disabled={!fabricReady || busy}
          onClick={() => input.current?.click()}
        >
          Browse files
        </button>
        <input
          ref={input}
          type="file"
          accept=".jar,application/java-archive"
          multiple
          aria-label="Mod files"
          className="visually-hidden"
          tabIndex={-1}
          onChange={(e) => onPick(e.target.files)}
        />
      </div>

      {!fabricReady && (
        <p className="muted small">Install Minecraft {version} with Fabric first, then you can add your own mods.</p>
      )}

      {notice && (
        <Banner
          tone={notice.tone}
          title={notice.tone === "good" ? "Done" : notice.tone === "warn" ? "Partly done" : "Nothing was installed"}
        >
          {notice.text}
        </Banner>
      )}

      {files.length > 0 && (
        <>
          <ul className="upload-list" aria-label="Chosen files">
            {files.map((entry) => {
              const inspection = entry.inspection;
              const problems = inspection ? groupProblems(inspection.problems) : { errors: [], warnings: [] };
              const title = inspection?.name ?? entry.file.name;
              return (
                <li key={entry.key} className={`upload-item upload-${entry.state}`}>
                  <span className="upload-icon" aria-hidden="true">
                    {inspection?.icon ? (
                      <img src={inspection.icon} alt="" width={36} height={36} />
                    ) : (
                      title.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div className="upload-body">
                    <p className="upload-name">
                      {title}
                      {inspection?.modId && <span className="upload-id muted small"> {inspection.modId}</span>}
                    </p>
                    <p className="muted small">
                      {entry.state === "inspecting" && "Checking the file…"}
                      {entry.state !== "inspecting" && inspection && inspectionLine(inspection)}
                      {entry.state !== "inspecting" && !inspection && formatBytes(entry.file.size)}
                    </p>
                    {entry.readError && (
                      <p className="upload-error" role="alert">
                        {entry.readError}
                      </p>
                    )}
                    {problems.errors.map((text) => (
                      <p key={text} className="upload-error">
                        {text}
                      </p>
                    ))}
                    {problems.warnings.map((text) => (
                      <p key={text} className="upload-warning">
                        {text}
                      </p>
                    ))}
                    {entry.message && entry.state !== "installed" && <p className="upload-warning">{entry.message}</p>}
                    {inspection && needsConfirmation(inspection) && entry.state === "ready" && (
                      <label className="upload-confirm">
                        <input
                          type="checkbox"
                          checked={entry.overwrite}
                          onChange={(e) => patch(entry.key, { overwrite: e.target.checked })}
                        />
                        <span>Replace the copy that is already installed</span>
                      </label>
                    )}
                  </div>
                  <div className="upload-aside">
                    <span className={`upload-state upload-state-${entry.state}`}>
                      {entry.state === "installing" && "Installing…"}
                      {entry.state === "installed" && "Installed"}
                      {entry.state === "failed" && (inspection?.installable === false ? "Not a mod" : "Not installed")}
                      {entry.state === "ready" && !inspection?.installable && "Cannot install"}
                      {entry.state === "ready" && inspection?.installable && "Ready"}
                      {entry.state === "inspecting" && "Checking"}
                    </span>
                    <button
                      type="button"
                      className="link-inline"
                      aria-label={`Remove ${entry.file.name} from the list`}
                      disabled={busy}
                      onClick={() => removeOne(entry.key)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="upload-actions">
            <span className="muted small">
              {installable.length === 1 ? "1 mod ready" : `${installable.length} mods ready`}
              {blocked.length > 0 && ` · ${blocked.length} cannot be installed`}
            </span>
            <div className="upload-buttons">
              <button type="button" className="btn btn-small" disabled={busy} onClick={clear}>
                Clear list
              </button>
              <button
                type="button"
                className="btn btn-primary btn-small"
                disabled={busy || !fabricReady || installable.length === 0}
                onClick={() => void install()}
              >
                <UploadIcon />
                {busy
                  ? progress
                    ? `Installing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
                    : "Installing…"
                  : installable.length === 1
                    ? "Install mod"
                    : `Install ${installable.length} mods`}
              </button>
            </div>
          </div>
          {progress && (
            <div
              className="upload-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              aria-label="Installing mods"
            >
              <span style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
