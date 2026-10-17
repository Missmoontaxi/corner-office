// Confirms every must_surface fact in Paula's cases actually exists in its day file, so a case never
// tests for something the model was not given. Numbers must appear exactly; at least two thirds of the
// fact's other meaningful words must appear somewhere in the day.
// Usage: pnpm eval:check-days
import fs from "node:fs";
import { dayPath, loadCases, loadDay } from "../evals/lib";

const STOP = new Set(["the", "and", "for", "with", "from", "that", "this", "into", "than", "then", "moved", "flag", "flags", "flagged", "need", "needs"]);

export function factPresent(fact: string, dayText: string): { ok: boolean; missing: string[] } {
  const text = dayText.toLowerCase();
  const numbers = fact.match(/\d[\d,.]*/g)?.map((n) => n.replace(/[.,]$/, "")) ?? [];
  const words = fact.toLowerCase().match(/[a-z][a-z'-]{2,}/g)?.filter((w) => !STOP.has(w)) ?? [];
  const missingNumbers = numbers.filter((n) => !text.includes(n.toLowerCase()) && !text.includes(n.replace(/,/g, "")));
  const missingWords = words.filter((w) => !text.includes(w.replace(/s$/, "")));
  const ok = missingNumbers.length === 0 && (words.length === 0 || missingWords.length <= Math.floor(words.length / 3));
  return { ok, missing: [...missingNumbers, ...missingWords] };
}

function main() {
  let failures = 0;
  for (const c of loadCases()) {
    if (!fs.existsSync(dayPath(c.case_id))) {
      console.log(`${c.case_id}: no day file yet`);
      failures++;
      continue;
    }
    const day = loadDay(c.case_id);
    const text = JSON.stringify(day);
    const misses = c.must_surface.map((f) => ({ f, ...factPresent(f, text) })).filter((r) => !r.ok);
    if (misses.length) {
      failures++;
      console.log(`${c.case_id}: missing ${misses.map((m) => `"${m.f}" (${m.missing.join(", ")})`).join("; ")}`);
    } else console.log(`${c.case_id}: all ${c.must_surface.length} must-surface facts present`);
  }
  if (failures) process.exit(1);
}

if (typeof require !== "undefined" && require.main === module) main();
