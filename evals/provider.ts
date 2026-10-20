// promptfoo provider: writes the brief for one case's day with one pinned model, through our engine.
// The output carries the brief and the model, so the assertions know which vendor's judge to use.
import { runBrief } from "../lib/engine/brief";
import { RunFailed } from "../lib/engine/run";
import { loadDay, openBefore } from "./lib";

type Ctx = { vars: Record<string, string> };

export default class BriefProvider {
  private model: string;
  constructor(options: { id?: string; config?: { model?: string } } = {}) {
    this.model = options.config?.model ?? "claude-sonnet-5-5";
  }
  id() {
    return `corner-office:${this.model}`;
  }
  async callApi(_prompt: string, context: Ctx) {
    const caseId = context.vars.case_id!;
    try {
      const { output, receipt } = await runBrief(loadDay(caseId), { client: "ci", runKind: "precomputed", model: this.model, openBefore: openBefore(caseId) });
      return {
        output: JSON.stringify({ model: this.model, brief: output }),
        cost: receipt.costMicroUsd / 1e6,
        tokenUsage: { prompt: receipt.usage.input, completion: receipt.usage.output, total: receipt.usage.input + receipt.usage.output },
        metadata: { traceId: receipt.traceId, latencyMs: receipt.latencyMs.total },
      };
    } catch (e) {
      const why = e instanceof RunFailed ? e.message : String(e);
      return { error: `${caseId} on ${this.model}: ${why}` };
    }
  }
}

