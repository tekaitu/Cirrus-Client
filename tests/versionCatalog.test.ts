import { describe, expect, it } from "vitest";
import {
  filterVersions,
  fromReleaseIds,
  groupVersions,
  javaCompatibility,
  optionOf,
  releasedText,
  versionStatus,
} from "../src/core/versionCatalog";

const entry = (id: string, kind: string, supported: boolean, released: string | null = null) => ({
  id,
  kind,
  supported,
  released,
});

describe("groupVersions", () => {
  it("keeps releases and snapshots apart and leaves out older kinds", () => {
    const groups = groupVersions([
      entry("1.21.11", "release", true, "2025-12-02T10:00:00+00:00"),
      entry("25w45a", "snapshot", false, "2025-11-05T10:00:00+00:00"),
      entry("b1.7.3", "old_beta", false),
      entry("1.20.4", "release", false),
    ]);
    expect(groups.releases.map((v) => v.id)).toEqual(["1.21.11", "1.20.4"]);
    expect(groups.snapshots.map((v) => v.id)).toEqual(["25w45a"]);
    expect(groups.releases[0]?.supported).toBe(true);
    expect(groups.releases[1]?.supported).toBe(false);
  });

  it("drops duplicate ids and empty entries", () => {
    const groups = groupVersions([entry("1.21", "release", true), entry("1.21", "release", true), entry("", "release", true)]);
    expect(groups.releases).toHaveLength(1);
  });

  it("builds a release list from an older backend", () => {
    const list = fromReleaseIds(["1.21.11", "1.21.1", "1.21.11"]);
    expect(list.map((v) => v.id)).toEqual(["1.21.11", "1.21.1"]);
    expect(list.every((v) => v.kind === "release" && v.supported)).toBe(true);
  });

  it("treats unknown kinds as other", () => {
    expect(optionOf(entry("x", "weird", false)).kind).toBe("other");
  });
});

describe("versionStatus", () => {
  it("says when the version is ready, missing or unsupported", () => {
    expect(versionStatus(optionOf(entry("1.21", "release", true)), true)).toMatchObject({
      label: "Installed",
      tone: "good",
    });
    expect(versionStatus(optionOf(entry("1.21", "release", true)), false)).toMatchObject({
      label: "Not installed",
      tone: "info",
    });
    expect(versionStatus(optionOf(entry("25w45a", "snapshot", false)), false)).toMatchObject({
      label: "Not supported",
      tone: "warn",
    });
    expect(versionStatus(null, false).tone).toBe("bad");
  });

  it("explains why a snapshot cannot be installed", () => {
    const status = versionStatus(optionOf(entry("25w45a", "snapshot", false)), false);
    expect(status.detail).toMatch(/Snapshots/);
  });
});

describe("releasedText", () => {
  it("shows a readable date, and nothing for a missing or invalid one", () => {
    expect(releasedText(optionOf(entry("1.21", "release", true, "2025-12-02T10:00:00+00:00")))).toMatch(/2025/);
    expect(releasedText(optionOf(entry("1.21", "release", true)))).toBeNull();
    expect(releasedText(optionOf(entry("1.21", "release", true, "not a date")))).toBeNull();
  });
});

describe("filterVersions", () => {
  const groups = groupVersions([
    entry("1.21.11", "release", true),
    entry("1.21", "release", true),
    entry("1.20.4", "release", false),
    entry("25w45a", "snapshot", false),
    entry("24w14a", "snapshot", false),
  ]);

  it("matches version ids without caring about case", () => {
    const filtered = filterVersions(groups, { query: "W45" });
    expect(filtered.releases).toHaveLength(0);
    expect(filtered.snapshots.map((v) => v.id)).toEqual(["25w45a"]);
  });

  it("can show releases or snapshots only", () => {
    expect(filterVersions(groups, { kind: "release" }).snapshots).toHaveLength(0);
    expect(filterVersions(groups, { kind: "snapshot" }).releases).toHaveLength(0);
    expect(filterVersions(groups, { kind: "snapshot" }).snapshots).toHaveLength(2);
  });

  it("returns nothing for a query that matches no version", () => {
    const filtered = filterVersions(groups, { query: "nope" });
    expect(filtered.releases).toHaveLength(0);
    expect(filtered.snapshots).toHaveLength(0);
  });
});

describe("javaCompatibility", () => {
  it("compares only when both numbers are known", () => {
    expect(javaCompatibility(21, 21)).toEqual({ tone: "good", label: "Java 21 required · Java 21 detected" });
    expect(javaCompatibility(21, 17)).toEqual({ tone: "warn", label: "Needs Java 21, but Java 17 is selected" });
    expect(javaCompatibility(null, 21)).toBeNull();
    expect(javaCompatibility(21, null)).toBeNull();
  });
});
