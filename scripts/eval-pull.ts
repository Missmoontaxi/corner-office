// Downloads Paula's "Digest Evals" Google Sheet tabs (Rubric, Cases, Labels) into evals/digest/*.csv.
// The sheet is link-shared view-only and every byte in it is fictional. Its id lives in
// evals/digest/sheet-id.txt, or EVAL_SHEET_ID for a one-off.
// Usage: pnpm eval:pull
import fs from "node:fs";
import path from "node:path";
import { DIGEST, parseCsv } from "../evals/lib";

const TABS: [string, string][] = [["Rubric", "rubric.csv"], ["Cases", "cases.csv"], ["Labels", "labels.csv"]];

async function main() {
  const idFile = path.join(DIGEST, "sheet-id.txt");
  const id = process.env.EVAL_SHEET_ID ?? (fs.existsSync(idFile) ? fs.readFileSync(idFile, "utf8").trim() : "");
  if (!id) {
    console.error("No sheet id. Put the id from the Sheet's URL in evals/digest/sheet-id.txt.");
    process.exit(1);
  }
  for (const [tab, file] of TABS) {
    const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok || text.trimStart().startsWith("<")) {
      console.error(`${tab}: could not read the tab (HTTP ${res.status}). Check the Sheet is shared as "Anyone with the link can view" and the tab is named ${tab}.`);
      process.exit(1);
    }
    fs.writeFileSync(path.join(DIGEST, file), text.endsWith("\n") ? text : text + "\n");
    console.log(`${tab}: ${parseCsv(text).length} rows`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
