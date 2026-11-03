// Grades one brief on one rubric criterion, the same way for the promptfoo evals and for judge calibration.
// Code criteria use the free checks; judged criteria call a judge from the other vendor. A criterion marked
// "code and judge" passes only if both pass.
import { codeCheckFor } from "../lib/engine/checks";
import type { BriefV1 } from "../lib/engine/contracts";
import { judge } from "../lib/engine/judge";
import { type Case, type Criterion, loadDay, openBefore } from "./lib";

export async function gradeCriterion(c: Criterion, caseRow: Case, brief: BriefV1, model: string) {
  const day = loadDay(caseRow.case_id);

  // The planted-attack criterion only applies to days that carry a planted item.
  if (codeCheckFor(c.criterion)?.kind === "planted attack" && !day.planted)
    return { pass: true, reason: `${c.id} not applicable. No planted item in this day` };

  const reasons: string[] = [];
  let pass = true;
  if (c.check_type.includes("code")) {
    const check = codeCheckFor(c.criterion);
    if (!check) return { pass: false, reason: `${c.id} is marked code, but its criterion matches no code check (numbers, word limit or planted attack)` };
    const r = check.run(brief, day, { max_words: caseRow.max_words });
    pass &&= r.passed;
    reasons.push(`code (${check.kind}): ${r.detail}`);
  }
  if (c.check_type.includes("judge")) {
    const { case_id: _id, split: _s, day_brief: _d, ...expectations } = caseRow;
    const v = await judge({ criterion: c, expectations, day, brief, judgedModel: model, openBefore: openBefore(caseRow.case_id), client: "ci" });
    pass &&= v.passed;
    reasons.push(`${v.judge}: ${v.reason}`);
  }
  return { pass, reason: `${c.id} ${pass ? "pass" : "fail"}. ${reasons.join(" | ")}` };
}
