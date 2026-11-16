// The eval gate's scoring, kept apart from file reading so it can be tested. It compares runs on a PR with the
// same runs on main and decides whether the PR regressed a must-pass row of Paula's rubric.
//
// Model output varies, so the gate reports its own variance. A row counts as a regression only when main passed
// it on every one of its runs and the PR fails it by majority. When main itself split on a row, the case is
// unstable, it is listed as such with the run counts on each side, and it does not fail the PR. The case count
// check leaves unstable cases out for the same reason.

export type Component = { pass: boolean; assertion?: { metric?: string } };
export type Result = { provider: { label?: string; id: string }; vars: { case_id: string }; error?: string; cost?: number; gradingResult?: { componentResults?: Component[] } | null };

// Every run of every case, keyed by case (or by model and case when a file holds several models). A run with no
// grading (an error or a timeout) is null and fails every row.
export type Side = { runs: Map<string, (Map<string, boolean> | null)[]>; firstCost: number; model: string };

export function readSide(files: Result[][]): Side {
  const runs: Side["runs"] = new Map();
  let firstCost = 0;
  const models = new Set<string>();
  files.forEach((results, n) => {
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

export const tally = (s: Side, id: string, row: string) => {
  const r = s.runs.get(id) ?? [];
  return { passed: r.filter((m) => m?.get(row) === true).length, of: r.length };
};
// A row passes on a case when it passes in more than half of that case's runs. With one run, that run decides.
export const passes = (s: Side, id: string, row: string) => {
  const t = tally(s, id, row);
  return t.of > 0 && t.passed * 2 > t.of;
};
// Main split on this row, passing some runs and failing others.
export const mixed = (s: Side, id: string, row: string) => {
  const t = tally(s, id, row);
  return t.passed > 0 && t.passed < t.of;
};

export type Gate = {
  ok: boolean;
  cases: string[];
  regressed: { id: string; row: string }[];
  unstable: { id: string; row: string }[];
  flagged: string[];
  prFailed: number;
  mainFailed: number;
};

export function compare(pr: Side, main: Side, must: string[]): Gate {
  const cases = [...new Set([...pr.runs.keys(), ...main.runs.keys()])].sort();
  const failedCase = (s: Side, id: string) => must.some((row) => !passes(s, id, row));
  const pairs = cases.flatMap((id) => must.map((row) => ({ id, row })));
  // Rows where the PR does worse than main, by majority. Split on main means unstable, solid on main means regressed.
  const worse = pairs.filter(({ id, row }) => passes(main, id, row) && !passes(pr, id, row));
  const regressed = worse.filter(({ id, row }) => !mixed(main, id, row));
  // Every must-pass row main split on, whichever way the PR went, so the comment shows where the case itself is noisy.
  const unstable = pairs.filter(({ id, row }) => mixed(main, id, row));
  const unstableCases = new Set(unstable.map((u) => u.id));
  const stable = cases.filter((id) => !unstableCases.has(id));
  const prFailed = stable.filter((id) => failedCase(pr, id)).length;
  const mainFailed = stable.filter((id) => failedCase(main, id)).length;
  const ok = regressed.length === 0 && prFailed <= mainFailed;
  const flagged = [...new Set([...regressed.map((r) => r.id), ...stable.filter((id) => failedCase(pr, id) && !failedCase(main, id))])];
  return { ok, cases, regressed, unstable, flagged, prFailed, mainFailed };
}

export function gateMarkdown(g: Gate, pr: Side, main: Side, must: string[], all: string[], reran: boolean): string {
  const runs = (s: Side, id: string, row: string) => {
    const t = tally(s, id, row);
    return `${t.passed} of ${t.of}`;
  };
  const runsOf = (s: Side, id: string, row: string) => (tally(s, id, row).of > 1 ? ` (${runs(s, id, row)} runs)` : "");
  const count = (s: Side, row: string) => `${g.cases.filter((id) => passes(s, id, row)).length} of ${g.cases.length}`;
  const unstableCount = new Set(g.unstable.map((u) => u.id)).size;
  return [
    "<!-- corner-office-eval-gate -->",
    `## Eval gate ${g.ok ? "passed" : "failed"}`,
    "",
    `Smoke run on ${pr.model}, this PR against main. Must-pass rows are ${must.join(", ")}.${reran ? " Flagged cases were rerun twice on each side and scored by majority." : ""}`,
    "",
    `- Cases failing a must-pass row, ${g.prFailed} on this PR and ${g.mainFailed} on main${unstableCount ? `, not counting ${unstableCount} unstable` : ""}.`,
    g.regressed.length
      ? `- Must-pass rows that main passes on every run and this PR fails, ${g.regressed.map((r) => `${r.id} ${r.row}${runsOf(pr, r.id, r.row)}`).join(", ")}.`
      : "- No must-pass row that passes on main fails here.",
    ...(g.unstable.length
      ? [
          `- Unstable on main, so not a regression, ${g.unstable.map((u) => `${u.id} ${u.row} (main ${runs(main, u.id, u.row)}, this PR ${runs(pr, u.id, u.row)})`).join(", ")}. The model splits on these cases even without this change.`,
        ]
      : []),
    `- Brief cost of the first run $${pr.firstCost.toFixed(3)} on this PR and $${main.firstCost.toFixed(3)} on main, judges and reruns not included.`,
    "",
    "| Row | Must pass | This PR | Main |",
    "| --- | --- | --- | --- |",
    ...all.map((row) => `| ${row} | ${must.includes(row) ? "yes" : ""} | ${count(pr, row)} | ${count(main, row)} |`),
    "",
  ].join("\n");
}
