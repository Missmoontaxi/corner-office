// Trace writer. Locally and in CI, traces append to a JSON Lines file when TRACE_DIR is set.
// The Redis store with its 30-day TTL arrives with the live-run work, behind this same function.
import fs from "node:fs";
import path from "node:path";
import type { Receipt } from "./contracts";

export async function writeTrace(receipt: Receipt, extra: Record<string, unknown> = {}) {
  const dir = process.env.TRACE_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  const day = receipt.runAt.slice(0, 10);
  fs.appendFileSync(path.join(dir, `traces-${day}.jsonl`), JSON.stringify({ receipt, ...extra }) + "\n");
}
