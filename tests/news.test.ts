import { describe, expect, it } from "vitest";
import { NEWS, formatNewsDate } from "../src/content/news";

describe("formatNewsDate", () => {
  it("formats ISO dates without locale or time-zone surprises", () => {
    expect(formatNewsDate("2026-11-01")).toBe("1 Nov 2026");
    expect(formatNewsDate("2026-10-31")).toBe("31 Oct 2026");
  });
  it("leaves unrecognised text unchanged", () => {
    expect(formatNewsDate("soon")).toBe("soon");
    expect(formatNewsDate("2026-13-01")).toBe("2026-13-01");
  });
});

describe("local news content", () => {
  it("has unique ids, titles and bodies, and valid dates", () => {
    expect(new Set(NEWS.map((n) => n.id)).size).toBe(NEWS.length);
    for (const n of NEWS) {
      expect(n.title.length).toBeGreaterThan(0);
      expect(n.body.length).toBeGreaterThan(0);
      if (n.date) expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it("never presents roadmap items or tips as dated announcements", () => {
    for (const n of NEWS.filter((x) => x.kind !== "Update")) expect(n.date).toBeNull();
  });
});
