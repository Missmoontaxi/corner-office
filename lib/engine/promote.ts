// The promote gate. Fresh output is published only if it passes Paula's must-pass rows of the rubric, plus the
// product's word limit, and every prompt-key answer keeps its numbers grounded and the planted address out. An
// answer a few words over its limit still publishes, with the overshoot showing on its receipt. A must-pass row
// marked code runs the free check, a row marked judge asks a judge from the other vendor, and a row marked both
// needs both to pass.
// Anything that fails keeps the previous snapshot up.
import { loadRubric } from "../../evals/lib";
import { BRIEF_MAX_WORDS } from "./brief";
import { codeCheckFor, underWordLimit } from "./checks";
import type { BriefV1, DayV1 } from "./contracts";
import { judge } from "./judge";

const GATED_ASK_CHECKS = ["numbers", "attack"];

export type GateResult = { id: string; passed: boolean; detail: string };
type Judge = (c: { id: string; criterion: string; pass_if: string; fail_if: string }) => Promise<{ passed: boolean; reason: string; judge: string }>;

export async function promoteGate(input: {
  brief: BriefV1;
  model: string;
  day: DayV1;
  asks: { key: number; checks: Record<string, { passed: boolean; detail: string }> }[];
  judgeWith?: Judge;
}): Promise<{ passed: boolean; results: GateResult[] }> {
  const { brief, day } = input;
  // The show day is not one of the eval cases, so the judge grades it on the criterion alone.
  const judgeWith: Judge = input.judgeWith ?? ((c) => judge({ criterion: c, expectations: { note: "Show day. No case expectations, grade on the criterion alone." }, day, brief, judgedModel: input.model, client: "cron" }));

  const graded = await Promise.all(
    loadRubric()
      .filter((c) => c.must_pass)
      .map(async (c): Promise<GateResult> => {
        const parts: string[] = [];
        let passed = true;
        if (c.check_type.includes("code")) {
          const check = codeCheckFor(c.criterion);
          const r = check ? check.run(brief, day, { max_words: BRIEF_MAX_WORDS }) : { passed: false, detail: "No code check matches this criterion" };
          passed &&= r.passed;
          parts.push(`code, ${r.detail}`);
        }
        if (c.check_type.includes("judge")) {
          try {
            const v = await judgeWith(c);
            passed &&= v.passed;
            parts.push(`${v.judge}, ${v.reason}`);
          } catch {
            // A judge that cannot answer is a failed gate, never a silent pass.
            passed = false;
            parts.push("The judge did not answer");
          }
        }
        return { id: c.id, passed, detail: parts.join(" | ") };
      }),
  );

  const words = underWordLimit(brief, BRIEF_MAX_WORDS);
  const asks = input.asks.map((a): GateResult => {
    const failed = Object.entries(a.checks).filter(([n, c]) => GATED_ASK_CHECKS.includes(n) && !c.passed);
    return { id: `ask ${a.key}`, passed: !failed.length, detail: failed.length ? failed.map(([n, c]) => `${n}, ${c.detail}`).join(" | ") : "Code checks pass" };
  });
  const results = [...graded, { id: "words", ...words }, ...asks];
  return { passed: results.every((r) => r.passed), results };
}
