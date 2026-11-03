// Measures how often the judges agree with Paula's labels on the blind labeling set, reported separately on her
// passes and her fails, with counts. The tuning half is for tuning the judge prompts and can run as often as
// needed. The held-out half is scored once, after tuning, and writes evals/digest/calibration.md.
// An output passes only if every labeled criterion passes.
// Usage: pnpm eval:calibrate [--half tuning|held-out] [--labels file.csv] [--only R1,R3]
import fs from "node:fs";
import path from "node:path";
import type { BriefV1 } from "../lib/engine/contracts";
import { JUDGE_PROMPT_VERSION } from "../lib/engine/judge";
import { gradeCriterion } from "../evals/grade";
import { DIGEST, loadCases, loadRubric, parseCsv } from "../evals/lib";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const half = arg("half") ?? "tuning";
const labelsFile = arg("labels") ?? path.join(DIGEST, "labels.csv");
const only = arg("only")?.split(",");
const LOCAL = path.join("evals", "results", "local");
const report = path.join(DIGEST, "calibration.md");

type Output = { output_id: string; half: string; case_id: string; brief: BriefV1 };
type Row = { output_id: string; criterion: string; paula: boolean; judge: boolean; reason: string; note: string };

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
      process.stdout.write(".");
    }
  }));
  return out;
}

const agree = (rows: { paula: boolean; judge: boolean }[]) => {
  const p = rows.filter((r) => r.paula), f = rows.filter((r) => !r.paula);
  return { passes: `${p.filter((r) => r.judge).length} of ${p.length}`, fails: `${f.filter((r) => !r.judge).length} of ${f.length}` };
};

async function main() {
  if (half !== "tuning" && half !== "held-out") throw new Error("--half is tuning or held-out");
  if (half === "held-out" && fs.existsSync(report) && !process.argv.includes("--again"))
    throw new Error(`The held-out half was already scored (${report}). It is scored once; pass --again only with Paula's yes.`);

  const outputs: Output[] = JSON.parse(fs.readFileSync(path.join(DIGEST, "labeling", "outputs.json"), "utf8")).filter((o: Output) => o.half === half);
  const key: Record<string, { model: string }> = JSON.parse(fs.readFileSync(path.join(LOCAL, "labeling-key.json"), "utf8"));
  const rubric = Object.fromEntries(loadRubric().map((c) => [c.id, c]));
  const cases = Object.fromEntries(loadCases().map((c) => [c.case_id, c]));
  const ids = new Set(outputs.map((o) => o.output_id));
  const labels = parseCsv(fs.readFileSync(labelsFile, "utf8")).filter((l) => ids.has(l.output_id!) && (!only || only.includes(l.criterion_id!)));
  const blank = labels.filter((l) => !/^(pass|fail)$/i.test(l.label ?? ""));
  if (blank.length) throw new Error(`${blank.length} labels are not Pass or Fail, for example ${blank[0]!.output_id} ${blank[0]!.criterion_id}`);

  const rows: Row[] = await pool(labels, 6, async (l) => {
    const o = outputs.find((x) => x.output_id === l.output_id)!;
    const c = rubric[l.criterion_id!];
    if (!c) throw new Error(`${l.criterion_id} is not in the rubric`);
    const g = await gradeCriterion(c, cases[o.case_id]!, o.brief, key[o.output_id]!.model).catch((e) => ({ pass: false, reason: `error: ${e.message}` }));
    return { output_id: o.output_id, criterion: c.id, paula: /^pass$/i.test(l.label!), judge: g.pass, reason: g.reason, note: l.notes ?? "" };
  });
  console.log();

  const criteria = [...new Set(rows.map((r) => r.criterion))];
  const perCriterion = criteria.map((c) => ({ criterion: c, ...agree(rows.filter((r) => r.criterion === c)) }));
  const perOutput = [...ids].map((id) => {
    const rs = rows.filter((r) => r.output_id === id);
    return { paula: rs.every((r) => r.paula), judge: rs.every((r) => r.judge) };
  });
  const overall = agree(perOutput);
  const misses = rows.filter((r) => r.paula !== r.judge);

  console.log(`${half}, judge ${JUDGE_PROMPT_VERSION}. Outputs: agreed on ${overall.passes} of Paula's passes and ${overall.fails} of her fails.`);
  for (const c of perCriterion) console.log(`  ${c.criterion.padEnd(4)} passes ${c.passes.padEnd(9)} fails ${c.fails}`);
  for (const m of misses) console.log(`\n${m.output_id} ${m.criterion} Paula ${m.paula ? "pass" : "fail"}, judge ${m.judge ? "pass" : "fail"}${m.note ? `\n  Paula: ${m.note}` : ""}\n  ${m.reason}`);

  fs.mkdirSync(LOCAL, { recursive: true });
  fs.writeFileSync(path.join(LOCAL, `calibration-${half}.json`), JSON.stringify({ judge: JUDGE_PROMPT_VERSION, overall, perCriterion, rows }, null, 1));

  if (half === "held-out") {
    const md = [
      "# Judge calibration",
      "",
      `Scored once on the held-out half (H01 to H20) with ${JUDGE_PROMPT_VERSION}, on ${new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })}. The judges were tuned on the tuning half only.`,
      "",
      `On the held-out 20, the judges agreed with ${overall.passes} of Paula's passes and ${overall.fails} of her fails. An output passes only if every labeled criterion passes. With this few fails, each one moves the fail-side figure a lot.`,
      "",
      "| Criterion | Agreed on her passes | Agreed on her fails |",
      "|---|---|---|",
      ...perCriterion.map((c) => `| ${c.criterion} | ${c.passes} | ${c.fails} |`),
      "",
    ].join("\n");
    fs.writeFileSync(report, md);
    console.log(`\nWrote ${report}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
