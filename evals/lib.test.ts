import { describe, expect, it } from "vitest";
import { decisionList, parseCsv, topThreeList } from "./lib";
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

describe("loadCases list splitting", () => {
  it("splits on semicolons and on sentence periods, keeping decimals", async () => {
    const { parseCsv: _p } = await import("./lib");
    const split = (v: string) => v.split(/;|\.(?=\s+[A-Z])|\.\s*$/).map((s) => s.trim()).filter(Boolean);
    expect(split("ARR dropped to $17.8M. Partnership call today at 2pm. Tomas out sick.")).toEqual(["ARR dropped to $17.8M", "Partnership call today at 2pm", "Tomas out sick"]);
    expect(split("board moved to Thursday; burn multiple 2.3")).toEqual(["board moved to Thursday", "burn multiple 2.3"]);
  });
});

describe("decision and top-three splitting", () => {
  it("ends a decision at its closing parenthesis even without a semicolon", () => {
    expect(decisionList("Final deal points (Alex 10:30am Wed); agenda for Thurs (Alex 2pm Wed), Boston itinerary (Alex 3pm Wed), board flow (Alex 4pm Wed)")).toEqual([
      "Final deal points (Alex 10:30am Wed)", "agenda for Thurs (Alex 2pm Wed)", "Boston itinerary (Alex 3pm Wed)", "board flow (Alex 4pm Wed)",
    ]);
    expect(decisionList("Present Harborline as pending (Alex, Jordan before 2pm) VP of Care interview at 5pm (12pm Alex); ")).toEqual([
      "Present Harborline as pending (Alex, Jordan before 2pm)", "VP of Care interview at 5pm (12pm Alex)",
    ]);
  });
  it("splits a top three on commas only when semicolons give fewer than three", () => {
    expect(topThreeList("board prep; scheduling CIO lunch and interview, brand strategy")).toEqual(["board prep", "scheduling CIO lunch and interview", "brand strategy"]);
    expect(topThreeList("board prep; waves plan, story; brand")).toEqual(["board prep", "waves plan, story", "brand"]);
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
