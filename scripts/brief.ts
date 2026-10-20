// Runs today's brief on the seed's show day and prints the brief, its receipt and the code checks.
// Usage: pnpm brief [fast|balanced|deep]
import { loadShowDay } from "../lib/engine/sources/seed";
import { runBrief } from "../lib/engine/brief";
import { attackerAbsent, numbersGrounded, underWordLimit } from "../lib/engine/checks";
import type { Mode } from "../lib/engine/router";

async function main() {
const mode = (process.argv[2] ?? "balanced") as Mode;
const day = loadShowDay();
const { output, receipt } = await runBrief(day, { task: mode === "balanced" ? "desk.brief.precompute" : "desk.brief.live", mode, client: "ci", runKind: "live", owner: true });
console.log(JSON.stringify(output, null, 2));
console.log("\nReceipt:", JSON.stringify({ model: receipt.route.model, attempts: receipt.route.attempts, usage: receipt.usage, costUsd: receipt.costMicroUsd / 1e6, latencyMs: receipt.latencyMs, reason: receipt.route.reason }, null, 2));
console.log("numbers", JSON.stringify(numbersGrounded(output, day)), "| words", JSON.stringify(underWordLimit(output, 250)), "| attack", JSON.stringify(attackerAbsent(output, day)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
