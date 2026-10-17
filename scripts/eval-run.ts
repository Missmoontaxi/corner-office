// Runs the Digest evals through promptfoo. Smoke by default (the production primary), --full for both
// mid-tier models. Results land in evals/results/local/, which is not committed; scorecard numbers reach
// the repo only through a results PR Paula approves.
// Usage: pnpm eval [--full] [D01,D07]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const full = args.includes("--full");
const only = args.find((a) => /^[A-Za-z]+\d/.test(a));
const out = path.join("evals", "results", "local");
fs.mkdirSync(out, { recursive: true });
const json = path.join(out, "latest.json");

const res = spawnSync(
  "pnpm",
  ["exec", "promptfoo", "eval", "-c", `evals/promptfooconfig${full ? ".full" : ""}.yaml`, "-o", json, "-o", path.join(out, "latest.html")],
  {
    stdio: "inherit",
    env: { ...process.env, PROMPTFOO_DISABLE_TELEMETRY: "1", PROMPTFOO_DISABLE_UPDATE: "1", ...(only ? { EVAL_CASES: only } : {}) },
  },
);
console.log(`\nResults in ${json}. Run pnpm eval:view for pass counts per criterion.`);
// promptfoo exits 100 when any criterion fails. That is a result, not a crash.
process.exit(res.status === 100 ? 0 : (res.status ?? 1));
