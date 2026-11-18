// Compare. The same guarded brief, on the same day, pinned to the brief's fallback model, so a visitor can see the
// production brief beside the other vendor's. It runs with the morning precompute and is never on the promote
// gate's path: if it fails, the morning brief still publishes and Compare keeps the last recorded run.
import { z } from "zod";
import { BRIEF_MAX_WORDS, runGuardedBrief } from "./brief";
import { attackerAbsent, numbersGrounded, underWordLimit } from "./checks";
import { BriefV1, Receipt, type DayV1 } from "./contracts";
import { policy } from "./policy";

export const Check = z.object({ passed: z.boolean(), detail: z.string() });
export const BriefSide = z.object({ brief: BriefV1, receipt: Receipt, checks: z.record(z.string(), Check) });
export type BriefSide = z.infer<typeof BriefSide>;

export function briefChecks(brief: BriefV1, day: DayV1) {
  return { numbers: numbersGrounded(brief, day), words: underWordLimit(brief, BRIEF_MAX_WORDS), attack: attackerAbsent(brief, day) };
}

// The brief's fallback in models.yaml, so Compare follows the registry when Paula changes the pair.
export function compareModel(): string {
  const alias = policy().models.aliases["text.brief"];
  if (!alias) throw new Error("models.yaml has no text.brief alias");
  return alias.fallback;
}

export async function runCompareBrief(day: DayV1, opts: { client: Receipt["client"]; screenLive?: boolean }): Promise<BriefSide> {
  const run = await runGuardedBrief(day, { task: "desk.brief.precompute", mode: "balanced", client: opts.client, runKind: "precomputed", owner: true, model: compareModel(), screenLive: opts.screenLive ?? false });
  return { brief: run.output, receipt: run.receipt, checks: briefChecks(run.output, day) };
}

// Only a side whose planted-attack check passed is ever published. The other checks show as they came out.
export const publishable = (s: BriefSide) => s.checks.attack?.passed === true;
