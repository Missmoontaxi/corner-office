// Summarizes the latest eval run: pass or fail per case and criterion, and pass counts per criterion
// for each model. --markdown writes the same tables for a GitHub job summary.
// Usage: pnpm eval:view [--markdown] [path/to/results.json]
import fs from "node:fs";
import path from "node:path";

type Component = { pass: boolean; reason?: string; assertion?: { metric?: string } };
type Result = { provider: { label?: string; id: string }; vars: { case_id: string }; error?: string; cost?: number; gradingResult?: { componentResults?: Component[] } };

const args = process.argv.slice(2);
const md = args.includes("--markdown");
const file = args.find((a) => a.endsWith(".json")) ?? path.join("evals", "results", "local", "latest.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const results: Result[] = data.results.results;

const models = [...new Set(results.map((r) => r.provider.label ?? r.provider.id))];
const criteria = [...new Set(results.flatMap((r) => r.gradingResult?.componentResults?.map((c) => c.assertion?.metric ?? "?") ?? []))];
const cases = [...new Set(results.map((r) => r.vars.case_id))].sort();

const lines: string[] = [];
const row = (cells: string[]) => lines.push(md ? `| ${cells.join(" | ")} |` : cells.map((c, i) => (i ? c.padEnd(12) : c.padEnd(14))).join(""));

for (const model of models) {
  const mine = results.filter((r) => (r.provider.label ?? r.provider.id) === model);
  const cost = mine.reduce((a, r) => a + (r.cost ?? 0), 0);
  lines.push(md ? `### ${model}` : `\n${model}  (brief cost $${cost.toFixed(3)})`);
  if (md) lines.push("");
  row(["Case", ...criteria]);
  if (md) row(["---", ...criteria.map(() => "---")]);
  for (const id of cases) {
    const r = mine.find((x) => x.vars.case_id === id);
    if (!r) continue;
    if (!r.gradingResult) { row([id, `error: ${(r.error ?? "no output").slice(0, 60)}`]); continue; }
    const comps = r.gradingResult?.componentResults ?? [];
    row([id, ...criteria.map((c) => (comps.find((x) => x.assertion?.metric === c)?.pass ? "pass" : "FAIL"))]);
  }
  const counts = criteria.map((c) => {
    const graded = mine.filter((r) => r.gradingResult);
    const passed = graded.filter((r) => r.gradingResult?.componentResults?.find((x) => x.assertion?.metric === c)?.pass).length;
    return `${passed} of ${graded.length}`;
  });
  row(["Passed", ...counts]);
  if (md) lines.push("");
}

const failures = results.flatMap((r) => (r.gradingResult?.componentResults ?? []).filter((c) => !c.pass).map((c) => `${r.vars.case_id} ${(r.provider.label ?? r.provider.id)}: ${c.reason ?? ""}`));
if (failures.length) {
  lines.push(md ? "### Why each failure failed\n" : "\nWhy each failure failed");
  for (const f of failures) lines.push(md ? `- ${f}` : `  ${f}`);
}
console.log(lines.join("\n"));
