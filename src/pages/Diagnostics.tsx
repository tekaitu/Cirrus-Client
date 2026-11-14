import { useMemo, useState } from "react";
import { DiagnosticsIcon, FolderIcon, JavaIcon, MemoryIcon } from "../components/Icons";
import { JavaInstallPanel } from "../components/JavaInstallPanel";
import { JavaStatusBadge, javaTitle } from "../components/JavaStatus";
import { Badge, Banner, Card, Skeleton, Stat } from "../components/ui";
import { formatMemory, joinParts } from "../core/format";
import { REQUIRED_JAVA_MAJOR, TARGET_MINECRAFT_VERSION } from "../core/java";
import { buildReport } from "../core/report";
import type { AppData } from "../hooks/useAppData";
import type { ResourceState } from "../hooks/useResource";

function dataOrNull<T>(r: ResourceState<T>): T | null {
  return r.status === "ready" ? r.data : null;
}

function SystemCard({ data }: { data: AppData }) {
  const s = data.system;
  return (
    <Card title="System" icon={<MemoryIcon />} description="Your PC, read live.">
      {s.status === "loading" && <Skeleton label="Reading system information" lines={4} />}
      {s.status === "error" && (
        <Banner tone="bad" title="System information unavailable">
          {s.message}
        </Banner>
      )}
      {s.status === "ready" && (
        <dl className="stats">
          <Stat
            label="Operating system"
            value={joinParts([s.data.osLongVersion ?? s.data.osName, s.data.osVersion], " ") || "Unknown"}
            hint={joinParts([s.data.arch, s.data.kernelVersion ? `kernel ${s.data.kernelVersion}` : null])}
          />
          <Stat label="Processor" value={s.data.cpuBrand ?? "Unknown"} />
          <Stat
            label="Cores"
            value={`${s.data.cpuLogicalCores} logical`}
            hint={s.data.cpuPhysicalCores ? `${s.data.cpuPhysicalCores} physical` : undefined}
          />
          <Stat
            label="Memory"
            value={formatMemory(s.data.totalRamMb)}
            hint={`${formatMemory(s.data.availableRamMb)} available right now`}
          />
        </dl>
      )}
    </Card>
  );
}

function SearchNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <details className="search-notes">
      <summary>Where Cirrus Client looked ({notes.length})</summary>
      <ul className="notes">
        {notes.map((n, i) => (
          <li key={i} className="muted small">
            {n}
          </li>
        ))}
      </ul>
    </details>
  );
}

function JavaCard({ data }: { data: AppData }) {
  const j = data.java;
  const needsJava = j.status === "ready" && !j.data.selected;
  return (
    <Card
      title="Java installations"
      icon={<JavaIcon />}
      description="Every Java found, in the order Cirrus Client prefers them."
      action={
        <button type="button" className="btn" onClick={data.reloadJava} disabled={j.status === "loading"}>
          {j.status === "loading" ? "Detecting…" : "Detect again"}
        </button>
      }
    >
      {j.status === "loading" && <Skeleton label="Detecting Java" lines={3} />}
      {j.status === "error" && (
        <Banner tone="bad" title="Java detection failed">
          {j.message}
        </Banner>
      )}
      {j.status === "ready" && j.data.analyses.length === 0 && (
        <div className="empty">
          <p>
            <strong>No Java installations found</strong>
          </p>
          <p className="muted">
            Checked {j.data.candidatesChecked} location(s): the Java path in Settings, JAVA_HOME, PATH, common
            install folders and the Minecraft launcher&apos;s own runtimes. Minecraft {TARGET_MINECRAFT_VERSION}{" "}
            needs Java {REQUIRED_JAVA_MAJOR} or newer.
          </p>
        </div>
      )}
      {j.status === "ready" && j.data.selected && (
        <dl className="stats selected-java">
          <Stat
            label="Java in use"
            value={`${javaTitle(j.data.selected)}${j.data.selected.versionString ? ` (${j.data.selected.versionString})` : ""}`}
            hint={j.data.selected.source}
          />
          <Stat label="Executable" value={<span className="path">{j.data.selected.path}</span>} />
        </dl>
      )}
      {j.status === "ready" && j.data.analyses.length > 0 && (
        <>
          <p className="muted">
            {j.data.analyses.length} found, {j.data.candidatesChecked} location(s) checked.{" "}
            {j.data.selected ? (
              <>
                Using <strong>{javaTitle(j.data.selected)}</strong>.
              </>
            ) : (
              <strong>None is compatible with Minecraft {TARGET_MINECRAFT_VERSION}.</strong>
            )}
          </p>
          <ul className="java-list">
            {j.data.analyses.map((a) => (
              <li key={a.path}>
                <div className="java-head">
                  <strong>{javaTitle(a)}</strong>
                  <JavaStatusBadge status={a.status} />
                  <Badge>{a.source}</Badge>
                  {j.data.selected?.path === a.path && <Badge tone="info">In use</Badge>}
                </div>
                <p className="path">{a.path}</p>
                <p className="muted small">
                  {a.status === "compatible"
                    ? joinParts([a.versionString, a.is64Bit === true ? "64-bit" : a.is64Bit === false ? "32-bit" : null, a.runtime])
                    : a.message}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
      {j.status === "ready" && <SearchNotes notes={j.data.notes} />}
      <JavaInstallPanel installer={data.installer} needed={needsJava} />
    </Card>
  );
}

function ReportCard({ data }: { data: AppData }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");
  const loading = [data.app, data.system, data.settings, data.java].some((r) => r.status === "loading");

  const report = useMemo(
    () =>
      buildReport({
        app: dataOrNull(data.app),
        system: dataOrNull(data.system),
        java: dataOrNull(data.java),
        settings: dataOrNull(data.settings),
        generatedAt: new Date(),
      }),
    [data.app, data.system, data.java, data.settings],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <Card
      title="Report"
      icon={<DiagnosticsIcon />}
      description="Copy this when asking for help."
      action={
        <button type="button" className="btn" onClick={() => void copy()} disabled={loading}>
          Copy report
        </button>
      }
    >
      <p className="muted">
        A plain-text summary you can paste when asking for help. It includes file paths from this PC and no
        account information.
      </p>
      {copied === "ok" && <p className="ok-text" role="status">Report copied to the clipboard.</p>}
      {copied === "failed" && (
        <p className="error-text" role="alert">
          Could not use the clipboard. Select the text below and copy it manually.
        </p>
      )}
      <details>
        <summary>Show report text</summary>
        <textarea className="report" readOnly value={report} aria-label="Diagnostics report text" rows={14} />
      </details>
    </Card>
  );
}

function SettingsCard({ data }: { data: AppData }) {
  const s = data.settings;
  return (
    <Card title="Settings file" icon={<FolderIcon />}>
      {s.status === "loading" && <Skeleton label="Loading settings" lines={2} />}
      {s.status === "error" && (
        <Banner tone="bad" title="Settings could not be loaded">
          {s.message}
        </Banner>
      )}
      {s.status === "ready" && (
        <>
          <p className="path">{s.data.filePath}</p>
          <p>
            {s.data.status === "loaded" && <Badge tone="good">Loaded from disk</Badge>}
            {s.data.status === "createdDefaults" && <Badge>Using defaults (nothing saved yet)</Badge>}
            {s.data.status === "recoveredFromCorruption" && <Badge tone="warn">Recovered to defaults</Badge>}
          </p>
          {s.data.message && <p className="muted">{s.data.message}</p>}
        </>
      )}
    </Card>
  );
}

export function DiagnosticsPage({ data }: { data: AppData }) {
  const app = dataOrNull(data.app);
  return (
    <div className="page">
      <header className="page-head">
        <h1>Diagnostics</h1>
        <p className="muted">
          Live results from this PC.
          {app && ` Cirrus Client v${app.version}, target Minecraft ${app.target_minecraft}.`}
        </p>
      </header>
      {data.app.status === "error" && (
        <Banner tone="bad" title="App information unavailable">
          {data.app.message}
        </Banner>
      )}
      <SystemCard data={data} />
      <JavaCard data={data} />
      <SettingsCard data={data} />
      <ReportCard data={data} />
    </div>
  );
}
