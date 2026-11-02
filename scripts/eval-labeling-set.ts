// Builds Paula's blind labeling set: 40 briefs on cases 1-10. Twenty are standard (both mid-tier models on the
// current prompt). Twenty are deliberately weakened (the first prompt, the Fast tier, or the newsletters removed),
// so about a third should fail. The set is split at random into a tuning half (T01-T20) and a held-out half
// (H01-H20), with ten weakened outputs in each. Which output is which lives only in labeling-key.json under the uncommitted
// evals/results/local/, so it never shows in a PR diff before calibration. Writes outputs.json and
// labels-template.csv (rows for her Labels tab) to evals/digest/labeling/.
// Usage: pnpm eval:labeling-set
import fs from "node:fs";
import path from "node:path";
import { BriefV1, type DayV1 } from "../lib/engine/contracts";
import { BRIEF_MAX_WORDS, briefMessages, briefSources } from "../lib/engine/brief";
import { runStructured } from "../lib/engine/run";
import { DIGEST, loadCases, loadDay, loadRubric, openBefore } from "../evals/lib";

const OUT = path.join(DIGEST, "labeling");
// Paula's judged criteria for labeling: the must-pass judged rows plus R3, R6 and R7 for calibration review.
const LABELED = ["R1", "R3", "R6", "R7", "R8", "R9", "R11"];
const MID = { anthropic: "claude-sonnet-5-5", openai: "gpt-6.1-sol" } as const;
const FAST = { anthropic: "claude-haiku-5-5", openai: "gpt-6-luna" } as const;
type Variant = "standard" | "first-prompt" | "fast-tier" | "no-newsletter";
type Job = { caseId: string; vendor: keyof typeof MID; variant: Variant };

// Seeded, so a rerun gives the same split.
let seed = 20261102;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const shuffle = <T>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

// The first brief prompt, with the same day material as today's.
function firstPromptMessages(day: DayV1, before: ReturnType<typeof openBefore>) {
  const current = briefMessages(day, before);
  const system = fs
    .readFileSync(path.join(process.cwd(), "prompts", "desk-brief.v1.md"), "utf8")
    .replaceAll("{{name}}", day.persona.name.split(" ")[0]!)
    .replaceAll("{{role}}", day.persona.role)
    .replaceAll("{{company}}", day.persona.company)
    .replaceAll("{{max_words}}", String(BRIEF_MAX_WORDS));
  return { system, prompt: current.prompt };
}

async function run(job: Job) {
  let day = loadDay(job.caseId);
  if (job.variant === "no-newsletter") day = { ...day, newsletters: [] };
  const before = openBefore(job.caseId);
  const msgs = job.variant === "first-prompt" ? firstPromptMessages(day, before) : briefMessages(day, before);
  const model = job.variant === "fast-tier" ? FAST[job.vendor] : MID[job.vendor];
  // The Fast tier runs as the desk runs it live, at low effort with more output room.
  const { output, receipt } = await runStructured({
    task: job.variant === "fast-tier" ? "desk.brief.live" : "desk.brief.precompute",
    ...msgs,
    schema: BriefV1,
    promptVersion: job.variant === "first-prompt" ? "desk-brief.v1" : "desk-brief.v4",
    client: "ci",
    runKind: "precomputed",
    model,
    sources: briefSources(day),
  });
  return { ...job, model, brief: output, costMicroUsd: receipt.costMicroUsd };
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
        process.stdout.write(".");
      }
    }),
  );
  return out;
}

async function main() {
  const cases = loadCases().map((c) => c.case_id).sort().slice(0, 10);
  const weak: Variant[] = ["first-prompt", "fast-tier", "no-newsletter"];
  const jobs: Job[] = cases.flatMap((caseId, i) => [
    { caseId, vendor: "anthropic" as const, variant: "standard" as const },
    { caseId, vendor: "openai" as const, variant: "standard" as const },
    { caseId, vendor: i % 2 ? "openai" : "anthropic", variant: weak[i % 3]! },
    { caseId, vendor: i % 2 ? "anthropic" : "openai", variant: weak[(i + 1) % 3]! },
  ]);

  // Finished runs are cached locally, so a rerun after a failure only pays for what is missing. One retry each,
  // since a pinned model has no fallback.
  const cacheFile = path.join("evals", "results", "local", "labeling-cache.json");
  const cache: Record<string, Awaited<ReturnType<typeof run>>> = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};
  const keyOf = (j: Job) => `${j.caseId}|${j.vendor}|${j.variant}`;
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  const settled = await pool(jobs, 6, async (j) => {
    if (cache[keyOf(j)]) return cache[keyOf(j)]!;
    const r = await run(j).catch(() => run(j)).catch((e) => (console.error(`\n${keyOf(j)}: ${e.message}`), null));
    if (r) {
      cache[keyOf(j)] = r;
      fs.writeFileSync(cacheFile, JSON.stringify(cache));
    }
    return r;
  });
  if (settled.some((r) => !r)) throw new Error("Some runs failed. Rerun to fill in only the missing ones.");
  const results = settled.map((r) => r!);
  console.log();

  const standard = shuffle(results.filter((r) => r.variant === "standard"));
  const weakened = shuffle(results.filter((r) => r.variant !== "standard"));
  const halves = [
    { prefix: "T", half: "tuning", items: shuffle([...standard.slice(0, 10), ...weakened.slice(0, 10)]) },
    { prefix: "H", half: "held-out", items: shuffle([...standard.slice(10), ...weakened.slice(10)]) },
  ];
  const labeled = halves.flatMap((h) => h.items.map((r, i) => ({ ...r, output_id: `${h.prefix}${String(i + 1).padStart(2, "0")}`, half: h.half })));

  fs.mkdirSync(OUT, { recursive: true });
  const json = (f: string, v: unknown) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 1) + "\n");
  json("outputs.json", labeled.map(({ output_id, half, caseId, brief }) => ({ output_id, half, case_id: caseId, brief })));
  fs.writeFileSync(path.join("evals", "results", "local", "labeling-key.json"), JSON.stringify(Object.fromEntries(labeled.map((r) => [r.output_id, { model: r.model, variant: r.variant }])), null, 1) + "\n");

  const ids = new Set(loadRubric().map((c) => c.id));
  for (const id of LABELED) if (!ids.has(id)) throw new Error(`${id} is not in the rubric`);
  const rows = labeled.flatMap((r) => LABELED.map((c) => [r.output_id, r.caseId, c, "", ""].map((v) => `"${v}"`).join(",")));
  fs.writeFileSync(path.join(OUT, "labels-template.csv"), ['"output_id","case_id","criterion_id","label","notes"', ...rows].join("\n") + "\n");

  const cost = results.reduce((t, r) => t + r.costMicroUsd, 0) / 1e6;
  console.log(`${labeled.length} outputs, ${rows.length} label rows, $${cost.toFixed(3)}. Written to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
