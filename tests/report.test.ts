import { describe, expect, it } from "vitest";
import { analyzeJava, toJavaView } from "../src/core/java";
import { formatMemory, joinParts } from "../src/core/format";
import { buildReport } from "../src/core/report";
import { appInfo, java17Raw, java21Raw, settingsState, systemInfo } from "./helpers/fixtures";

const generatedAt = new Date("2026-10-31T12:00:00Z");

describe("buildReport", () => {
  const java = toJavaView([analyzeJava(java17Raw), analyzeJava(java21Raw)], 6);
  const report = buildReport({ app: appInfo, system: systemInfo, java, settings: settingsState(), generatedAt });

  it("contains the real data it was given", () => {
    expect(report).toContain("2026-10-31T12:00:00.000Z");
    expect(report).toContain("AMD Ryzen 5 PRO 4650G with Radeon Graphics");
    expect(report).toContain("12 logical, 6 physical");
    expect(report).toContain("[compatible] Java 21");
    expect(report).toContain("[too-old] Java 17");
    expect(report).toContain("Selected: Java 21");
    expect(report).toContain("Memory: 4096 MB");
  });

  it("says plainly that launching is not implemented", () => {
    expect(report).toContain("launching not implemented yet");
  });

  it("marks missing sections as unavailable instead of inventing data", () => {
    const empty = buildReport({ app: null, system: null, java: null, settings: null, generatedAt });
    expect(empty.match(/unavailable/g)?.length).toBe(4);
  });

  it("says when no compatible Java exists", () => {
    const none = buildReport({
      app: appInfo,
      system: systemInfo,
      java: toJavaView([analyzeJava(java17Raw)], 3),
      settings: settingsState(),
      generatedAt,
    });
    expect(none).toContain("none (no compatible Java)");
  });
});

describe("format helpers", () => {
  it("formats memory sizes", () => {
    expect(formatMemory(512)).toBe("512 MB");
    expect(formatMemory(4096)).toBe("4 GB");
    expect(formatMemory(1536)).toBe("1.5 GB");
    expect(formatMemory(-1)).toBe("unknown");
    expect(formatMemory(Number.NaN)).toBe("unknown");
  });

  it("joins only the parts that have content", () => {
    expect(joinParts(["a", null, "", "  ", "b"])).toBe("a · b");
    expect(joinParts([undefined], ", ")).toBe("");
  });
});
