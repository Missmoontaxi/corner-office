// Rebuilds the readable day sheet from a day file after hand edits, without regenerating the day.
// Usage: pnpm eval:sheet C01 [C02 ...]
import fs from "node:fs";
import path from "node:path";
import { DIGEST, loadCases, loadDay } from "../evals/lib";
import { daySheet } from "./eval-fixtures";

for (const id of process.argv.slice(2)) {
  const c = loadCases().find((k) => k.case_id === id);
  if (!c) throw new Error(`No case ${id}`);
  const md = daySheet(c, loadDay(id)).replace("*Model-expanded from Paula's day brief with Opus 5.5.", "*Model-expanded from Paula's day brief with Opus 5.5, then edited by hand.");
  fs.writeFileSync(path.join(DIGEST, "days", `${id}.md`), md);
  console.log(`${id}: day sheet rebuilt`);
}
