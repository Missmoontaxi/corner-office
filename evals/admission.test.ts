import path from "node:path";
import { describe, expect, it } from "vitest";
import { admitToCompare, loadAdmissionPolicy, verdictText, type AdmissionPolicy, type CaseResult } from "./admission";

const policy: AdmissionPolicy = { version: "test", compare: { every_case_answers: true, must_pass: ["R1", "R2", "R8"], max_cases_missing: 2 } };

const graded = (model: string, c: string, pass: Record<string, boolean>): CaseResult => ({
  provider: { id: `corner-office:${model}`, label: model },
  vars: { case_id: c },
  gradingResult: { componentResults: Object.entries(pass).map(([metric, p]) => ({ pass: p, assertion: { metric } })) },
});
const allPass = { R1: true, R2: true, R8: true, R5: false };
const cases = ["C01", "C02", "C03", "C04", "C05"];
const run = (model: string, overrides: Record<string, Record<string, boolean> | null> = {}): CaseResult[] =>
  cases.map((c) =>
    overrides[c] === null ? { provider: { id: model, label: model }, vars: { case_id: c }, gradingResult: null } : graded(model, c, { ...allPass, ...overrides[c] }),
  );

describe("admitToCompare", () => {
  it("passes a model that clears every must-pass criterion on every case, whatever the other criteria say", () => {
    const v = admitToCompare(run("cand"), "cand", policy);
    expect(v.pass).toBe(true);
    expect(v.thresholds.find((t) => t.id === "must-pass")!.actual).toBe("5 of 5");
  });

  it("allows up to the policy's number of cases missing a must-pass criterion", () => {
    expect(admitToCompare(run("cand", { C01: { R1: false }, C02: { R8: false } }), "cand", policy).pass).toBe(true);
    const v = admitToCompare(run("cand", { C01: { R1: false }, C02: { R8: false }, C03: { R2: false } }), "cand", policy);
    expect(v.pass).toBe(false);
    expect(v.thresholds.find((t) => t.id === "must-pass")).toMatchObject({ pass: false, actual: "2 of 5", required: "at least 3 of 5", cases: ["C01", "C02", "C03"] });
  });

  it("counts one case once even when it misses several criteria", () => {
    const v = admitToCompare(run("cand", { C01: { R1: false, R2: false, R8: false } }), "cand", policy);
    expect(v.thresholds.find((t) => t.id === "must-pass")!.actual).toBe("4 of 5");
    expect(v.pass).toBe(true);
  });

  it("fails the answers threshold on any unanswered case, and counts it as a must-pass miss too", () => {
    const v = admitToCompare(run("cand", { C04: null }), "cand", policy);
    expect(v.thresholds.find((t) => t.id === "answers")).toMatchObject({ pass: false, actual: "4 of 5", cases: ["C04"] });
    expect(v.thresholds.find((t) => t.id === "must-pass")!.cases).toEqual(["C04"]);
    expect(v.pass).toBe(false);
  });

  it("counts a case the candidate never ran, using the cases the other models ran", () => {
    const results = [...run("prod"), ...run("cand").filter((r) => r.vars.case_id !== "C05")];
    const v = admitToCompare(results, "cand", policy);
    expect(v.cases).toBe(5);
    expect(v.thresholds.find((t) => t.id === "answers")).toMatchObject({ pass: false, cases: ["C05"] });
  });

  it("treats a must-pass criterion that was never graded as a miss", () => {
    const results = cases.map((c) => graded("cand", c, c === "C01" ? { R1: true, R2: true } : allPass));
    expect(admitToCompare(results, "cand", policy).thresholds.find((t) => t.id === "must-pass")!.cases).toEqual(["C01"]);
  });

  it("can skip the answers threshold when the policy says so", () => {
    const v = admitToCompare(run("cand", { C04: null }), "cand", { ...policy, compare: { ...policy.compare, every_case_answers: false } });
    expect(v.thresholds.some((t) => t.id === "answers")).toBe(false);
    expect(v.pass).toBe(true);
  });

  it("reports each must-pass criterion on its own without letting those rows decide", () => {
    const v = admitToCompare(run("cand", { C01: { R8: false } }), "cand", policy);
    expect(v.thresholds.find((t) => t.id === "R8")).toMatchObject({ actual: "4 of 5", required: "for reference" });
  });

  it("shows the production model's count on the same run without letting it decide", () => {
    const results = [...run("prod", { C01: { R1: false } }), ...run("cand", { C01: { R1: false }, C02: { R1: false }, C03: { R1: false } })];
    const v = admitToCompare(results, "cand", policy, { incumbent: "prod" });
    expect(v.thresholds.find((t) => t.id === "incumbent")).toMatchObject({ actual: "4 of 5", required: "for reference" });
    expect(v.pass).toBe(false);
    expect(admitToCompare(results, "prod", policy, { incumbent: "prod" }).thresholds.some((t) => t.id === "incumbent")).toBe(false);
  });

  it("refuses a model with no results", () => {
    expect(() => admitToCompare(run("prod"), "cand", policy)).toThrow(/No results for cand/);
  });

  it("prints PASS or FAIL per threshold with the cases that missed", () => {
    const text = verdictText(admitToCompare(run("cand", { C01: null, C02: { R1: false }, C03: { R2: false } }), "cand", policy));
    expect(text).toContain("FAIL  A valid brief on every case: 4 of 5, needs 5 of 5 (misses C01)");
    expect(text).toContain("FAIL  R1, R2, R8 all pass: 2 of 5, needs at least 3 of 5 (misses C01, C02, C03)");
    expect(text).toContain("R1 on its own: 3 of 5");
    expect(text).toContain("It stays out of Compare.");
  });
});

describe("admission.yaml", () => {
  it("loads and validates the committed policy", () => {
    const p = loadAdmissionPolicy(path.join(__dirname, "..", "lib", "engine", "policy"));
    expect(p.compare.must_pass.length).toBeGreaterThan(0);
    expect(p.compare.max_cases_missing).toBeGreaterThanOrEqual(0);
  });
});
