import { describe, expect, it } from "vitest";
import { linkLine, runs } from "./copy";

// Dec 1 2026, noon in New York.
const expires = Date.UTC(2026, 11, 1, 17);

describe("live bar copy", () => {
  it("shows runs left and the link's end date", () => {
    expect(linkLine({ name: "Test", runsLeft: 6, expires }, false)).toBe("Prepared for Test. 6 live runs left, until Dec 1.");
  });

  it("keeps a pause apart from the link's end date", () => {
    const line = linkLine({ name: "Test", runsLeft: 6, expires }, true);
    expect(line).toBe("Prepared for Test. Live runs are paused for now. This link works until Dec 1.");
    expect(line).not.toMatch(/\.,|paused[^.]*until/);
  });

  it("says run for one", () => {
    expect(runs(1)).toBe("1 live run left");
  });
});
