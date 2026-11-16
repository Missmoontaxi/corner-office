import { describe, expect, it } from "vitest";
import type { Criterion } from "./lib";
import { buildScorecard, scorecardMarkdown, usdPerBrief, type EvalResult } from "./scorecard";

const rubric: Criterion[] = [
  { id: "R1", criterion: "Headline first.", pass_if: "", fail_if: "", check_type: "judge", must_pass: true },
  { id: "R2", criterion: "No invented numbers.", pass_if: "", fail_if: "", check_type: "code", must_pass: true },
  { id: "R7", criterion: "Short | sweet.", pass_if: "", fail_if: "", check_type: "code+judge", must_pass: false },
];

const graded = (model: string, c: string, cost: number, pass: Record<string, boolean>): EvalResult => ({
  provider: { id: `corner-office:${model}`, label: model },
  vars: { case_id: c },
  response: { cost },
  gradingResult: { componentResults: Object.entries(pass).map(([metric, p]) => ({ pass: p, assertion: { metric } })) },
});

const results: EvalResult[] = [
  graded("prod", "C01", 0.03, { R1: true, R2: true, R7: true }),
  graded("prod", "C02", 0.05, { R1: false, R2: true, R7: true }),
  graded("cand", "C01", 0.002, { R1: true, R2: true, R7: false }),
  { provider: { id: "x", label: "cand" }, vars: { case_id: "C02" }, error: "Request timed out", gradingResult: null },
];

const sc = buildScorecard(results, rubric, {
  runAt: "2026-11-16T12:00:00.000Z",
  judgesCalibrated: false,
  roleOf: (m) => (m === "prod" ? "primary" : "candidate"),
  judgeOf: (m) => (m === "prod" ? "judge-a" : "judge-b"),
});

describe("buildScorecard", () => {
  it("counts passes over graded cases and names the cases that went ungraded", () => {
    const cand = sc.models.find((m) => m.model === "cand")!;
    expect(cand.graded).toBe(1);
    expect(cand.ungraded).toEqual([{ case: "C02", reason: "timed out" }]);
    expect(cand.criteria.find((c) => c.id === "R7")!.passed).toBe(0);
    expect(sc.models.find((m) => m.model === "prod")!.criteria.find((c) => c.id === "R1")!.passed).toBe(1);
  });

  it("averages cost per brief over answered cases only", () => {
    expect(sc.models.find((m) => m.model === "prod")!.costPerBriefUsd).toBeCloseTo(0.04);
    expect(sc.models.find((m) => m.model === "cand")!.costPerBriefUsd).toBeCloseTo(0.002);
  });

  it("names each model's own judge on judged criteria", () => {
    const by = (m: string, id: string) => sc.models.find((x) => x.model === m)!.criteria.find((c) => c.id === id)!.checkedBy;
    expect(by("prod", "R2")).toBe("code");
    expect(by("prod", "R1")).toBe("judge-a");
    expect(by("cand", "R7")).toBe("code and judge-b");
  });

  it("puts production first and candidates after", () => {
    expect(sc.models.map((m) => `${m.model} ${m.role}`)).toEqual(["prod primary", "cand candidate"]);
  });

  it("reports no cost when a model answered nothing", () => {
    const none = buildScorecard([results[3]!], rubric, { runAt: "x", judgesCalibrated: true, roleOf: () => "candidate", judgeOf: () => "j" });
    expect(none.models[0]!.costPerBriefUsd).toBeNull();
    expect(usdPerBrief(null)).toBe("no answers");
  });
});

describe("scorecardMarkdown", () => {
  const md = scorecardMarkdown(sc);

  it("puts the models side by side with their role and cost per brief", () => {
    expect(md).toContain("| | prod (in production) | cand (candidate) |");
    expect(md).toContain("| Cost per brief, list price | $0.040 | $0.0020 |");
    expect(md).toContain("| Cases graded | 2 of 2 | 1 of 2 |");
  });

  it("lists code-checked rows before judged rows, with the judge in each judged cell", () => {
    expect(md.indexOf("R2 No invented numbers.")).toBeLessThan(md.indexOf("R1 Headline first."));
    expect(md).toContain("| R1 Headline first. **must pass** | 1 of 2, judge-a | 1 of 1, judge-b |");
  });

  it("escapes pipes in criterion labels and names ungraded cases", () => {
    expect(md).toContain("R7 Short \\| sweet.");
    expect(md).toContain("Not graded. cand: C02 timed out.");
    expect(md).toContain("not yet calibrated");
  });
});
