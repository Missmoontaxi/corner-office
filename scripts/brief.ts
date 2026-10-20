// Runs today's guarded brief on the seed's show day, prints it with its receipt and code checks, and saves it
// as the recorded brief the desk and MCP serve until the precompute cron publishes a fresher one.
// Usage: pnpm brief [fast|balanced|deep]
import fs from "node:fs";
import path from "node:path";
import { loadShowDay } from "../lib/engine/sources/seed";
import { BRIEF_PROMPT_VERSION, runGuardedBrief } from "../lib/engine/brief";
import { attackerAbsent, numbersGrounded, underWordLimit } from "../lib/engine/checks";
import type { Mode } from "../lib/engine/router";

async function main() {
  const mode = (process.argv[2] ?? "balanced") as Mode;
  const day = loadShowDay();
  const task = mode === "balanced" ? "desk.brief.precompute" : "desk.brief.live";
  const run = await runGuardedBrief(day, { task, mode, client: "ci", runKind: "precomputed", owner: true, screenLive: true });
  const checks = { numbers: numbersGrounded(run.output, day), words: underWordLimit(run.output, 250), attack: attackerAbsent(run.output, day) };
  console.log(JSON.stringify(run.output, null, 2));
  console.log("\nReceipt:", JSON.stringify({ model: run.receipt.route.model, attempts: run.receipt.route.attempts, costUsd: run.receipt.costMicroUsd / 1e6, latencyMs: run.receipt.latencyMs, guardrails: run.receipt.guardrails.map((g) => `${g.owasp} ${g.layer} ${g.action}`) }, null, 2));
  console.log("checks", JSON.stringify(checks));
  if (mode === "balanced") {
    const file = path.join(process.cwd(), "recordings", "brief-show-day.json");
    fs.writeFileSync(file, JSON.stringify({ kind: "brief", promptVersion: BRIEF_PROMPT_VERSION, recordedAt: run.receipt.runAt, checks, brief: run.output, receipt: run.receipt }, null, 1) + "\n");
    console.log(`Saved ${file}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
