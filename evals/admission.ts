// The gate computer. Code, not judgment, decides whether a candidate clears each admission threshold in
// lib/engine/policy/admission.yaml. It reads one eval run's per-case results and returns pass or fail per
// threshold with the counts behind it. Paula still approves or declines on the results pull request.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";

export const AdmissionPolicy = z.object({
  version: z.string(),
  compare: z.object({
    every_case_answers: z.boolean(),
    must_pass: z.array(z.string()).min(1),
    max_cases_missing: z.number().int().min(0),
  }),
});
export type AdmissionPolicy = z.infer<typeof AdmissionPolicy>;

export function loadAdmissionPolicy(dir = path.join(process.cwd(), "lib", "engine", "policy")): AdmissionPolicy {
  return AdmissionPolicy.parse(YAML.parse(fs.readFileSync(path.join(dir, "admission.yaml"), "utf8")));
}

export type CaseResult = {
  provider: { label?: string; id: string };
  vars: { case_id: string };
  gradingResult?: { componentResults?: { pass: boolean; assertion?: { metric?: string } }[] } | null;
};

export type Threshold = { id: string; label: string; required: string; actual: string; pass: boolean; cases?: string[] };
export type Verdict = { model: string; policyVersion: string; cases: number; thresholds: Threshold[]; pass: boolean };

const modelOf = (r: CaseResult) => r.provider.label ?? r.provider.id;

export function admitToCompare(results: CaseResult[], model: string, policy: AdmissionPolicy, opts: { incumbent?: string } = {}): Verdict {
  const rule = policy.compare;
  // The run's case list is every case any model was asked, so a case this model skipped still counts against it.
  const allCases = [...new Set(results.map((r) => r.vars.case_id))].sort();
  const mine = new Map(results.filter((r) => modelOf(r) === model).map((r) => [r.vars.case_id, r]));
  if (mine.size === 0) throw new Error(`No results for ${model} in this run.`);

  const answered = allCases.filter((c) => mine.get(c)?.gradingResult);
  const unanswered = allCases.filter((c) => !answered.includes(c));
  // A case clears the bar only if every listed must-pass criterion was graded and passed. Ungraded is a miss.
  const passed = (c: string, id: string) => !!mine.get(c)?.gradingResult?.componentResults?.find((x) => x.assertion?.metric === id)?.pass;
  const missing = allCases.filter((c) => !rule.must_pass.every((id) => passed(c, id)));

  const thresholds: Threshold[] = [];
  if (rule.every_case_answers) {
    thresholds.push({
      id: "answers",
      label: "A valid brief on every case",
      required: `${allCases.length} of ${allCases.length}`,
      actual: `${answered.length} of ${allCases.length}`,
      pass: unanswered.length === 0,
      ...(unanswered.length ? { cases: unanswered } : {}),
    });
  }
  thresholds.push({
    id: "must-pass",
    label: `${rule.must_pass.join(", ")} all pass`,
    required: `at least ${Math.max(0, allCases.length - rule.max_cases_missing)} of ${allCases.length}`,
    actual: `${allCases.length - missing.length} of ${allCases.length}`,
    pass: missing.length <= rule.max_cases_missing,
    ...(missing.length ? { cases: missing } : {}),
  });
  // Each criterion on its own, so a failure says which one. These rows inform and do not decide.
  for (const id of rule.must_pass) {
    const n = allCases.filter((c) => passed(c, id)).length;
    thresholds.push({ id, label: `${id} on its own`, required: "for reference", actual: `${n} of ${allCases.length}`, pass: true });
  }
  // The production model's count on the same run, so the bar reads in context. It informs and does not decide.
  if (opts.incumbent && opts.incumbent !== model && results.some((r) => modelOf(r) === opts.incumbent)) {
    const theirs = new Map(results.filter((r) => modelOf(r) === opts.incumbent).map((r) => [r.vars.case_id, r]));
    const ok = allCases.filter((c) => rule.must_pass.every((id) => !!theirs.get(c)?.gradingResult?.componentResults?.find((x) => x.assertion?.metric === id)?.pass)).length;
    thresholds.push({ id: "incumbent", label: `In production, ${opts.incumbent}, ${rule.must_pass.join(", ")} all pass`, required: "for reference", actual: `${ok} of ${allCases.length}`, pass: true });
  }
  const deciding = thresholds.filter((t) => t.required !== "for reference");
  return { model, policyVersion: policy.version, cases: allCases.length, thresholds, pass: deciding.every((t) => t.pass) };
}

export function verdictText(v: Verdict): string {
  const lines = v.thresholds.map((t) =>
    t.required === "for reference"
      ? `  ${t.label}: ${t.actual}`
      : `  ${t.pass ? "PASS" : "FAIL"}  ${t.label}: ${t.actual}, needs ${t.required}${t.cases ? ` (misses ${t.cases.join(", ")})` : ""}`,
  );
  return [
    `Admission to Compare for ${v.model}, ${v.cases} cases, policy ${v.policyVersion}`,
    ...lines,
    v.pass ? "Clears every threshold. Paula approves or declines on the results PR." : "Does not clear the bar. It stays out of Compare.",
  ].join("\n");
}
