// Picks alias, model chain, effort and caps for a task, and says why in plain English.
import { policy } from "./policy";
import type { Effort } from "./contracts";

export type Mode = "fast" | "balanced" | "deep";
export type Route = {
  task: string;
  alias: string;
  chain: string[];
  effort: Effort;
  maxOutput: number;
  reason: string;
};

export function vendorOf(model: string) {
  const entry = policy().models.models[model];
  if (!entry) throw new Error(`Unknown model ${model}`);
  return entry.vendor;
}

export function route(task: string, opts: { mode?: Mode; owner?: boolean; judgedModel?: string } = {}): Route {
  const { models, routing } = policy();
  const t = routing.tasks[task];
  if (!t) throw new Error(`No routing rule for task ${task}`);

  const mode = opts.mode ?? "balanced";
  const alias = t.alias === "mode" ? routing.modes[mode] : t.alias;
  if (!alias) throw new Error(`No alias for mode ${mode}`);
  const a = models.aliases[alias];
  if (!a) throw new Error(`Unknown alias ${alias}`);
  if (a.access?.includes("owner") && !opts.owner) {
    return route(task, { ...opts, mode: "balanced" });
  }

  let chain = [a.primary, a.fallback];
  let why = `${task}, ${alias}, ${a.primary}. Fallback ${a.fallback}.`;
  // A judge never grades its own vendor's work.
  if (t.cross_vendor && opts.judgedModel) {
    const judged = vendorOf(opts.judgedModel);
    chain = chain.filter((m) => vendorOf(m) !== judged);
    why = `${task}, ${alias}, ${chain[0]}, the other vendor from ${opts.judgedModel}.`;
  }
  for (const m of chain) {
    if (models.blocked.includes(m)) throw new Error(`Blocked model ${m} in chain for ${task}`);
  }
  return { task, alias, chain, effort: t.effort, maxOutput: t.max_output, reason: why };
}
