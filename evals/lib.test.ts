import { describe, expect, it } from "vitest";
import { parseCsv } from "./lib";
import { factPresent } from "../scripts/eval-check-days";

describe("parseCsv", () => {
  it("reads quoted fields with commas, doubled quotes and newlines", () => {
    const rows = parseCsv('case_id,day_brief\nD07,"Board moved, CFO says ""2.3""\nsecond line"\n\n');
    expect(rows).toEqual([{ case_id: "D07", day_brief: 'Board moved, CFO says "2.3"\nsecond line' }]);
  });
  it("lowercases headers and skips blank rows", () => {
    expect(parseCsv("Case_ID,Max_Words\r\nD01,250\r\n,\r\n")).toEqual([{ case_id: "D01", max_words: "250" }]);
  });
});

describe("factPresent", () => {
  const day = "Board meeting moved from Friday to Thursday. Burn multiple 2.3 per the CFO. Lunch with the CIO overlaps board prep.";
  it("finds a fact by its numbers and most of its words", () => {
    expect(factPresent("board moved to Thursday", day).ok).toBe(true);
    expect(factPresent("burn multiple 2.3", day).ok).toBe(true);
  });
  it("misses a fact whose number is absent", () => {
    expect(factPresent("burn multiple 2.4", day)).toEqual({ ok: false, missing: ["2.4"] });
  });
  it("misses a fact whose words are mostly absent", () => {
    expect(factPresent("VP Operations offer deadline", day).ok).toBe(false);
  });
});
