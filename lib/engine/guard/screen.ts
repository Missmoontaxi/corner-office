// Layer 2 of the guard pipeline (OWASP LLM01). A small model screens every untrusted item before the brief
// model reads it. Verdicts are cached by content hash and prompt version, so seeded content is screened once
// and every later run reuses the verdict. Suspicious items are quarantined, so the brief model never sees them.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ScreenVerdict, type DayV1, type Receipt } from "../contracts";
import { runStructured } from "../run";

export const SCREEN_PROMPT_VERSION = "guard-screen.v1";
const CACHE = path.join(process.cwd(), "lib", "engine", "guard", "verdicts.json");

export type UntrustedItem = { kind: "email" | "newsletter" | "calendar"; id: string; text: string };
export type CachedVerdict = ScreenVerdict & { model: string; screenedAt: string };
type Cache = Record<string, CachedVerdict>;

// Everything that arrives from outside Alex's own hands. KPIs, tasks and decisions are seeded structure, not mail.
export function untrustedItems(day: DayV1): UntrustedItem[] {
  return [
    ...day.inbox.map((m) => ({ kind: "email" as const, id: m.id, text: `From: ${m.from} <${m.address}>\nSubject: ${m.subject}\n\n${m.body}` })),
    ...day.newsletters.map((n) => ({ kind: "newsletter" as const, id: n.id, text: `${n.publication}: ${n.title}\n\n${n.body}` })),
    ...day.calendar.filter((e) => e.notes?.trim()).map((e) => ({ kind: "calendar" as const, id: e.id, text: `${e.title}\n\n${e.notes}` })),
  ];
}

export function verdictKey(item: UntrustedItem) {
  return createHash("sha256").update(`${SCREEN_PROMPT_VERSION}\n${item.kind}\n${item.text}`).digest("hex").slice(0, 32);
}

export function loadVerdicts(file = CACHE): Cache {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Cache) : {};
}

function saveVerdicts(cache: Cache, file = CACHE) {
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(file, JSON.stringify(sorted, null, 1) + "\n");
}

async function screenOne(item: UntrustedItem, client: Receipt["client"]): Promise<CachedVerdict> {
  const system = fs.readFileSync(path.join(process.cwd(), "prompts", `${SCREEN_PROMPT_VERSION}.md`), "utf8");
  // The item goes in as data inside a fence, never as instructions.
  const prompt = `Screen this ${item.kind}.\n\n<untrusted>\n${JSON.stringify({ id: item.id, text: item.text })}\n</untrusted>`;
  const { output, receipt } = await runStructured({ task: "guard.screen", system, prompt, schema: ScreenVerdict, promptVersion: SCREEN_PROMPT_VERSION, client, runKind: "live" });
  return { ...output, model: receipt.route.model, screenedAt: receipt.runAt };
}

export type Screened = { item: UntrustedItem; verdict: CachedVerdict | null; cached: boolean };

// Screens a day. Cached verdicts are used first. A missing verdict is screened live only when allowed
// (the owner, the cron, the screen script); otherwise the item is held back as unscreened, which fails closed.
export async function screenDay(day: DayV1, opts: { live: boolean; client: Receipt["client"]; save?: boolean }): Promise<Screened[]> {
  const cache = loadVerdicts();
  const out: Screened[] = [];
  let changed = false;
  for (const item of untrustedItems(day)) {
    const key = verdictKey(item);
    if (cache[key]) out.push({ item, verdict: cache[key]!, cached: true });
    else if (opts.live) {
      const v = await screenOne(item, opts.client);
      cache[key] = v;
      changed = true;
      out.push({ item, verdict: v, cached: false });
    } else out.push({ item, verdict: null, cached: false });
  }
  if (changed && opts.save) saveVerdicts(cache);
  return out;
}

// A low-confidence hit is still quarantined. The cost of hiding one real email is a line in the brief,
// while the cost of passing an attack is the whole point of the screen.
export const isQuarantined = (s: Screened) => s.verdict === null || s.verdict.suspicious;

export function screenGuardrails(screened: Screened[]): Receipt["guardrails"] {
  return screened.filter(isQuarantined).map((s) => ({
    owasp: "LLM01",
    layer: "screen",
    category: s.verdict ? s.verdict.category : "unscreened",
    action: "quarantined" as const,
    detail: s.verdict ? `${s.item.id}: ${s.verdict.reason}${s.verdict.evidence ? ` Evidence: "${s.verdict.evidence}"` : ""}` : `${s.item.id}: no cached verdict, held back unscreened`,
  }));
}

// The material the brief model may read, which is the day with every quarantined item removed.
export function quarantine(day: DayV1, screened: Screened[]): DayV1 {
  const out = new Set(screened.filter(isQuarantined).map((s) => `${s.item.kind}:${s.item.id}`));
  return {
    ...day,
    inbox: day.inbox.filter((m) => !out.has(`email:${m.id}`)),
    newsletters: day.newsletters.filter((n) => !out.has(`newsletter:${n.id}`)),
    calendar: day.calendar.map((e) => (out.has(`calendar:${e.id}`) ? { ...e, notes: "" } : e)),
  };
}
