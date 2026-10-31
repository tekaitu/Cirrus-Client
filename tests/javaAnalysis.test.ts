import { describe, expect, it } from "vitest";
import { analyzeJava, selectJava, toJavaView } from "../src/core/java";
import { JAVA_17_OUTPUT, java17Raw, java21Raw } from "./helpers/fixtures";

describe("analyzeJava", () => {
  it("reads version, runtime and bitness from real-looking output", () => {
    const a = analyzeJava(java21Raw);
    expect(a.status).toBe("compatible");
    expect(a.major).toBe(21);
    expect(a.versionString).toBe("21.0.4");
    expect(a.runtime).toContain("Temurin-21.0.4+7");
    expect(a.is64Bit).toBe(true);
    expect(a.path).toBe(java21Raw.path);
  });

  it("flags Java older than 21 with an actionable message", () => {
    const a = analyzeJava(java17Raw);
    expect(a.status).toBe("too-old");
    expect(a.major).toBe(17);
    expect(a.message).toContain("needs Java 21");
  });

  it("reports a file that could not run", () => {
    const a = analyzeJava({ path: "X", source: "PATH", ran: false, output: "", error: "File not found." });
    expect(a.status).toBe("failed");
    expect(a.message).toBe("File not found.");
    expect(a.major).toBeNull();
  });

  it("reports output that is not a Java version", () => {
    const a = analyzeJava({ path: "X", source: "PATH", ran: true, output: "hello", error: null });
    expect(a.status).toBe("unreadable");
  });

  it("detects 32-bit runtimes", () => {
    const a = analyzeJava({
      path: "X",
      source: "PATH",
      ran: true,
      output: JAVA_17_OUTPUT.replace("64-Bit", "32-Bit"),
      error: null,
    });
    expect(a.is64Bit).toBe(false);
  });
});

describe("selectJava / toJavaView", () => {
  const old = analyzeJava(java17Raw);
  const first21 = analyzeJava(java21Raw);
  const second21 = analyzeJava({ ...java21Raw, path: "D:\\other\\java.exe" });

  it("picks the first compatible installation in priority order", () => {
    expect(selectJava([old, first21, second21])?.path).toBe(java21Raw.path);
  });

  it("returns null when nothing is compatible", () => {
    expect(selectJava([old])).toBeNull();
    expect(selectJava([])).toBeNull();
  });

  it("builds the view the UI uses", () => {
    const view = toJavaView([old, first21], 7);
    expect(view.selected?.major).toBe(21);
    expect(view.candidatesChecked).toBe(7);
    expect(view.analyses).toHaveLength(2);
  });
});
