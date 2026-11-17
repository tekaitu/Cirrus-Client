import { describe, expect, it } from "vitest";
import { formatElapsed, formatRemaining, formatSpeed, gameInstallView } from "../src/core/installProgress";

const START = 1_000_000;

describe("gameInstallView", () => {
  it("uses bytes for the percentage when the backend knows every size", () => {
    const view = gameInstallView(
      { stage: "downloading", done: 2, total: 10, bytesDone: 25_000_000, bytesTotal: 100_000_000, message: "Downloading game files (2 of 10)" },
      START,
      START + 5000,
    );
    expect(view.percent).toBe(25);
    expect(view.bytesDone).toBe(25_000_000);
    expect(view.bytesTotal).toBe(100_000_000);
    expect(view.stageLabel).toBe("Downloading game files");
    expect(view.canCancel).toBe(true);
  });

  it("falls back to file counts when sizes are unknown, without inventing a speed", () => {
    const view = gameInstallView(
      { stage: "downloading", done: 50, total: 200, message: "Downloading game files (50 of 200)" },
      START,
      START + 8000,
    );
    expect(view.percent).toBe(25);
    expect(view.speed).toBeNull();
    expect(view.remainingSeconds).toBeNull();
  });

  it("reports an average speed and a time left after enough time has passed", () => {
    const view = gameInstallView(
      { stage: "downloading", done: 5, total: 20, bytesDone: 20_000_000, bytesTotal: 100_000_000, message: "" },
      START,
      START + 10_000,
    );
    expect(view.speed).toBe(2_000_000);
    expect(view.remainingSeconds).toBe(40);
  });

  it("shows no speed during the first moment, so it cannot look wrong", () => {
    const view = gameInstallView(
      { stage: "downloading", done: 1, total: 20, bytesDone: 900_000, bytesTotal: 100_000_000, message: "" },
      START,
      START + 500,
    );
    expect(view.speed).toBeNull();
    expect(view.remainingSeconds).toBeNull();
  });

  it("is indeterminate before the first progress event", () => {
    const view = gameInstallView(null, START, START + 3000);
    expect(view.percent).toBeNull();
    expect(view.stage).toBe("preparing");
    expect(view.elapsedSeconds).toBe(3);
  });

  it("does not offer to cancel while the last step is being written", () => {
    const view = gameInstallView(
      { stage: "finishing", done: 0, total: 0, message: "Finishing…" },
      START,
      START + 1000,
    );
    expect(view.canCancel).toBe(false);
    expect(view.stageLabel).toBe("Finishing up");
  });

  it("never reports more than 100 percent", () => {
    const view = gameInstallView(
      { stage: "downloading", done: 10, total: 10, bytesDone: 120, bytesTotal: 100, message: "" },
      START,
      START + 2000,
    );
    expect(view.percent).toBe(100);
  });
});

describe("formatting progress", () => {
  it("formats a speed with the installer's own sizes", () => {
    expect(formatSpeed(2_000_000)).toBe("1.9 MB/s");
    expect(formatSpeed(0)).toBe("0 B/s");
  });

  it("formats a time left in a readable way", () => {
    expect(formatRemaining(null)).toBeNull();
    expect(formatRemaining(5)).toBe("less than 10 s left");
    expect(formatRemaining(42)).toBe("about 42 s left");
    expect(formatRemaining(150)).toBe("about 3 min left");
    expect(formatRemaining(3900)).toBe("about 1 hr 5 min left");
    expect(formatRemaining(7200)).toBe("about 2 hr left");
  });

  it("formats the elapsed time", () => {
    expect(formatElapsed(0)).toBe("0s");
    expect(formatElapsed(64)).toBe("1m 04s");
    expect(formatElapsed(3661)).toBe("1h 01m");
  });
});
