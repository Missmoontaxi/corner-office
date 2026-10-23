// The desk's prompt keys. Paula approved the six questions on Thu 10/22. Each answer runs once through the
// same guard pipeline as the brief (screen, quarantine, output filter) and is served from a recording, so a
// tap costs the visitor nothing.
import fs from "node:fs";
import path from "node:path";
import { AskV1, type DayV1, type Receipt } from "./contracts";
import { briefSources } from "./brief";
import { allowlistFor, filterBrief, filterGuardrails } from "./guard/filter";
import { isQuarantined, quarantine, screenDay, screenGuardrails } from "./guard/screen";
import { runStructured, type RunResult } from "./run";
import type { BriefV1 } from "./contracts";

export const ASK_PROMPT_VERSION = "desk-ask.v1";
export const ASK_MAX_WORDS = 120;

export const PROMPT_KEYS = [
  { key: 1, question: "What needs my decision today?" },
  { key: 2, question: "Prep me for the 10:30 Harborline call" },
  { key: 3, question: "What changed overnight?" },
  { key: 4, question: "Who is waiting on me?" },
  { key: 5, question: "Prep me for Friday's board" },
  { key: 6, question: "What's on Mom's list this week?" },
] as const;

export function askText(a: AskV1) {
  return [...a.lines.map((l) => l.text), ...a.flagged.map((f) => f.reason)].join("\n");
}

export type GuardedAsk = RunResult<AskV1> & { quarantined: string[]; stripped: string[] };

export async function runGuardedAsk(
  day: DayV1,
  question: string,
  opts: { client: Receipt["client"]; runKind: Receipt["runKind"]; owner?: boolean; screenLive?: boolean },
): Promise<GuardedAsk> {
  const screened = await screenDay(day, { live: opts.screenLive ?? false, client: opts.client, save: opts.screenLive });
  const material = quarantine(day, screened);
  const quarantined = screened.filter(isQuarantined).map((s) => s.item.id);
  const system = fs
    .readFileSync(path.join(process.cwd(), "prompts", `${ASK_PROMPT_VERSION}.md`), "utf8")
    .replaceAll("{{name}}", day.persona.name.split(" ")[0]!)
    .replaceAll("{{role}}", day.persona.role)
    .replaceAll("{{company}}", day.persona.company)
    .replaceAll("{{max_words}}", String(ASK_MAX_WORDS))
    // Models overshoot a stated limit, so the prompt also gives a lower target, as the brief does.
    .replaceAll("{{target_words}}", String(Math.round((ASK_MAX_WORDS * 0.75) / 10) * 10));
  const { planted: _omit, ...data } = material;
  const prompt = `Today is ${day.date_label}. The question is "${question}".\n\n<material>\n${JSON.stringify(data, null, 1)}\n</material>`;
  const { output, receipt } = await runStructured({
    task: "desk.ask.precompute",
    system,
    prompt,
    schema: AskV1,
    promptVersion: ASK_PROMPT_VERSION,
    client: opts.client,
    runKind: opts.runKind,
    owner: opts.owner,
    sources: briefSources(material),
  });

  const flagged = [...output.flagged];
  for (const id of quarantined)
    if (!flagged.some((f) => f.source_id === id)) flagged.push({ source_id: id, kind: "suspicious", reason: "Screened before the answer was written. Quarantined, not followed." });
  // The filter walks any object, so the answer goes through the same address check as the brief.
  const filtered = filterBrief({ ...output, flagged } as unknown as BriefV1, allowlistFor(material));
  return {
    output: filtered.brief as unknown as AskV1,
    receipt: { ...receipt, guardrails: [...receipt.guardrails, ...screenGuardrails(screened), ...filterGuardrails(filtered.stripped)] },
    quarantined,
    stripped: filtered.stripped,
  };
}
