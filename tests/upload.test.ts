import { describe, expect, it } from "vitest";
import type { ModInspection } from "../src/api/types";
import {
  MAX_UPLOAD_BYTES,
  fileProblem,
  formatBytes,
  groupProblems,
  inspectionLine,
  installSummary,
  needsConfirmation,
} from "../src/core/upload";

const inspection = (over: Partial<ModInspection> = {}): ModInspection => ({
  fileName: "example.jar",
  size: 2 * 1024 * 1024,
  installable: true,
  modId: "example_mod",
  name: "Example",
  version: "1.2.3",
  description: "Does things",
  authors: ["Ana"],
  icon: null,
  minecraft: "1.21.x",
  fabricLoader: ">=0.16",
  java: ">=21",
  dependencies: [],
  duplicateOf: null,
  sameFile: false,
  problems: [],
  ...over,
});

describe("chosen mod files", () => {
  it("accepts a jar and refuses everything else before reading it", () => {
    expect(fileProblem({ name: "sodium.jar", size: 900_000 })).toBeNull();
    expect(fileProblem({ name: "SODIUM.JAR", size: 900_000 })).toBeNull();
    expect(fileProblem({ name: "sodium.zip", size: 900_000 })).toMatch(/not a \.jar/);
    expect(fileProblem({ name: "sodium.jar", size: 0 })).toMatch(/empty/);
    expect(fileProblem({ name: "huge.jar", size: MAX_UPLOAD_BYTES + 1 })).toMatch(/64 MB/);
  });

  it("splits problems into what blocks and what only warns", () => {
    const groups = groupProblems([
      { severity: "warning", message: "Needs Fabric API" },
      { severity: "error", message: "For Minecraft 1.20" },
      { severity: "warning", message: "Already installed" },
    ]);
    expect(groups.errors).toEqual(["For Minecraft 1.20"]);
    expect(groups.warnings).toEqual(["Needs Fabric API", "Already installed"]);
  });

  it("only asks for a confirmation when something would be replaced", () => {
    expect(needsConfirmation(inspection())).toBe(false);
    expect(needsConfirmation(inspection({ duplicateOf: "example-1.0.jar" }))).toBe(true);
    expect(needsConfirmation(inspection({ sameFile: true }))).toBe(true);
  });

  it("describes the file with its version, id, size and Minecraft range", () => {
    expect(inspectionLine(inspection())).toBe("v1.2.3 · example_mod · 2.0 MB · Minecraft 1.21.x");
    expect(inspectionLine(inspection({ version: null, modId: null, minecraft: null }))).toBe("2.0 MB");
  });

  it("formats sizes the way the rest of the library does", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("install results", () => {
  it("reports a full success only when every file went in", () => {
    const one = installSummary([{ fileName: "a.jar", status: "installed", message: "Installed as a.jar." }]);
    expect(one).toMatchObject({ tone: "good", installed: 1, text: "Installed as a.jar." });
    const two = installSummary([
      { fileName: "a.jar", status: "installed", message: null },
      { fileName: "b.jar", status: "installed", message: null },
    ]);
    expect(two.tone).toBe("good");
    expect(two.text).toContain("2 mods installed");
  });

  it("says exactly what was refused when only some files went in", () => {
    const mixed = installSummary([
      { fileName: "a.jar", status: "installed", message: null },
      { fileName: "b.jar", status: "conflict", message: "already installed" },
    ]);
    expect(mixed.tone).toBe("warn");
    expect(mixed.installed).toBe(1);
    expect(mixed.text).toContain("1 of 2");
    expect(mixed.text).toContain("b.jar: already installed");
  });

  it("never calls a complete failure a success", () => {
    const failed = installSummary([{ fileName: "b.jar", status: "invalid", message: "not a Fabric mod" }]);
    expect(failed.tone).toBe("bad");
    expect(failed.installed).toBe(0);
    expect(failed.text).toContain("Nothing was installed");
    expect(failed.text).toContain("not a Fabric mod");
  });
});
