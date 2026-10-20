// Screens every untrusted item in the seed's show day and saves the verdicts to lib/engine/guard/verdicts.json.
// Run after any seed or screen prompt change. Cached verdicts are reused, so only new content is screened.
// Usage: pnpm guard:screen
import { isQuarantined, screenDay } from "../lib/engine/guard/screen";
import { loadShowDay } from "../lib/engine/sources/seed";

async function main() {
  const screened = await screenDay(loadShowDay(), { live: true, client: "ci", save: true });
  for (const s of screened)
    console.log(`${s.item.id.padEnd(4)} ${s.item.kind.padEnd(10)} ${isQuarantined(s) ? "QUARANTINED" : "clear      "} ${s.cached ? "cached" : "screened"}  ${s.verdict?.category ?? "unscreened"} ${s.verdict?.confidence ?? ""}`);
  console.log(`${screened.filter(isQuarantined).length} of ${screened.length} quarantined.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
