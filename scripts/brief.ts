// Runs today's brief on the seed's show day and prints the brief, its receipt and the code checks.
// Usage: pnpm brief [fast|balanced|deep]
import { loadShowDay } from "../lib/engine/sources/seed";
import { runBrief } from "../lib/engine/brief";
import { CODE_CHECKS } from "../lib/engine/checks";
import type { Mode } from "../lib/engine/router";

async function main() {
const mode = (process.argv[2] ?? "balanced") as Mode;
const day = loadShowDay();
const { output, receipt } = await runBrief(day, { task: mode === "balanced" ? "desk.brief.precompute" : "desk.brief.live", mode, client: "ci", runKind: "live", owner: true });
console.log(JSON.stringify(output, null, 2));
console.log("\nReceipt:", JSON.stringify({ model: receipt.route.model, attempts: receipt.route.attempts, usage: receipt.usage, costUsd: receipt.costMicroUsd / 1e6, latencyMs: receipt.latencyMs, reason: receipt.route.reason }, null, 2));
for (const [id, check] of Object.entries(CODE_CHECKS)) console.log(id, JSON.stringify(check(output, day, { max_words: 250 })));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
