import { describe, expect, it, vi } from "vitest";
import { createSingleFlight } from "../src/core/singleFlight";

const deferred = () => {
  let resolve: () => void = () => {};
  let reject: (e: unknown) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("single-flight gate", () => {
  it("runs one action at a time and drops the repeats", async () => {
    const gate = createSingleFlight();
    const work = deferred();
    const task = vi.fn(() => work.promise);

    const first = gate.run(task);
    const second = gate.run(task);

    expect(task).toHaveBeenCalledTimes(1);
    expect(gate.busy).toBe(true);
    expect(await second).toBeNull();

    work.resolve();
    await first;
    expect(gate.busy).toBe(false);
  });

  it("opens again when the action fails, so the control is never stuck", async () => {
    const gate = createSingleFlight();
    await expect(gate.run(async () => Promise.reject(new Error("nope")))).rejects.toThrow("nope");
    expect(gate.busy).toBe(false);
    expect(await gate.run(async () => "again")).toBe("again");
  });
});
