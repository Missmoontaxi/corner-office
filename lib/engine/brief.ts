// The desk brief task: builds the prompt from a day and runs it through the engine.
import fs from "node:fs";
import path from "node:path";
import { BriefV1, type DayV1, type Receipt } from "./contracts";
import { runStructured, type RunResult } from "./run";
import type { Mode } from "./router";

export const BRIEF_PROMPT_VERSION = "desk-brief.v3";
// The product's word limit for a brief. Paula owns this number; R7 checks each case against its own limit.
export const BRIEF_MAX_WORDS = 250;

function template() {
  return fs.readFileSync(path.join(process.cwd(), "prompts", `${BRIEF_PROMPT_VERSION}.md`), "utf8");
}

// Decisions still open from an earlier day, so the brief can mark the ones that carry over.
export type OpenDecision = { question: string; detail?: string };

export function briefMessages(day: DayV1, openBefore: OpenDecision[] = []) {
  const system = template()
    .replaceAll("{{name}}", day.persona.name.split(" ")[0]!)
    .replaceAll("{{role}}", day.persona.role)
    .replaceAll("{{company}}", day.persona.company)
    .replaceAll("{{max_words}}", String(BRIEF_MAX_WORDS))
    // Models overshoot a stated limit, so the prompt also gives a target about 20 percent lower.
    .replaceAll("{{target_words}}", String(Math.round((BRIEF_MAX_WORDS * 0.8) / 10) * 10));
  // Stable instructions go first for prompt caching. The day goes last, as data inside a fence.
  const { planted: _omit, ...material } = day;
  const before = openBefore.length ? `\n\n<open_before_today>\n${JSON.stringify(openBefore, null, 1)}\n</open_before_today>` : "";
  const prompt = `Today is ${day.date_label}. Write today's brief from this material.${before}\n\n<material>\n${JSON.stringify(material, null, 1)}\n</material>`;
  return { system, prompt };
}

export function briefSources(day: DayV1): Receipt["sources"] {
  return [
    ...day.inbox.map((m) => ({ kind: "email" as const, id: m.id })),
    ...day.calendar.map((e) => ({ kind: "calendar" as const, id: e.id })),
    ...day.kpis.map((k) => ({ kind: "kpi" as const, id: k.id })),
    ...day.newsletters.map((n) => ({ kind: "newsletter" as const, id: n.id })),
  ];
}

export async function runBrief(
  day: DayV1,
  opts: { task?: "desk.brief.precompute" | "desk.brief.live"; mode?: Mode; client: Receipt["client"]; runKind: Receipt["runKind"]; owner?: boolean; model?: string; openBefore?: OpenDecision[] },
): Promise<RunResult<BriefV1>> {
  const { system, prompt } = briefMessages(day, opts.openBefore);
  return runStructured({
    task: opts.task ?? "desk.brief.precompute",
    system,
    prompt,
    schema: BriefV1,
    promptVersion: BRIEF_PROMPT_VERSION,
    client: opts.client,
    runKind: opts.runKind,
    mode: opts.mode,
    owner: opts.owner,
    model: opts.model,
    sources: briefSources(day),
  });
}

// Every string in the brief, for word counts and the code checks.
export function briefText(b: BriefV1): string {
  const parts: string[] = [b.date.label, b.date.weather ?? "", ...b.date.observances];
  parts.push(b.headline.title, b.headline.context, b.headline.action);
  for (const p of b.priorities) parts.push(p.title, p.why, p.next_step);
  for (const d of b.decisions) parts.push(d.question, d.owner, d.due);
  for (const c of b.calendar) parts.push(c.line);
  for (const h of b.business_health) parts.push(h.line);
  for (const p of b.personal) parts.push(p.line);
  for (const f of b.flagged) parts.push(f.reason);
  return parts.filter(Boolean).join("\n");
}
