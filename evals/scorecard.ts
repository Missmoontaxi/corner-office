// The rollout scorecard. Built from one eval run, it puts every model side by side, criterion by criterion, with
// cost per brief, so a candidate reads against the models in production. Counts, never percentages. Judged
// criteria name their judge, because two models graded by different judges are never ranked against each other.
// Pure functions, so the script, CI and tests share one source.
import type { Criterion } from "./lib";

export type Role = "primary" | "fallback" | "candidate" | "compare" | "other";

export type EvalResult = {
  provider: { label?: string; id: string };
  vars: { case_id: string };
  error?: string | null;
  cost?: number;
  response?: { cost?: number } | null;
  gradingResult?: { componentResults?: { pass: boolean; assertion?: { metric?: string } }[] } | null;
};

export type ScorecardModel = {
  model: string;
  role: Role;
  graded: number;
  ungraded: { case: string; reason: string }[];
  // Mean list-price cost of writing one brief, over the cases the model answered. Judge calls are not included.
  costPerBriefUsd: number | null;
  criteria: { id: string; label: string; mustPass: boolean; checkedBy: string; passed: number }[];
};

export type Scorecard = { kind: "scorecard"; runAt: string; cases: number; judgesCalibrated: boolean; models: ScorecardModel[] };

const ORDER: Role[] = ["primary", "fallback", "candidate", "compare", "other"];
const ROLE_LABEL: Record<Role, string> = { primary: "in production", fallback: "fallback", candidate: "candidate", compare: "compare only", other: "" };

const modelOf = (r: EvalResult) => r.provider.label ?? r.provider.id;

export function buildScorecard(
  results: EvalResult[],
  rubric: Criterion[],
  opts: { runAt: string; judgesCalibrated: boolean; roleOf: (model: string) => Role; judgeOf: (model: string) => string },
): Scorecard {
  const models = [...new Set(results.map(modelOf))];
  const built = models.map((model): ScorecardModel => {
    const mine = results.filter((r) => modelOf(r) === model);
    const graded = mine.filter((r) => r.gradingResult);
    const costs = graded.map((r) => r.response?.cost ?? r.cost).filter((c): c is number => typeof c === "number" && c > 0);
    const judge = opts.judgeOf(model);
    return {
      model,
      role: opts.roleOf(model),
      graded: graded.length,
      // Cases the model never answered, so nothing was graded. The scorecard names them instead of hiding them.
      ungraded: mine.filter((r) => !r.gradingResult).map((r) => ({ case: r.vars.case_id, reason: /timeout|timed out/i.test(r.error ?? "") ? "timed out" : "errored" })),
      costPerBriefUsd: costs.length ? costs.reduce((a, c) => a + c, 0) / costs.length : null,
      criteria: rubric.map((c) => ({
        id: c.id,
        label: c.criterion,
        mustPass: c.must_pass,
        checkedBy: c.check_type === "code" ? "code" : c.check_type.includes("code") ? `code and ${judge}` : judge,
        passed: graded.filter((r) => r.gradingResult?.componentResults?.find((x) => x.assertion?.metric === c.id)?.pass).length,
      })),
    };
  });
  built.sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || a.model.localeCompare(b.model));
  return { kind: "scorecard", runAt: opts.runAt, cases: new Set(results.map((r) => r.vars.case_id)).size, judgesCalibrated: opts.judgesCalibrated, models: built };
}

export const usdPerBrief = (v: number | null) => (v === null ? "no answers" : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`);

const cell = (s: string) => s.replace(/\|/g, "\\|");

// One row per criterion, one column per model. Code-checked rows lead, then judged rows with the judge in each cell.
export function scorecardMarkdown(sc: Scorecard): string {
  const head = sc.models.map((m) => (ROLE_LABEL[m.role] ? `${m.model} (${ROLE_LABEL[m.role]})` : m.model));
  const isCode = (checkedBy: string) => checkedBy === "code";
  const rows = (code: boolean) =>
    (sc.models[0]?.criteria ?? [])
      .filter((c) => isCode(c.checkedBy) === code)
      .map((c) => {
        const cells = sc.models.map((m) => {
          const x = m.criteria.find((y) => y.id === c.id)!;
          return code ? `${x.passed} of ${m.graded}` : `${x.passed} of ${m.graded}, ${x.checkedBy}`;
        });
        return `| ${c.id} ${cell(c.label)}${c.mustPass ? " **must pass**" : ""} | ${cells.join(" | ")} |`;
      });
  const ungraded = sc.models.filter((m) => m.ungraded.length).map((m) => `${m.model}: ${m.ungraded.map((u) => `${u.case} ${u.reason}`).join(", ")}.`);
  return [
    "## Rollout scorecard",
    "",
    `Run ${sc.runAt.slice(0, 10)}, ${sc.cases} cases. Counts, not percentages. Judged rows name their judge, and models graded by different judges are not ranked against each other.${sc.judgesCalibrated ? "" : " The judges are not yet calibrated against Paula's labels."}`,
    "",
    `| | ${head.map(cell).join(" | ")} |`,
    `|---|${sc.models.map(() => "---").join("|")}|`,
    `| Cost per brief, list price | ${sc.models.map((m) => usdPerBrief(m.costPerBriefUsd)).join(" | ")} |`,
    `| Cases graded | ${sc.models.map((m) => `${m.graded} of ${sc.cases}`).join(" | ")} |`,
    `| **Checked by code** | ${sc.models.map(() => "").join(" | ")} |`,
    ...rows(true),
    `| **Checked by a judge** | ${sc.models.map(() => "").join(" | ")} |`,
    ...rows(false),
    ...(ungraded.length ? ["", `Not graded. ${ungraded.join(" ")}`] : []),
    "",
  ].join("\n");
}
