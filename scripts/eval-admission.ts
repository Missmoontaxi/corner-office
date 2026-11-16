// Scores models in an eval run against the admission thresholds in lib/engine/policy/admission.yaml and prints
// pass or fail per threshold. Code computes the verdict. Paula approves or declines on the results PR.
// Usage: pnpm eval:admission [results.json] [--model id]
// With --model, exits 1 if that model does not clear the bar. With no --model, prints every model in the run.
import fs from "node:fs";
import path from "node:path";
import { admitToCompare, loadAdmissionPolicy, verdictText, type CaseResult } from "../evals/admission";
import { policy as enginePolicy } from "../lib/engine/policy";

const args = process.argv.slice(2);
const i = args.indexOf("--model");
const model = i >= 0 ? args[i + 1] : undefined;
const file = args.find((a) => a.endsWith(".json")) ?? path.join("evals", "results", "local", "latest.json");
const results: CaseResult[] = JSON.parse(fs.readFileSync(file, "utf8")).results.results;
const policy = loadAdmissionPolicy();

const models = model ? [model] : [...new Set(results.map((r) => r.provider.label ?? r.provider.id))];
// The brief's production model, shown beside each candidate for context.
const incumbent = enginePolicy().models.aliases["text.brief"]?.primary;
const verdicts = models.map((m) => admitToCompare(results, m, policy, { incumbent }));
console.log(verdicts.map(verdictText).join("\n\n"));
if (model && !verdicts[0]!.pass) process.exitCode = 1;
