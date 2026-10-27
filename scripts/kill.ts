// The live-run kill switch. "on" stops every live run within a second, with no deploy. The desk keeps
// showing the recorded runs. KILL_SWITCH=on in Vercel is the second lock, for when Redis itself is in trouble.
// Usage: pnpm kill on | off | status
import { setKill, status } from "../lib/live/ledger";

async function main() {
  const arg = process.argv[2];
  if (arg === "on" || arg === "off") await setKill(arg === "on");
  else if (arg !== "status") throw new Error("Usage: pnpm kill on | off | status");
  const s = await status();
  console.log(`Live runs ${s.paused ? "PAUSED" : "on"}. Spent today $${(s.spentMicroUsd / 1e6).toFixed(3)} of $${(s.capMicroUsd / 1e6).toFixed(2)}.`);
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
