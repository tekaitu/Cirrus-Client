import { describe, expect, it } from "vitest";
import { IDLE, formatBytes, progressView, stateFromResult } from "../src/core/installer";
import type { InstallResult } from "../src/api/types";

const base: InstallResult = {
  status: "installed",
  message: null,
  javaPath: "C:\\x\\java.exe",
  version: "21.0.5",
  source: "Limited FPS runtime",
  configured: true,
  settings: null,
};

describe("formatBytes", () => {
  it("formats sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(52_428_800)).toBe("50.0 MB");
    expect(formatBytes(-1)).toBe("unknown");
    expect(formatBytes(Number.NaN)).toBe("unknown");
  });
});

describe("progressView", () => {
  it("computes a percentage while the download size is known", () => {
    const v = progressView({ stage: "downloading", downloaded: 10, total: 40, message: "" });
    expect(v.percent).toBe(25);
    expect(v.canCancel).toBe(true);
  });

  it("is indeterminate when the size is unknown", () => {
    const v = progressView({ stage: "downloading", downloaded: 2048, total: null, message: "" });
    expect(v.percent).toBeNull();
    expect(v.detail).toBe("2 KB downloaded");
  });

  it("never exceeds 100 percent", () => {
    expect(progressView({ stage: "downloading", downloaded: 99, total: 50, message: "" }).percent).toBe(100);
  });

  it("stops offering cancel once the runtime is being tested", () => {
    expect(progressView({ stage: "testing", downloaded: 0, total: null, message: "" }).canCancel).toBe(false);
    expect(progressView({ stage: "extracting", downloaded: 0, total: null, message: "" }).canCancel).toBe(true);
  });
});

describe("stateFromResult", () => {
  it("maps each backend status to a panel state", () => {
    expect(stateFromResult(base).phase).toBe("done");
    expect(stateFromResult({ ...base, status: "alreadyInstalled" }).phase).toBe("done");
    expect(stateFromResult({ ...base, status: "cancelled" }).phase).toBe("cancelled");
    expect(stateFromResult({ ...base, status: "failed", message: "boom" })).toEqual({
      phase: "error",
      message: "boom",
    });
  });

  it("always gives a failure a readable message", () => {
    const s = stateFromResult({ ...base, status: "failed", message: null });
    expect(s.phase === "error" && s.message.length > 0).toBe(true);
    expect(IDLE.phase).toBe("idle");
  });
});
