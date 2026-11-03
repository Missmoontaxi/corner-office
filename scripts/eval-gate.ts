// The eval gate on pull requests. Compares a smoke run on the PR against the same run on main, and fails when
// the PR fails a must-pass row of Paula's rubric that main passes on the same case, or fails more cases than
// main does. A case fails when any must-pass row fails. Writes a markdown scorecard for the PR comment.
// Usage: pnpm exec tsx scripts/eval-gate.ts <pr.json> <main.json> <out.md>
import fs from "node:fs";
import { loadRubric } from "../evals/lib";

type Component = { pass: boolean; assertion?: { metric?: string } };
type Result = { provider: { label?: string; id: string }; vars: { case_id: string }; error?: string; cost?: number; gradingResult?: { componentResults?: Component[] } };

const [prFile, mainFile, outFile] = process.argv.slice(2);
if (!prFile || !mainFile || !outFile) throw new Error("Usage: eval-gate.ts <pr.json> <main.json> <out.md>");

const must = loadRubric().filter((c) => c.must_pass).map((c) => c.id);
const all = loadRubric().map((c) => c.id);

function read(file: string) {
  const results: Result[] = JSON.parse(fs.readFileSync(file, "utf8")).results.results;
  const label = (r: Result) => r.provider.label ?? r.provider.id;
  const several = new Set(results.map(label)).size > 1;
  const byCase = new Map<string, Map<string, boolean> | null>();
  for (const r of results) {
    const comps = r.gradingResult?.componentResults;
    byCase.set(several ? `${label(r)} ${r.vars.case_id}` : r.vars.case_id, comps ? new Map(comps.map((c) => [c.assertion?.metric ?? "?", c.pass])) : null);
  }
  const cost = results.reduce((a, r) => a + (r.cost ?? 0), 0);
  const model = [...new Set(results.map(label))].join(", ");
  return { byCase, cost, model };
}

const pr = read(prFile);
const main = read(mainFile);
const cases = [...new Set([...pr.byCase.keys(), ...main.byCase.keys()])].sort();

// A case with no grading (an error or a timeout) counts as failing every must-pass row.
const passes = (run: ReturnType<typeof read>, id: string, row: string) => run.byCase.get(id)?.get(row) === true;
const failedCase = (run: ReturnType<typeof read>, id: string) => must.some((row) => !passes(run, id, row));

const regressions = cases.flatMap((id) => must.filter((row) => passes(main, id, row) && !passes(pr, id, row)).map((row) => `${id} ${row}`));
const prFailed = cases.filter((id) => failedCase(pr, id)).length;
const mainFailed = cases.filter((id) => failedCase(main, id)).length;
const ok = regressions.length === 0 && prFailed <= mainFailed;

const count = (run: ReturnType<typeof read>, row: string) => `${cases.filter((id) => passes(run, id, row)).length} of ${cases.length}`;
const lines = [
  "<!-- corner-office-eval-gate -->",
  `## Eval gate ${ok ? "passed" : "failed"}`,
  "",
  `Smoke run on ${pr.model}, this PR against main. Must-pass rows are ${must.join(", ")}.`,
  "",
  `- Cases failing a must-pass row, ${prFailed} on this PR and ${mainFailed} on main.`,
  regressions.length ? `- Must-pass rows that main passes and this PR fails, ${regressions.join(", ")}.` : "- No must-pass row that passes on main fails here.",
  `- Brief cost $${pr.cost.toFixed(3)} on this PR and $${main.cost.toFixed(3)} on main, judges not included.`,
  "",
  "| Row | Must pass | This PR | Main |",
  "| --- | --- | --- | --- |",
  ...all.map((row) => `| ${row} | ${must.includes(row) ? "yes" : ""} | ${count(pr, row)} | ${count(main, row)} |`),
  "",
  "Model output varies run to run, so a single flip can be noise. Rerun the workflow before changing anything.",
];
fs.writeFileSync(outFile, lines.join("\n") + "\n");
console.log(lines.join("\n"));
process.exit(ok ? 0 : 1);
