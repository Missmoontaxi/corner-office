// The eval gate on pull requests. Compares smoke runs on a PR with the same runs on main, and fails when the PR
// fails a must-pass row of Paula's rubric that main passes on the same case, or fails more cases than main does.
// A case fails when any must-pass row fails. Model output varies, so a flagged case is rerun twice on each side
// and each row is scored by majority, which keeps one noisy flip from blocking a PR. Writes a markdown scorecard
// for the PR comment, and the flagged cases for the workflow to rerun.
// Usage: pnpm exec tsx scripts/eval-gate.ts --pr a.json[,b.json] --main c.json[,d.json] --out gate.md [--flagged flagged.txt]
import fs from "node:fs";
import { loadRubric } from "../evals/lib";

type Component = { pass: boolean; assertion?: { metric?: string } };
type Result = { provider: { label?: string; id: string }; vars: { case_id: string }; error?: string; cost?: number; gradingResult?: { componentResults?: Component[] } };

const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const prFiles = flag("pr")?.split(",");
const mainFiles = flag("main")?.split(",");
const outFile = flag("out");
const flaggedFile = flag("flagged");
if (!prFiles || !mainFiles || !outFile) throw new Error("Usage: eval-gate.ts --pr a.json[,b.json] --main c.json[,d.json] --out gate.md [--flagged flagged.txt]");

const must = loadRubric().filter((c) => c.must_pass).map((c) => c.id);
const all = loadRubric().map((c) => c.id);

// Every run of every case across the files. A case with no grading (an error or a timeout) fails every row.
function read(files: string[]) {
  const runs = new Map<string, (Map<string, boolean> | null)[]>();
  let firstCost = 0;
  const models = new Set<string>();
  files.forEach((file, n) => {
    const results: Result[] = JSON.parse(fs.readFileSync(file, "utf8")).results.results;
    const label = (r: Result) => r.provider.label ?? r.provider.id;
    const several = new Set(results.map(label)).size > 1;
    for (const r of results) {
      models.add(label(r));
      const id = several ? `${label(r)} ${r.vars.case_id}` : r.vars.case_id;
      const comps = r.gradingResult?.componentResults;
      runs.set(id, [...(runs.get(id) ?? []), comps ? new Map(comps.map((c) => [c.assertion?.metric ?? "?", c.pass])) : null]);
      if (n === 0) firstCost += r.cost ?? 0;
    }
  });
  return { runs, firstCost, model: [...models].join(", ") };
}
type Side = ReturnType<typeof read>;

const pr = read(prFiles);
const main = read(mainFiles);
const cases = [...new Set([...pr.runs.keys(), ...main.runs.keys()])].sort();

// A row passes on a case when it passes in more than half of that case's runs. With one run, that run decides.
const tally = (s: Side, id: string, row: string) => {
  const r = s.runs.get(id) ?? [];
  return { passed: r.filter((m) => m?.get(row) === true).length, of: r.length };
};
const passes = (s: Side, id: string, row: string) => {
  const t = tally(s, id, row);
  return t.of > 0 && t.passed * 2 > t.of;
};
const failedCase = (s: Side, id: string) => must.some((row) => !passes(s, id, row));

const regressed = cases.flatMap((id) => must.filter((row) => passes(main, id, row) && !passes(pr, id, row)).map((row) => ({ id, row })));
const flagged = [...new Set([...regressed.map((r) => r.id), ...cases.filter((id) => failedCase(pr, id) && !failedCase(main, id))])];
const prFailed = cases.filter((id) => failedCase(pr, id)).length;
const mainFailed = cases.filter((id) => failedCase(main, id)).length;
const ok = regressed.length === 0 && prFailed <= mainFailed;
const reran = Math.max(prFiles.length, mainFiles.length) > 1;

const runsOf = (s: Side, id: string, row: string) => {
  const t = tally(s, id, row);
  return t.of > 1 ? ` (${t.passed} of ${t.of} runs)` : "";
};
const count = (s: Side, row: string) => `${cases.filter((id) => passes(s, id, row)).length} of ${cases.length}`;
const lines = [
  "<!-- corner-office-eval-gate -->",
  `## Eval gate ${ok ? "passed" : "failed"}`,
  "",
  `Smoke run on ${pr.model}, this PR against main. Must-pass rows are ${must.join(", ")}.${reran ? " Flagged cases were rerun twice on each side and scored by majority." : ""}`,
  "",
  `- Cases failing a must-pass row, ${prFailed} on this PR and ${mainFailed} on main.`,
  regressed.length
    ? `- Must-pass rows that main passes and this PR fails, ${regressed.map((r) => `${r.id} ${r.row}${runsOf(pr, r.id, r.row)}`).join(", ")}.`
    : "- No must-pass row that passes on main fails here.",
  `- Brief cost of the first run $${pr.firstCost.toFixed(3)} on this PR and $${main.firstCost.toFixed(3)} on main, judges and reruns not included.`,
  "",
  "| Row | Must pass | This PR | Main |",
  "| --- | --- | --- | --- |",
  ...all.map((row) => `| ${row} | ${must.includes(row) ? "yes" : ""} | ${count(pr, row)} | ${count(main, row)} |`),
  "",
];
fs.writeFileSync(outFile, lines.join("\n"));
if (flaggedFile) fs.writeFileSync(flaggedFile, ok ? "" : flagged.join(","));
console.log(lines.join("\n"));
process.exit(ok ? 0 : 1);
