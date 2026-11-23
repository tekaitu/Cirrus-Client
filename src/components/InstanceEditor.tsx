import { useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { FabricLoaderOption, InstanceContents, InstanceView } from "../api/types";
import { INSTANCE_ICONS, iconLabel } from "../core/instances";
import type { AppData } from "../hooks/useAppData";
import { CloseIcon, FolderIcon, CopyStackIcon, TrashIcon, WarningIcon, WrenchIcon } from "./Icons";
import { Spinner } from "./ui";

type Busy = "save" | "repair" | "clone" | "delete" | "loader" | null;

/**
 * Everything that belongs to one instance and nothing else: its name and icon,
 * its Java, its memory, its folder and its launch arguments, plus the copy,
 * repair and delete actions. Nothing here writes to another instance.
 */
export function InstanceEditor({
  instance,
  data,
  onClose,
  onChanged,
}: {
  instance: InstanceView;
  data: AppData;
  onClose: () => void;
  onChanged: (id?: string) => void;
}) {
  const [name, setName] = useState(instance.name);
  const [icon, setIcon] = useState(instance.icon);
  const [javaPath, setJavaPath] = useState<string>(instance.javaPath ?? "");
  const [memory, setMemory] = useState<string>(instance.memoryMb ? String(instance.memoryMb) : "");
  const [gameDir, setGameDir] = useState<string>(instance.customGameDir ? instance.gameDir : "");
  const [jvmArgs, setJvmArgs] = useState(instance.jvmArgs);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "repair" | "clone" | null>(null);
  const [contents, setContents] = useState<InstanceContents | null>(null);
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [cloneName, setCloneName] = useState(`${instance.name} copy`);
  const [cloneData, setCloneData] = useState(true);
  const [loaders, setLoaders] = useState<FabricLoaderOption[] | null>(null);
  const [loaderVersion, setLoaderVersion] = useState(instance.loaderVersion ?? "");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  useEffect(() => {
    if (confirm !== "delete" || contents) return;
    void api
      .instanceContents(instance.id)
      .then(setContents)
      .catch(() => setContents({ worlds: 0, screenshots: 0, mods: 0, resourcePacks: 0 }));
  }, [confirm, contents, instance.id]);

  useEffect(() => {
    if (confirm !== "clone" && instance.loader !== "fabric") return;
    if (loaders) return;
    let alive = true;
    void api
      .fabricLoaderVersions(instance.minecraft)
      .then((list) => alive && setLoaders(list))
      .catch(() => alive && setLoaders([]));
    return () => {
      alive = false;
    };
  }, [confirm, instance.loader, instance.minecraft, loaders]);

  const javaChoices = data.java.status === "ready" ? data.java.data.analyses.filter((a) => a.status === "compatible") : [];
  const needed = instance.javaMajor;
  const settings = data.settings.status === "ready" ? data.settings.data : null;

  const save = () => {
    setError(null);
    setNotice(null);
    const memoryValue = memory.trim() === "" ? null : Number(memory);
    if (memoryValue !== null && (!Number.isFinite(memoryValue) || memoryValue < 512)) {
      setError("Memory must be at least 512 MB, or left empty to use the launcher default.");
      return;
    }
    setBusy("save");
    void api
      .saveInstance({
        id: instance.id,
        minecraft: instance.minecraft,
        loader: instance.loader,
        loaderVersion: instance.loaderVersion,
        name: name.trim(),
        icon,
        javaPath: javaPath || null,
        memoryMb: memoryValue,
        gameDir: gameDir.trim() || null,
        jvmArgs,
        lastPlayed: instance.lastPlayed,
        clonedFrom: instance.clonedFrom,
      })
      .then((saved) => {
        setNotice("Saved. This instance is set up exactly as shown.");
        onChanged(saved.id);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setBusy(null));
  };

  const repair = () => {
    setConfirm(null);
    setBusy("repair");
    setError(null);
    setNotice(null);
    void api
      .repairInstance(instance.id)
      .then((r) => {
        if (r.status === "installed") {
          setNotice("Game files checked. Anything missing or damaged was downloaded again; worlds and mods were left alone.");
          onChanged();
        } else {
          setError(r.message ?? "The files could not be repaired.");
        }
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setBusy(null));
  };

  const clone = () => {
    setBusy("clone");
    setError(null);
    setNotice(null);
    void api
      .cloneInstance(instance.id, cloneName.trim() || `${instance.name} copy`, cloneData)
      .then(() => {
        setConfirm(null);
        setNotice("Copy created. It has its own settings and folder.");
        onChanged();
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setBusy(null));
  };

  const remove = () => {
    setBusy("delete");
    setError(null);
    void api
      .deleteInstance(instance.id, deleteFiles)
      .then(() => {
        onChanged();
        onClose();
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setBusy(null));
  };

  const switchLoader = () => {
    if (!loaderVersion || loaderVersion === instance.loaderVersion) return;
    setBusy("loader");
    setError(null);
    setNotice(null);
    void api
      .switchFabricLoader(instance.id, loaderVersion)
      .then((r) => {
        if (r.status === "installed") {
          setNotice(`Fabric Loader ${loaderVersion} is installed. Your worlds and mods stay with the instance.`);
          onChanged();
        } else {
          setError(r.message ?? "The loader could not be changed.");
        }
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setBusy(null));
  };

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal instance-modal" role="dialog" aria-modal="true" aria-label={`${instance.name} settings`}>
        <header className="instance-head">
          <div>
            <p className="eyebrow">
              {instance.minecraft} · {instance.loader === "fabric" ? `Fabric ${instance.loaderVersion ?? ""}`.trim() : "Vanilla"}
            </p>
            <h2 className="modal-title">Instance settings</h2>
            <p className="muted small">These choices apply to this instance only.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close instance settings" onClick={onClose} disabled={!!busy}>
            <CloseIcon />
          </button>
        </header>

        <div className="instance-form">
          <label className="field">
            <span>Name</span>
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="field">
            <span>Icon</span>
            <div className="icon-picker" role="radiogroup" aria-label="Instance icon">
              {INSTANCE_ICONS.map((choice, i) => (
                <button
                  key={choice.label}
                  type="button"
                  role="radio"
                  aria-checked={icon === i}
                  aria-label={choice.label}
                  title={choice.label}
                  className={`icon-choice ${icon === i ? "is-on" : ""}`}
                  onClick={() => setIcon(i)}
                >
                  <span aria-hidden="true">{choice.glyph}</span>
                </button>
              ))}
            </div>
            <small className="muted">Currently: {iconLabel(icon)}</small>
          </div>

          <label className="field">
            <span>Java</span>
            <select value={javaPath} onChange={(e) => setJavaPath(e.target.value)}>
              <option value="">Automatic (the launcher's Java)</option>
              {javaChoices.map((j) => (
                <option key={j.path} value={j.path}>
                  Java {j.major ?? "?"} — {j.path}
                </option>
              ))}
            </select>
            <small className="muted">
              {needed ? `Minecraft ${instance.minecraft} needs Java ${needed} or newer. ` : ""}
              {javaChoices.length === 0
                ? "No compatible Java is detected yet. Install one from Settings › Java."
                : `${javaChoices.length} compatible Java ${javaChoices.length === 1 ? "install" : "installs"} found.`}
            </small>
          </label>

          <label className="field">
            <span>Memory (MB)</span>
            <input
              type="number"
              min={512}
              max={settings?.maxMemoryMb ?? 32768}
              step={512}
              placeholder={settings ? String(settings.settings.memoryMb) : "Launcher default"}
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
            />
            <small className="muted">
              Empty uses the launcher-wide value{settings ? ` (${settings.settings.memoryMb} MB)` : ""}. This machine has{" "}
              {settings ? `${settings.totalRamMb} MB` : "an unknown amount of"} RAM.
            </small>
          </label>

          <label className="field">
            <span>Game folder</span>
            <input
              value={gameDir}
              placeholder={instance.gameDir}
              spellCheck={false}
              onChange={(e) => setGameDir(e.target.value)}
            />
            <small className="muted">
              Empty keeps this instance's own folder. A custom folder must be an absolute path; worlds already there are
              used, never moved.
            </small>
          </label>

          <label className="field field-wide">
            <span>Extra launch arguments</span>
            <input
              value={jvmArgs}
              placeholder="-XX:+UseG1GC"
              spellCheck={false}
              onChange={(e) => setJvmArgs(e.target.value)}
            />
            <small className="muted">Added after the memory limit. Leave empty if you are not sure.</small>
          </label>

          {instance.loader === "fabric" && (
            <div className="field field-wide">
              <span>Fabric Loader</span>
              <div className="row">
                <select value={loaderVersion} onChange={(e) => setLoaderVersion(e.target.value)}>
                  {!loaders && <option value={instance.loaderVersion ?? ""}>{instance.loaderVersion ?? "Loading…"}</option>}
                  {(loaders ?? []).map((l) => (
                    <option key={l.version} value={l.version}>
                      {l.version}
                      {l.stable ? " (stable)" : " (beta)"}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn"
                  onClick={switchLoader}
                  disabled={busy !== null || !loaderVersion || loaderVersion === instance.loaderVersion}
                >
                  {busy === "loader" ? <Spinner label="Changing loader" /> : "Change loader"}
                </button>
              </div>
              <small className="muted">Changing the loader keeps this instance's worlds and mods.</small>
            </div>
          )}

          {error && (
            <p className="error-text field-wide" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="notice-text field-wide" role="status">
              {notice}
            </p>
          )}

          <div className="row instance-actions field-wide">
            <button type="button" className="btn" onClick={() => void api.openInstanceFolder(instance.id).catch((e) => setError(errorMessage(e)))}>
              <FolderIcon /> Open folder
            </button>
            <button type="button" className="btn" onClick={() => setConfirm("repair")} disabled={!!busy}>
              <WrenchIcon /> Repair
            </button>
            <button type="button" className="btn" onClick={() => setConfirm("clone")} disabled={!!busy}>
              <CopyStackIcon /> Duplicate
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirm("delete")} disabled={!!busy}>
              <TrashIcon /> Delete
            </button>
            <button type="button" className="btn btn-primary push-right" onClick={save} disabled={!!busy || !name.trim()}>
              {busy === "save" ? <Spinner label="Saving" /> : "Save"}
            </button>
          </div>
        </div>

        {confirm && (
          <div className="confirm-panel" role="group" aria-label={`Confirm ${confirm}`}>
            {confirm === "repair" && (
              <>
                <h3>Repair this instance?</h3>
                <p className="muted small">
                  Maple checks Minecraft's own files for {instance.minecraft} and downloads anything missing or damaged.
                  Worlds, saves, screenshots, mods and settings are not touched — the files are only read.
                </p>
                <div className="row">
                  <button type="button" className="btn" onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={repair} disabled={!!busy}>
                    {busy === "repair" ? <Spinner label="Repairing" /> : "Repair files"}
                  </button>
                </div>
              </>
            )}
            {confirm === "clone" && (
              <>
                <h3>Duplicate this instance</h3>
                <label className="field">
                  <span>Name for the copy</span>
                  <input value={cloneName} maxLength={40} onChange={(e) => setCloneName(e.target.value)} />
                </label>
                <label className="check-row">
                  <input type="checkbox" checked={cloneData} onChange={(e) => setCloneData(e.target.checked)} />
                  <span>
                    Copy worlds, mods, settings and screenshots into the copy's own folder. Without this the copy starts
                    empty and shares nothing with the original.
                  </span>
                </label>
                <div className="row">
                  <button type="button" className="btn" onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={clone} disabled={!!busy || !cloneName.trim()}>
                    {busy === "clone" ? <Spinner label="Copying" /> : "Create copy"}
                  </button>
                </div>
              </>
            )}
            {confirm === "delete" && (
              <>
                <h3>
                  <WarningIcon /> Delete {instance.name}?
                </h3>
                <p className="muted small">
                  The instance is removed from the Library{deleteFiles ? " and its folder is deleted" : ""}. Other instances
                  are never touched.
                </p>
                <label className="check-row">
                  <input type="checkbox" checked={deleteFiles} onChange={(e) => setDeleteFiles(e.target.checked)} />
                  <span>
                    Also delete its folder
                    {contents
                      ? contents.worlds + contents.mods + contents.screenshots > 0
                        ? " — this removes " +
                          [
                            contents.worlds ? `${contents.worlds} world${contents.worlds === 1 ? "" : "s"}` : null,
                            contents.mods ? `${contents.mods} mod${contents.mods === 1 ? "" : "s"}` : null,
                            contents.screenshots ? `${contents.screenshots} screenshot${contents.screenshots === 1 ? "" : "s"}` : null,
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : ""
                      : ""}
                    . Leave this off to keep them on disk.
                  </span>
                </label>
                <div className="row">
                  <button type="button" className="btn" onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-danger" onClick={remove} disabled={!!busy}>
                    {busy === "delete" ? <Spinner label="Deleting" /> : "Delete instance"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
