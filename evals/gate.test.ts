import { describe, expect, it } from "vitest";
import { compare, gateMarkdown, readSide, type Result } from "./gate";

const must = ["R1", "R2"];
const all = ["R1", "R2", "R5"];
const ok = { R1: true, R2: true, R5: true };
const res = (c: string, pass: Record<string, boolean> | null): Result => ({
  provider: { id: "brief", label: "brief" },
  vars: { case_id: c },
  cost: 0.01,
  gradingResult: pass ? { componentResults: Object.entries(pass).map(([metric, p]) => ({ pass: p, assertion: { metric } })) } : null,
});
// One run file per entry. Each run lists every case, with overrides per case.
const side = (...runs: Record<string, Record<string, boolean> | null>[]) =>
  readSide(runs.map((o) => ["C01", "C02", "C03"].map((c) => res(c, c in o ? (o[c] === null ? null : { ...ok, ...o[c] }) : ok))));

describe("compare", () => {
  it("passes when nothing changed", () => {
    expect(compare(side({}), side({}), must)).toMatchObject({ ok: true, regressed: [], unstable: [] });
  });

  it("fails a row main passes on every run and the PR fails by majority", () => {
    const g = compare(side({ C02: { R1: false } }, { C02: { R1: false } }, {}), side({}, {}, {}), must);
    expect(g.ok).toBe(false);
    expect(g.regressed).toEqual([{ id: "C02", row: "R1" }]);
    expect(g.flagged).toEqual(["C02"]);
  });

  it("flags a single-run flip so the workflow reruns it", () => {
    const g = compare(side({ C03: { R2: false } }), side({}), must);
    expect(g).toMatchObject({ ok: false, flagged: ["C03"] });
  });

  it("does not fail a row that main itself splits on, and lists it as unstable", () => {
    // The C04 pattern from #33. Main passes 2 of 3, the PR fails 3 of 3.
    const g = compare(side({ C01: { R1: false } }, { C01: { R1: false } }, { C01: { R1: false } }), side({}, { C01: { R1: false } }, {}), must);
    expect(g.ok).toBe(true);
    expect(g.regressed).toEqual([]);
    expect(g.unstable).toEqual([{ id: "C01", row: "R1" }]);
  });

  it("leaves unstable cases out of the case count check", () => {
    const g = compare(side({ C01: { R1: false } }, { C01: { R1: false } }, { C01: { R1: false } }), side({ C01: { R1: false } }, {}, {}), must);
    expect(g).toMatchObject({ ok: true, prFailed: 0, mainFailed: 0 });
  });

  it("still fails a solid regression on another case when one case is unstable", () => {
    const g = compare(
      side({ C01: { R1: false }, C02: { R2: false } }, { C01: { R1: false }, C02: { R2: false } }, { C01: { R1: false } }),
      side({ C01: { R1: false } }, {}, {}),
      must,
    );
    expect(g.ok).toBe(false);
    expect(g.regressed).toEqual([{ id: "C02", row: "R2" }]);
    expect(g.flagged).toEqual(["C02"]);
  });

  it("treats an ungraded run as failing every row", () => {
    const g = compare(side({ C02: null }), side({}), must);
    expect(g.regressed).toEqual([
      { id: "C02", row: "R1" },
      { id: "C02", row: "R2" },
    ]);
  });

  it("ignores rows that are not must-pass", () => {
    expect(compare(side({ C01: { R5: false } }), side({}), must).ok).toBe(true);
  });
});

describe("gateMarkdown", () => {
  it("names unstable rows with run counts on both sides", () => {
    const pr = side({ C01: { R1: false } }, { C01: { R1: false } }, { C01: { R1: false } });
    const main = side({}, { C01: { R1: false } }, {});
    const md = gateMarkdown(compare(pr, main, must), pr, main, must, all, true);
    expect(md).toContain("## Eval gate passed");
    expect(md).toContain("Unstable on main, so not a regression, C01 R1 (main 2 of 3, this PR 0 of 3)");
    expect(md).toContain("not counting 1 unstable");
  });

  it("names regressions with the PR's run count", () => {
    const pr = side({ C02: { R1: false } }, { C02: { R1: false } }, {});
    const main = side({}, {}, {});
    const md = gateMarkdown(compare(pr, main, must), pr, main, must, all, true);
    expect(md).toContain("## Eval gate failed");
    expect(md).toContain("main passes on every run and this PR fails, C02 R1 (1 of 3 runs)");
    expect(md).not.toContain("Unstable");
  });
});
