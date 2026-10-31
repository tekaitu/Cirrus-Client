import { describe, expect, it } from "vitest";
import { checkJava, parseJavaMajor, REQUIRED_JAVA_MAJOR } from "../src/core/java";

describe("parseJavaMajor", () => {
  it("parses modern version strings", () => {
    expect(parseJavaMajor('openjdk version "21.0.4" 2024-07-16')).toBe(21);
    expect(parseJavaMajor('openjdk version "17" 2021-09-14')).toBe(17);
  });
  it("parses legacy 1.x version strings", () => {
    expect(parseJavaMajor('java version "1.8.0_392"')).toBe(8);
  });
  it("returns null for unrelated text", () => {
    expect(parseJavaMajor("command not found")).toBeNull();
    expect(parseJavaMajor("")).toBeNull();
  });
});

describe("checkJava", () => {
  it("accepts the required major version and newer", () => {
    expect(checkJava(`openjdk version "${REQUIRED_JAVA_MAJOR}.0.1"`).ok).toBe(true);
    expect(checkJava('openjdk version "25.0.1"').ok).toBe(true);
  });
  it("rejects older versions with an actionable message", () => {
    const result = checkJava('openjdk version "17.0.9"');
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Java 21");
  });
  it("rejects unreadable output", () => {
    expect(checkJava("garbage").ok).toBe(false);
  });
});
