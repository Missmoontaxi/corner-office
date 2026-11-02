// A dry run of the morning precompute. Runs the brief, the six prompt keys and the promote gate exactly as the
// cron does, prints the gate, and publishes nothing. Usage: pnpm precompute
import { precompute } from "../lib/engine/precompute";

precompute()
  .then((r) => {
    console.log(`${r.model}, $${(r.costMicroUsd / 1e6).toFixed(4)} for the brief and prompt keys, judges extra`);
    for (const g of r.gate.results) console.log(`${g.passed ? "pass" : "FAIL"}  ${g.id}  ${g.detail}`);
    console.log(r.snapshot ? "Gate passed. The cron would publish this run." : "Gate failed. The cron would keep the previous snapshot up.");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
