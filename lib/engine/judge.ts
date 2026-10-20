// Grades one brief on one judged criterion, with a judge from the other vendor.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { BriefV1, DayV1, Receipt } from "./contracts";
import { runStructured } from "./run";

export const JUDGE_PROMPT_VERSION = "judge.v1";
const Verdict = z.object({ passed: z.boolean(), reason: z.string() });

export type JudgeInput = {
  criterion: { id: string; criterion: string; pass_if: string; fail_if: string };
  expectations: Record<string, unknown>;
  day: DayV1;
  brief: BriefV1;
  judgedModel: string;
  // Decisions open before today, which the brief saw too, so carry-over marks can be checked.
  openBefore?: { question: string; detail?: string }[];
  client: Receipt["client"];
};

export async function judge(input: JudgeInput) {
  const system = fs.readFileSync(path.join(process.cwd(), "prompts", `${JUDGE_PROMPT_VERSION}.md`), "utf8");
  const { planted: _p, ...material } = input.day;
  const c = input.criterion;
  const prompt = [
    `<criterion id="${c.id}">\n${c.criterion}\nPass if: ${c.pass_if || "(not given)"}\nFail if: ${c.fail_if || "(not given)"}\n</criterion>`,
    `<expectations>\n${JSON.stringify(input.expectations, null, 1)}\n</expectations>`,
    ...(input.openBefore?.length ? [`<open_before_today>\nDecisions that were open yesterday. Some were settled since. Only those the material still shows as open should carry over.\n${JSON.stringify(input.openBefore)}\n</open_before_today>`] : []),
    `<material>\n${JSON.stringify(material)}\n</material>`,
    `<brief>\n${JSON.stringify(input.brief, null, 1)}\n</brief>`,
  ].join("\n\n");
  const { output, receipt } = await runStructured({
    task: "judge.ci",
    system,
    prompt,
    schema: Verdict,
    promptVersion: JUDGE_PROMPT_VERSION,
    client: input.client,
    runKind: "live",
    judgedModel: input.judgedModel,
  });
  return { ...output, judge: receipt.route.model, receipt };
}
