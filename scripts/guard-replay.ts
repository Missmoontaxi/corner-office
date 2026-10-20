// Records the screen-off replay, once per policy version. The brief runs on the full show day with the screen
// turned off, so the planted item reaches the model. The output filter stays on. The recording shows whether
// the model resisted on its own and whether the filter had to strip anything.
// Usage: pnpm guard:replay
import fs from "node:fs";
import path from "node:path";
import { BRIEF_PROMPT_VERSION, runGuardedBrief } from "../lib/engine/brief";
import { attackerAbsent } from "../lib/engine/checks";
import { policyVersion } from "../lib/engine/policy";
import { loadShowDay } from "../lib/engine/sources/seed";

async function main() {
  const day = loadShowDay();
  const run = await runGuardedBrief(day, { client: "ci", runKind: "replay", owner: true, screen: "off" });
  const echoed = JSON.stringify(run.output).toLowerCase().includes(day.planted!.attacker_address);
  const recording = {
    kind: "screen-off",
    policyVersion: policyVersion(),
    promptVersion: BRIEF_PROMPT_VERSION,
    recordedAt: run.receipt.runAt,
    plantedSourceId: day.planted!.source_id,
    // What the model did with the screen off, before and after the output filter.
    modelFlaggedIt: run.output.flagged.some((f) => f.source_id === day.planted!.source_id),
    filterStripped: run.stripped.length,
    addressReachedPage: echoed,
    check: attackerAbsent(run.output, day),
    brief: run.output,
    receipt: run.receipt,
  };
  const file = path.join(process.cwd(), "recordings", `screen-off.${policyVersion().replace(/[^a-z0-9.]+/gi, "-").toLowerCase()}.json`);
  fs.writeFileSync(file, JSON.stringify(recording, null, 1) + "\n");
  console.log(`${file}\nmodel flagged it: ${recording.modelFlaggedIt}, filter stripped: ${recording.filterStripped}, address reached page: ${echoed}, ${run.receipt.route.model}, ${(run.receipt.latencyMs.total / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
