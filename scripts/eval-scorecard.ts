// Writes the Engine Room scorecard from the latest eval run: pass counts per model and criterion, in counts,
// never percentages, with each criterion's checker named. No case text, brief or judge reason is included.
// Usage: pnpm eval:scorecard [path/to/results.json]
import fs from "node:fs";
import path from "node:path";
import { loadRubric } from "../evals/lib";
import { route } from "../lib/engine/router";

type Component = { pass: boolean; assertion?: { metric?: string } };
type Result = { provider: { label?: string; id: string }; vars: { case_id: string }; gradingResult?: { componentResults?: Component[] } };

const file = process.argv.slice(2).find((a) => a.endsWith(".json")) ?? path.join("evals", "results", "local", "latest.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const results: Result[] = data.results.results;
const rubric = loadRubric();
const models = [...new Set(results.map((r) => r.provider.label ?? r.provider.id))];

const scorecard = {
  kind: "scorecard",
  runAt: data.results.timestamp ?? new Date(fs.statSync(file).mtimeMs).toISOString(),
  cases: new Set(results.map((r) => r.vars.case_id)).size,
  // Labels land Mon 10/26 and the calibration report Thu 10/29. Until then the judges are not calibrated.
  judgesCalibrated: false,
  models: models.map((model) => {
    const graded = results.filter((r) => (r.provider.label ?? r.provider.id) === model && r.gradingResult);
    const judge = route("judge.ci", { judgedModel: model }).chain[0]!;
    return {
      model,
      graded: graded.length,
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
