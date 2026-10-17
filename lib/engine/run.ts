// Runs one structured task down its model chain and returns the output with its receipt.
// Each attempt streams, so a stalled model is abandoned at the first-event timeout. A max-tokens stop,
// a refusal, a timeout, an error or invalid output each count as a failed attempt and the next model runs.
import { randomUUID } from "node:crypto";
import { Output, streamText } from "ai";
import type { z } from "zod";
import type { Receipt } from "./contracts";
import { activeDriver, languageModel, listCostMicroUsd } from "./drivers";
import { policy, policyVersion } from "./policy";
import { route, vendorOf, type Mode } from "./router";
import { writeTrace } from "./trace";

type Attempt = Receipt["route"]["attempts"][number];

export type RunInput<T> = {
  task: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  promptVersion: string;
  client: Receipt["client"];
  runKind: Receipt["runKind"];
  mode?: Mode;
  owner?: boolean;
  judgedModel?: string;
  sources?: Receipt["sources"];
};

export type RunResult<T> = { output: T; receipt: Receipt };

export class RunFailed extends Error {
  constructor(public receipt: Receipt) {
    super(`All models failed for ${receipt.task}: ${receipt.route.attempts.map((a) => `${a.model} ${a.outcome}`).join(", ")}`);
  }
}

const micro = (usd: unknown) => (usd == null || usd === "" ? null : Math.round(Number(usd) * 1e6));

export async function runStructured<T>(input: RunInput<T>): Promise<RunResult<T>> {
  const r = route(input.task, { mode: input.mode, owner: input.owner, judgedModel: input.judgedModel });
  const { timeouts } = policy().routing;
  const driver = activeDriver();
  const attempts: Attempt[] = [];
  const t0 = performance.now();
  const usage = { input: 0, cachedInput: 0, output: 0, thinking: 0 };
  let cost = 0;
  let firstEvent = -1;

  for (const model of r.chain) {
    const started = performance.now();
    const totalMs = vendorOf(model) === "openai" ? timeouts.total_ms_openai : timeouts.total_ms;
    const ctrl = new AbortController();
    let sawEvent = false;
    let timedOut = false;
    const firstTimer = setTimeout(() => { if (!sawEvent) { timedOut = true; ctrl.abort(); } }, timeouts.first_event_ms);
    const totalTimer = setTimeout(() => { timedOut = true; ctrl.abort(); }, totalMs);
    const { model: lm, providerOptions } = languageModel(model, driver);
    let outcome: Attempt["outcome"] = "error";
    let credential: string | undefined;
    try {
      const res = streamText({
        model: lm,
        system: input.system,
        prompt: input.prompt,
        reasoning: r.effort,
        maxOutputTokens: r.maxOutput,
        output: Output.object({ schema: input.schema }),
        providerOptions,
        abortSignal: ctrl.signal,
      });
      for await (const part of res.fullStream) {
        if (!sawEvent && part.type !== "start" && part.type !== "start-step") {
          sawEvent = true;
          if (firstEvent < 0) firstEvent = Math.round(performance.now() - t0);
        }
        if (part.type === "error") throw part.error;
      }
      const [u, finish, meta] = await Promise.all([res.usage, res.finishReason, res.providerMetadata]);
      usage.input += u.inputTokens ?? 0;
      usage.cachedInput += u.inputTokenDetails?.cacheReadTokens ?? 0;
      usage.output += u.outputTokens ?? 0;
      usage.thinking += u.outputTokenDetails?.reasoningTokens ?? 0;
      const gw = (meta?.gateway ?? {}) as { marketCost?: string; routing?: { modelAttempts?: { providerAttempts?: { credentialType?: string }[] }[] } };
      credential = gw.routing?.modelAttempts?.at(-1)?.providerAttempts?.at(-1)?.credentialType;
      cost += micro(gw.marketCost) ?? listCostMicroUsd(model, u.inputTokens ?? 0, u.outputTokens ?? 0);

      if (finish === "length") outcome = "max_tokens";
      else if (finish === "content-filter") outcome = "refusal";
      else {
        const parsed = input.schema.safeParse(await res.output);
        if (parsed.success) {
          attempts.push({ model, outcome: "ok", ms: Math.round(performance.now() - started), credential });
          const receipt = buildReceipt(input, r, driver, model, attempts, usage, cost, firstEvent, t0);
          await writeTrace(receipt, { output: parsed.data });
          return { output: parsed.data, receipt };
        }
        outcome = "error";
      }
    } catch {
      outcome = timedOut ? "timeout" : "error";
    } finally {
      clearTimeout(firstTimer);
      clearTimeout(totalTimer);
    }
    attempts.push({ model, outcome, ms: Math.round(performance.now() - started), credential });
  }

  const receipt = buildReceipt(input, r, driver, r.chain.at(-1)!, attempts, usage, cost, firstEvent, t0);
  await writeTrace(receipt, { failed: true });
  throw new RunFailed(receipt);
}

function buildReceipt<T>(
  input: RunInput<T>,
  r: ReturnType<typeof route>,
  driver: "gateway" | "direct",
  model: string,
  attempts: Attempt[],
  usage: Receipt["usage"],
  cost: number,
  firstEvent: number,
  t0: number,
): Receipt {
  return {
    traceId: randomUUID(),
    runKind: input.runKind,
    runAt: new Date().toISOString(),
    client: input.client,
    task: input.task,
    policyVersion: policyVersion(),
    promptVersion: input.promptVersion,
    route: { alias: r.alias, model, driver, effort: r.effort, reason: r.reason, fallbackChain: r.chain, attempts },
    usage,
    costMicroUsd: cost,
    latencyMs: { firstEvent: Math.max(firstEvent, 0), total: Math.round(performance.now() - t0) },
    guardrails: [],
    sources: input.sources ?? [],
  };
}
