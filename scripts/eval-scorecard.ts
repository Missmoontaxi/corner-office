// Writes the Engine Room scorecard from the latest eval run: pass counts per model and criterion, in counts,
// never percentages, with each criterion's checker named. No case text, brief or judge reason is included.
// Usage: pnpm eval:scorecard [path/to/results.json]
import fs from "node:fs";
import path from "node:path";
import { loadRubric } from "../evals/lib";
import { route } from "../lib/engine/router";

type Component = { pass: boolean; assertion?: { metric?: string } };
type Result = { provider: { label?: string; id: string }; vars: { case_id: string }; error?: string; gradingResult?: { componentResults?: Component[] } };

const file = process.argv.slice(2).find((a) => a.endsWith(".json")) ?? path.join("evals", "results", "local", "latest.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const results: Result[] = data.results.results;
const rubric = loadRubric();
const models = [...new Set(results.map((r) => r.provider.label ?? r.provider.id))];

const scorecard = {
  kind: "scorecard",
  runAt: data.results.timestamp ?? new Date(fs.statSync(file).mtimeMs).toISOString(),
  cases: new Set(results.map((r) => r.vars.case_id)).size,
  // Paula's labels land Mon 11/2 and the calibration review is Thu 11/5. Until then the judges are not calibrated.
  judgesCalibrated: false,
  models: models.map((model) => {
    const graded = results.filter((r) => (r.provider.label ?? r.provider.id) === model && r.gradingResult);
    const judge = route("judge.ci", { judgedModel: model }).chain[0]!;
    // Cases the model never answered, so nothing was graded. The panel names them instead of hiding them.
    const ungraded = results
      .filter((r) => (r.provider.label ?? r.provider.id) === model && !r.gradingResult)
      .map((r) => ({ case: r.vars.case_id, reason: /timeout|timed out/i.test(r.error ?? "") ? "timed out" : "errored" }));
    return {
      model,
      graded: graded.length,
      ungraded,
      criteria: rubric.map((c) => ({
        id: c.id,
        label: c.criterion,
        mustPass: c.must_pass,
        checkedBy: c.check_type === "code" ? "code" : c.check_type.includes("code") ? `code and ${judge}` : judge,
        passed: graded.filter((r) => r.gradingResult?.componentResults?.find((x) => x.assertion?.metric === c.id)?.pass).length,
      })),
    };
  }),
};

const out = path.join(process.cwd(), "recordings", "scorecard.json");
fs.writeFileSync(out, JSON.stringify(scorecard, null, 1) + "\n");
console.log(`Saved ${out}: ${scorecard.cases} cases, ${models.join(" and ")}`);
