// Layer 4 of the guard pipeline (OWASP LLM10). After the model writes, every email address, URL and domain
// in the brief must appear in the material the model was allowed to read. Anything else is stripped, so an
// address smuggled in by a missed attack never reaches the page, MCP or a hand-off.
import type { BriefV1, DayV1, Receipt } from "../contracts";

export const REMOVED = "[address removed]";

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_RE = /\bhttps?:\/\/[^\s)>\]"']+/gi;
// Bare domains on the reserved .example TLD, plus the common real ones a model might invent.
const DOMAIN = /\b(?:[a-z0-9-]+\.)+(?:example|com|org|net|io|ai|co)\b/gi;

export type Allowlist = { emails: Set<string>; domains: Set<string> };

// Built from the quarantined material only, so a quarantined item's addresses are never on it.
export function allowlistFor(material: DayV1, companyDomain = "carebird.example"): Allowlist {
  const text = JSON.stringify({ inbox: material.inbox, newsletters: material.newsletters, calendar: material.calendar }).toLowerCase();
  const emails = new Set(text.match(EMAIL) ?? []);
  const domains = new Set([companyDomain, ...[...emails].map((e) => e.split("@")[1]!)]);
  return { emails, domains };
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "";
  }
};

export function filterText(text: string, allow: Allowlist): { text: string; stripped: string[] } {
  const stripped: string[] = [];
  const strip = (m: string) => (stripped.push(m), REMOVED);
  let out = text.replace(EMAIL, (m) => (allow.emails.has(m.toLowerCase()) ? m : strip(m)));
  out = out.replace(URL_RE, (m) => (allow.domains.has(hostOf(m)) ? m : strip(m)));
  // Bare domains, skipping any left inside an allowed address.
  out = out.replace(DOMAIN, (m, offset: number, whole: string) => {
    if (whole[offset - 1] === "@" || allow.domains.has(m.toLowerCase())) return m;
    return strip(m);
  });
  return { text: out, stripped };
}

// Applies the filter to every string in the brief and reports what it removed.
export function filterBrief(brief: BriefV1, allow: Allowlist): { brief: BriefV1; stripped: string[] } {
  const stripped: string[] = [];
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = filterText(v, allow);
      stripped.push(...r.stripped);
      return r.text;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "source_ids" || k === "event_ids" ? x : walk(x)]));
    return v;
  };
  return { brief: walk(brief) as BriefV1, stripped };
}

export function filterGuardrails(stripped: string[]): Receipt["guardrails"] {
  if (!stripped.length) return [];
  return [{ owasp: "LLM10", layer: "output filter", category: "unlisted address", action: "stripped", detail: `Removed ${stripped.length}: ${[...new Set(stripped)].join(", ")}` }];
}
