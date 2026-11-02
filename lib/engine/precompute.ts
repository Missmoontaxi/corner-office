// The morning precompute. Runs the guarded brief and the six prompt keys on the show day, puts them through the
// promote gate, and returns everything the snapshot needs. Screening uses the committed verdicts only, since the
// show day is fixed and a cron job cannot write files. An item without a verdict is held back, which fails closed.
import { PROMPT_KEYS, ASK_MAX_WORDS, askText, runGuardedAsk } from "./ask";
import { BRIEF_MAX_WORDS, runGuardedBrief } from "./brief";
import { attackerAbsent, numbersGrounded, numbersGroundedText, underWordLimit } from "./checks";
import { promoteGate } from "./promote";
import type { Snapshot } from "./snapshot";
import { loadShowDay } from "./sources/seed";

export async function precompute() {
  const day = loadShowDay();
  const opts = { client: "cron" as const, runKind: "precomputed" as const, owner: true, screenLive: false };

  const [run, asks] = await Promise.all([
    runGuardedBrief(day, { ...opts, task: "desk.brief.precompute", mode: "balanced" }),
    Promise.all(
      PROMPT_KEYS.map(async (k) => {
        const a = await runGuardedAsk(day, k.question, opts);
        const text = askText(a.output);
        const words = text.split(/\s+/).filter(Boolean).length;
        const echoed = day.planted ? JSON.stringify(a.output).toLowerCase().includes(day.planted.attacker_address) : false;
        const checks = {
          numbers: numbersGroundedText(text, day),
          words: { passed: words <= ASK_MAX_WORDS, detail: `${words} words, limit ${ASK_MAX_WORDS}` },
          attack: { passed: !echoed, detail: echoed ? "The attacker address appears in the answer" : "Address absent" },
        };
        return { ...k, answer: a.output, checks, receipt: a.receipt };
      }),
    ),
  ]);

  const checks = { numbers: numbersGrounded(run.output, day), words: underWordLimit(run.output, BRIEF_MAX_WORDS), attack: attackerAbsent(run.output, day) };
  const gate = await promoteGate({ brief: run.output, model: run.receipt.route.model, day, asks });
  const costMicroUsd = run.receipt.costMicroUsd + asks.reduce((t, a) => t + a.receipt.costMicroUsd, 0);

  const snapshot: Snapshot | null = gate.passed
    ? { kind: "snapshot", version: 1, runAt: run.receipt.runAt, brief: { brief: run.output, receipt: run.receipt, checks }, asks, gate: { passed: true, results: gate.results } }
    : null;
  return { snapshot, gate, model: run.receipt.route.model, costMicroUsd };
}
