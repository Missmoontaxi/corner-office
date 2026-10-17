// Turns Paula's rubric and cases into promptfoo tests. Each case is one test with one assertion per
// rubric criterion, named by its id so pass counts roll up per criterion. EVAL_CASES limits the run,
// for example EVAL_CASES=D01,D07.
import { existsSync } from "node:fs";
import { dayPath, loadCases, loadRubric } from "../lib";

export default async function tests() {
  const rubric = loadRubric();
  const only = process.env.EVAL_CASES?.split(",").map((s) => s.trim()).filter(Boolean);
  const cases = loadCases().filter((c) => !only || only.includes(c.case_id));
  if (!rubric.length) throw new Error("evals/digest/rubric.csv has no rows yet. Run pnpm eval:pull after Paula fills the Rubric tab.");
  if (!cases.length) throw new Error("evals/digest/cases.csv has no rows yet. Run pnpm eval:pull after Paula fills the Cases tab.");
  const missing = cases.filter((c) => !existsSync(dayPath(c.case_id))).map((c) => c.case_id);
  if (missing.length) throw new Error(`No day file for ${missing.join(", ")}. Run pnpm eval:fixtures ${missing.join(" ")}`);

  return cases.map((c) => ({
    description: `${c.case_id} ${c.scenario}`,
    vars: { case_id: c.case_id },
    assert: rubric.map((r) => ({
      type: "javascript",
      value: "file://assertions/criterion.ts:grade",
      metric: r.id,
      config: { criterion: r.id },
    })),
  }));
}
