// The eval gate on pull requests. Compares smoke runs on a PR with the same runs on main, and fails when the PR
// fails a must-pass row of Paula's rubric that main passes on every run of the same case, or fails more stable
// cases than main does. A flagged case is rerun twice on each side and each row is scored by majority. Rows that
// main itself splits on are reported as unstable and do not fail the PR. The scoring lives in evals/gate.ts.
// Writes a markdown scorecard for the PR comment, and the flagged cases for the workflow to rerun.
// Usage: pnpm exec tsx scripts/eval-gate.ts --pr a.json[,b.json] --main c.json[,d.json] --out gate.md [--flagged flagged.txt]
import fs from "node:fs";
import { compare, gateMarkdown, readSide, type Result } from "../evals/gate";
import { loadRubric } from "../evals/lib";

const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const prFiles = flag("pr")?.split(",");
const mainFiles = flag("main")?.split(",");
const outFile = flag("out");
const flaggedFile = flag("flagged");
if (!prFiles || !mainFiles || !outFile) throw new Error("Usage: eval-gate.ts --pr a.json[,b.json] --main c.json[,d.json] --out gate.md [--flagged flagged.txt]");

const rubric = loadRubric();
const must = rubric.filter((c) => c.must_pass).map((c) => c.id);
const all = rubric.map((c) => c.id);
const load = (files: string[]) => readSide(files.map((f) => JSON.parse(fs.readFileSync(f, "utf8")).results.results as Result[]));

const pr = load(prFiles);
const main = load(mainFiles);
const g = compare(pr, main, must);
const md = gateMarkdown(g, pr, main, must, all, Math.max(prFiles.length, mainFiles.length) > 1);
fs.writeFileSync(outFile, md);
if (flaggedFile) fs.writeFileSync(flaggedFile, g.ok ? "" : g.flagged.join(","));
console.log(md);
process.exit(g.ok ? 0 : 1);
