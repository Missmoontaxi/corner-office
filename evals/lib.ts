// Shared helpers for the Daily Digest evals: Paula's rubric and cases from CSV, and the day files.
import fs from "node:fs";
import path from "node:path";
import { DayV1 } from "../lib/engine/contracts";

// EVAL_DIGEST_DIR points the harness elsewhere, for example a scratch folder when testing the plumbing.
export const DIGEST = process.env.EVAL_DIGEST_DIR ?? path.join(process.cwd(), "evals", "digest");

// RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const list = (v: string) => v.split(";").map((s) => s.trim()).filter(Boolean);

export type Criterion = { id: string; criterion: string; pass_if: string; fail_if: string; check_type: string; must_pass: boolean };
export type Case = {
  case_id: string;
  scenario: string;
  day_brief: string;
  must_surface: string[];
  must_not_say: string[];
  top_3_priorities: string[];
  decisions_needed: string[];
  max_words: number;
  judge_notes: string;
  split: string;
};

export function loadRubric(): Criterion[] {
  return parseCsv(fs.readFileSync(path.join(DIGEST, "rubric.csv"), "utf8")).map((r) => ({
    id: r.id!,
    criterion: r.criterion!,
    pass_if: r.pass_if ?? "",
    fail_if: r.fail_if ?? "",
    check_type: (r.check_type ?? "judge").toLowerCase(),
    must_pass: /^y/i.test(r.must_pass ?? ""),
  }));
}

export function loadCases(): Case[] {
  return parseCsv(fs.readFileSync(path.join(DIGEST, "cases.csv"), "utf8")).map((r) => ({
    case_id: r.case_id!,
    scenario: r.scenario ?? "",
    day_brief: r.day_brief ?? "",
    must_surface: list(r.must_surface ?? ""),
    must_not_say: list(r.must_not_say ?? ""),
    top_3_priorities: list(r.top_3_priorities ?? ""),
    decisions_needed: list(r.decisions_needed ?? ""),
    max_words: Number(r.max_words) || 250,
    judge_notes: r.judge_notes ?? "",
    split: r.split ?? "",
  }));
}

export function dayPath(caseId: string) {
  return path.join(DIGEST, "days", `${caseId}.json`);
}

export function loadDay(caseId: string): DayV1 {
  return DayV1.parse(JSON.parse(fs.readFileSync(dayPath(caseId), "utf8")));
}
