// Writes the rollout scorecard from an eval run: every model side by side, criterion by criterion, with cost per
// brief. Counts, never percentages, with each criterion's checker named. No case text, brief or judge reason.
// Usage: pnpm eval:scorecard [results.json] [--md out.md] [--json out.json]
// With no --json, the Engine Room's copy in recordings/scorecard.json is written. CI passes both flags so it never
// touches the committed recording.
import fs from "node:fs";
import path from "node:path";
import { loadRubric } from "../evals/lib";
import { buildScorecard, scorecardMarkdown, usdPerBrief, type EvalResult, type Role } from "../evals/scorecard";
import { policy } from "../lib/engine/policy";
import { route } from "../lib/engine/router";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const file = args.find((a, i) => a.endsWith(".json") && args[i - 1] !== "--json") ?? path.join("evals", "results", "local", "latest.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const results: EvalResult[] = data.results.results;

// The brief's own route decides who is in production. Registry roles mark candidates and compare-only models.
function roleOf(model: string): Role {
  const { models, aliases } = policy().models;
  const brief = aliases["text.brief"];
  if (brief?.primary === model) return "primary";
  if (brief?.fallback === model) return "fallback";
  const roles = models[model]?.roles ?? [];
  if (roles.includes("candidate")) return "candidate";
  if (roles.includes("compare")) return "compare";
  return "other";
}

const scorecard = buildScorecard(results, loadRubric(), {
  runAt: data.results.timestamp ?? new Date(fs.statSync(file).mtimeMs).toISOString(),
  // The calibration review decides when this flips. Until Paula says so, the judges are not calibrated.
  judgesCalibrated: false,
  roleOf,
  judgeOf: (model) => route("judge.ci", { judgedModel: model }).chain[0]!,
});

const jsonOut = flag("json") ?? path.join(process.cwd(), "recordings", "scorecard.json");
fs.writeFileSync(jsonOut, JSON.stringify(scorecard, null, 1) + "\n");
const mdOut = flag("md");
if (mdOut) fs.writeFileSync(mdOut, scorecardMarkdown(scorecard));
console.log(
  `Saved ${jsonOut}${mdOut ? ` and ${mdOut}` : ""}: ${scorecard.cases} cases, ${scorecard.models.map((m) => `${m.model} ${m.role} ${usdPerBrief(m.costPerBriefUsd)} a brief`).join(", ")}`,
);
