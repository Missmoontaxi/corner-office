// One rubric criterion on one brief. Code criteria use the free checks; judged criteria call a judge
// from the other vendor. A criterion marked "code and judge" passes only if both pass.
import { CODE_CHECKS } from "../../lib/engine/checks";
import { BriefV1 } from "../../lib/engine/contracts";
import { judge } from "../../lib/engine/judge";
import { loadCases, loadDay, loadRubric } from "../lib";

type Ctx = { vars: Record<string, string>; config?: { criterion?: string } };

export async function grade(output: string, context: Ctx) {
  const criterionId = context.config?.criterion;
  const c = loadRubric().find((r) => r.id === criterionId);
  if (!c) return { pass: false, score: 0, reason: `No rubric row for ${criterionId}` };
  const caseRow = loadCases().find((k) => k.case_id === context.vars.case_id);
  if (!caseRow) return { pass: false, score: 0, reason: `No case ${context.vars.case_id}` };

  const parsed = JSON.parse(output) as { model: string; brief: unknown };
  const brief = BriefV1.parse(parsed.brief);
  const day = loadDay(caseRow.case_id);
  const reasons: string[] = [];
  let pass = true;

  if (c.check_type.includes("code")) {
    const check = CODE_CHECKS[c.id];
    if (!check) return { pass: false, score: 0, reason: `${c.id} is marked code, but no code check exists for it` };
    const r = check(brief, day, { max_words: caseRow.max_words });
    pass &&= r.passed;
    reasons.push(`code: ${r.detail}`);
  }
  if (c.check_type.includes("judge")) {
    const { case_id: _id, split: _s, day_brief: _d, ...expectations } = caseRow;
    const v = await judge({ criterion: c, expectations, day, brief, judgedModel: parsed.model, client: "ci" });
    pass &&= v.passed;
    reasons.push(`${v.judge}: ${v.reason}`);
  }
  return { pass, score: pass ? 1 : 0, reason: `${c.id} ${pass ? "pass" : "fail"}. ${reasons.join(" | ")}` };
}
