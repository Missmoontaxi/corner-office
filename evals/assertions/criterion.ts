// One rubric criterion on one brief, as a promptfoo assertion. The grading itself lives in evals/grade.ts.
import { BriefV1 } from "../../lib/engine/contracts";
import { gradeCriterion } from "../grade";
import { loadCases, loadRubric } from "../lib";

type Ctx = { vars: Record<string, string>; config?: { criterion?: string } };

export async function grade(output: string, context: Ctx) {
  const criterionId = context.config?.criterion;
  const c = loadRubric().find((r) => r.id === criterionId);
  if (!c) return { pass: false, score: 0, reason: `No rubric row for ${criterionId}` };
  const caseRow = loadCases().find((k) => k.case_id === context.vars.case_id);
  if (!caseRow) return { pass: false, score: 0, reason: `No case ${context.vars.case_id}` };

  const parsed = JSON.parse(output) as { model: string; brief: unknown };
  const r = await gradeCriterion(c, caseRow, BriefV1.parse(parsed.brief), parsed.model);
  return { pass: r.pass, score: r.pass ? 1 : 0, reason: r.reason };
}
