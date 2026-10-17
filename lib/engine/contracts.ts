// The engine's contracts: policy files, the day input, the brief output and the receipt.
// Every surface (desk, Engine Room, MCP, evals) reads these shapes and nothing else.
import { z } from "zod";

// Policy

export const ModelEntry = z.object({
  vendor: z.enum(["anthropic", "openai"]),
  gateway: z.string(),
  direct: z.string(),
  in: z.number(),
  out: z.number(),
  no_retire_before: z.union([z.string(), z.date()]).optional(),
});
export const ModelsPolicy = z.object({
  version: z.string(),
  models: z.record(z.string(), ModelEntry),
  aliases: z.record(z.string(), z.object({ primary: z.string(), fallback: z.string(), access: z.array(z.string()).optional() })),
  blocked: z.array(z.string()),
});
export type ModelsPolicy = z.infer<typeof ModelsPolicy>;

export const Effort = z.enum(["low", "medium", "high"]);
export type Effort = z.infer<typeof Effort>;

export const RoutingPolicy = z.object({
  version: z.string(),
  modes: z.record(z.string(), z.string()),
  limits: z.object({ max_input_tokens: z.number() }),
  tasks: z.record(
    z.string(),
    z.object({
      alias: z.string(),
      effort: Effort,
      max_output: z.number(),
      schema: z.string().optional(),
      cross_vendor: z.boolean().optional(),
      total_ms: z.number().optional(),
    }),
  ),
  timeouts: z.object({ first_event_ms: z.number(), total_ms: z.number(), total_ms_openai: z.number() }),
});
export type RoutingPolicy = z.infer<typeof RoutingPolicy>;

// The day a brief is written from. The seed's show day and every eval day file share this shape.

export const DayV1 = z.object({
  day_id: z.string(),
  date_label: z.string(),
  persona: z.object({ name: z.string(), role: z.string(), company: z.string() }),
  calendar: z.array(z.object({ id: z.string(), start: z.string(), end: z.string(), title: z.string(), attendees: z.string().optional(), notes: z.string().optional() })),
  inbox: z.array(z.object({ id: z.string(), from: z.string(), address: z.string(), subject: z.string(), received: z.string(), body: z.string() })),
  newsletters: z.array(z.object({ id: z.string(), publication: z.string(), title: z.string(), body: z.string() })),
  kpis: z.array(z.object({ id: z.string(), metric: z.string(), value: z.union([z.number(), z.string()]), unit: z.string().optional() })),
  decisions: z.array(z.object({ id: z.string(), question: z.string(), detail: z.string().optional() })),
  tasks: z.array(z.object({ id: z.string(), task: z.string(), owner: z.string().optional(), due: z.string().optional(), status: z.string().optional() })),
  // The planted attack, when the day carries one. R8 checks that this address never appears in output.
  planted: z.object({ source_id: z.string(), attacker_address: z.string() }).optional(),
});
export type DayV1 = z.infer<typeof DayV1>;

// The brief

const ids = z.array(z.string()).describe("ids of the inbox, calendar, kpi, decision or newsletter items this rests on");
export const BriefV1 = z.object({
  headline: z.string().describe("One calm sentence: the single most important thing today"),
  lead: z.object({ title: z.string(), detail: z.string(), source_ids: ids }).describe("The biggest change since yesterday, first"),
  priorities: z.array(z.object({ title: z.string(), why: z.string(), next_step: z.string(), source_ids: ids })).max(3),
  decisions: z.array(z.object({ decision: z.string(), owner: z.string(), due: z.string(), source_ids: ids })),
  conflicts: z.array(z.object({ summary: z.string(), event_ids: z.array(z.string()) })),
  newsletter_notes: z.array(z.object({ so_what: z.string(), source_id: z.string() })),
  flagged: z.array(z.object({ source_id: z.string(), reason: z.string() })).describe("Suspicious content noticed and not acted on"),
});
export type BriefV1 = z.infer<typeof BriefV1>;

export const ScreenVerdict = z.object({ suspicious: z.boolean(), category: z.string(), reason: z.string() });

// The receipt, plan section 3.9

export const GuardAction = z.enum(["flagged", "quarantined", "blocked", "stripped", "degraded"]);
export const AttemptOutcome = z.enum(["ok", "fallback", "refusal", "timeout", "max_tokens", "error"]);

export const Receipt = z.object({
  traceId: z.string(),
  runKind: z.enum(["precomputed", "live", "replay", "cached"]),
  runAt: z.string(),
  client: z.enum(["web", "mcp:claude", "mcp:chatgpt", "mcp:other", "cron", "ci"]),
  task: z.string(),
  policyVersion: z.string(),
  promptVersion: z.string(),
  route: z.object({
    alias: z.string(),
    model: z.string(),
    driver: z.enum(["gateway", "direct"]),
    effort: Effort,
    reason: z.string(),
    fallbackChain: z.array(z.string()),
    attempts: z.array(z.object({ model: z.string(), outcome: AttemptOutcome, ms: z.number(), credential: z.string().optional() })),
  }),
  usage: z.object({ input: z.number(), cachedInput: z.number(), output: z.number(), thinking: z.number() }),
  costMicroUsd: z.number(),
  latencyMs: z.object({ firstEvent: z.number(), total: z.number() }),
  eval: z
    .object({
      rubricVersion: z.string(),
      mustPassOk: z.boolean(),
      pending: z.boolean(),
      criteria: z.array(z.object({ id: z.string(), label: z.string(), passed: z.boolean(), checkedBy: z.string() })),
    })
    .optional(),
  guardrails: z.array(z.object({ owasp: z.string(), layer: z.string(), category: z.string(), action: GuardAction, detail: z.string().optional() })),
  sources: z.array(z.object({ kind: z.enum(["email", "newsletter", "calendar", "kpi", "project", "meeting"]), id: z.string() })),
});
export type Receipt = z.infer<typeof Receipt>;

// The only receipt shape MCP tools and hand-offs may return
export function toMcpReceipt(r: Receipt) {
  return {
    traceId: r.traceId,
    runKind: r.runKind,
    runAt: r.runAt,
    task: r.task,
    policyVersion: r.policyVersion,
    usage: r.usage,
    costMicroUsd: r.costMicroUsd,
    latencyMs: r.latencyMs,
    route: { alias: r.route.alias, model: r.route.model, effort: r.route.effort },
    eval: r.eval && {
      rubricVersion: r.eval.rubricVersion,
      passedCount: r.eval.criteria.filter((c) => c.passed).length,
      total: r.eval.criteria.length,
      mustPassOk: r.eval.mustPassOk,
    },
    guardrails: r.guardrails.map(({ owasp, layer, category, action }) => ({ owasp, layer, category, action })),
  };
}
