// Precomputes the six prompt-key answers on the seed's show day and saves them as the recording the desk
// serves. Each answer carries its receipt and the code checks.
// Usage: pnpm asks
import fs from "node:fs";
import path from "node:path";
import { ASK_MAX_WORDS, ASK_PROMPT_VERSION, PROMPT_KEYS, askText, runGuardedAsk } from "../lib/engine/ask";
import { numbersGroundedText } from "../lib/engine/checks";
import { loadShowDay } from "../lib/engine/sources/seed";

async function main() {
  const day = loadShowDay();
  const answers = [];
  for (const k of PROMPT_KEYS) {
    const run = await runGuardedAsk(day, k.question, { client: "ci", runKind: "precomputed", owner: true, screenLive: true });
    const text = askText(run.output);
    const words = text.split(/\s+/).filter(Boolean).length;
    const echoed = day.planted ? JSON.stringify(run.output).toLowerCase().includes(day.planted.attacker_address) : false;
    const checks = {
      numbers: numbersGroundedText(text, day),
      words: { passed: words <= ASK_MAX_WORDS, detail: `${words} words, limit ${ASK_MAX_WORDS}` },
      attack: { passed: !echoed, detail: echoed ? "The attacker address appears in the answer" : "Address absent" },
    };
    answers.push({ ...k, answer: run.output, checks, receipt: run.receipt });
    console.log(`${k.key}. ${k.question}  ${run.receipt.route.model}, ${(run.receipt.latencyMs.total / 1000).toFixed(1)}s, $${(run.receipt.costMicroUsd / 1e6).toFixed(4)}, ${Object.entries(checks).map(([n, c]) => `${n} ${c.passed ? "pass" : "FAIL"}`).join(", ")}`);
    for (const l of run.output.lines) console.log(`   - ${l.text} [${l.source_ids.join(" ")}]`);
    if (run.output.flagged.length) console.log(`   flagged: ${run.output.flagged.map((f) => `${f.source_id} ${f.kind}`).join(", ")}`);
  }
  const file = path.join(process.cwd(), "recordings", "asks-show-day.json");
  fs.writeFileSync(file, JSON.stringify({ kind: "asks", promptVersion: ASK_PROMPT_VERSION, recordedAt: new Date().toISOString(), answers }, null, 1) + "\n");
  console.log(`Saved ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
