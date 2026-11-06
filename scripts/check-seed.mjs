// Validates the seed universe in persona/executive-life against the World Guardrails.
// Usage: node scripts/check-seed.mjs   (exits 1 on any failure)
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.SEED_ROOT ?? "persona/executive-life";
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const rows = (f) => load(f).rows;

const files = {
  brand: ["brand.json", /^S\d{2}$/], cast: ["cast.json", /^C\d{2}$/], kpis: ["kpis.json", /^K\d{2}$/],
  calendar: ["show-day/calendar.json", /^E\d{2}$/], decisions: ["show-day/decisions.json", /^D\d$/],
  inbox: ["inbox/index.json", /^M\d{2}$/], newsletters: ["newsletters/index.json", /^N\d{2}$/],
  facts: ["household/facts.json", /^F\d{2}$/], rights: ["household/rights.json", /^R\d{2}$/],
  tasks: ["household/tasks.json", /^T\d{2}$/], providers: ["household/providers.json", /^PR\d{2}$/],
};
const data = {};
for (const [key, [f, pattern]] of Object.entries(files)) {
  data[key] = rows(f);
  const seen = new Set();
  for (const r of data[key]) {
    if (!pattern.test(r.id)) fail(f, `bad id ${r.id}`);
    if (seen.has(r.id)) fail(f, `duplicate id ${r.id}`);
    seen.add(r.id);
  }
}

// Every text file in the universe, for the copy rules
const texts = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".json")) texts.push([p, fs.readFileSync(p, "utf8")]);
  }
})(ROOT);

// Public terms live here. Private ones (retired working names, real companies) live one per line in .denylist,
// which stays outside git so the list itself never goes public.
const denylist = ["peptide", "sandwich generation"];
if (fs.existsSync(".denylist"))
  denylist.push(...fs.readFileSync(".denylist", "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));

const kpiIds = new Set(data.kpis.map((k) => k.id));
for (const [p, t] of texts) {
  if (/[–—]/.test(t)) fail(p, "contains an em or en dash");
  for (const m of t.matchAll(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g)) if (!m[1].endsWith(".example")) fail(p, `address not on .example: ${m[0]}`);
  for (const m of t.matchAll(/https?:\/\/([\w.-]+)/g)) if (!m[1].endsWith(".example")) fail(p, `URL not on .example: ${m[0]}`);
  for (const m of t.matchAll(/\bK\d{2}\b/g)) if (!kpiIds.has(m[0])) fail(p, `refers to missing KPI ${m[0]}`);
  for (const word of denylist) if (t.toLowerCase().includes(word.toLowerCase())) fail(p, `denylisted term "${word}"`);
}

// Relative dates only
const day = /^D(0|[+-]\d+)( \d{2}:\d{2})?$/;
for (const r of data.calendar) if (!day.test(r.day)) fail("calendar", `${r.id} day ${r.day}`);
for (const r of data.facts) if (!day.test(r.dated)) fail("facts", `${r.id} dated ${r.dated}`);
for (const r of data.inbox) if (!day.test(r.received)) fail("inbox", `${r.id} received ${r.received}`);

// The status ladder and its proof
const onLadder = ["sent", "requested", "confirmed", "completed"];
const offLadder = ["declined by the person", "cancelled by provider", "no-show", "no provider found"];
const proofs = ["per provider", "receipt", "per Mom"];
const providerIds = new Set(data.providers.map((p) => p.id));
for (const t of data.tasks) {
  if (![...onLadder, ...offLadder].includes(t.status)) fail("tasks", `${t.id} unknown status "${t.status}"`);
  if (t.status === "completed" && !proofs.includes(t.proof)) fail("tasks", `${t.id} completed without named proof`);
  if (t.status !== "completed" && t.proof) fail("tasks", `${t.id} has proof but is not completed`);
  if (t.provider && !providerIds.has(t.provider)) fail("tasks", `${t.id} points to missing provider ${t.provider}`);
  if (!day.test(t.due)) fail("tasks", `${t.id} due ${t.due}`);
}

// P2, every provider carries a type, a scope and a verified date
for (const p of data.providers) {
  if (!p.type || !p.scope) fail("providers", `${p.id} missing type or scope`);
  if (!/^D-\d+$/.test(p.verified_on ?? "")) fail("providers", `${p.id} verified_on ${p.verified_on}`);
}
// Clinical foot care is never booked with a nail technician
const byId = Object.fromEntries(data.providers.map((p) => [p.id, p]));
for (const t of data.tasks) if (t.plan_item === "Foot care" && /nail/i.test(byId[t.provider]?.type ?? "")) fail("tasks", `${t.id} books foot care with a nail technician`);

// P5, agents disclose, offer the care lead, and never talk to the member
for (const c of load("household/calls.json").calls) {
  const first = c.turns.find((t) => t.speaker === "agent");
  if (!first || !/AI agent calling for CareBird on behalf of/.test(first.text)) fail("calls", `${c.id} first agent turn lacks the disclosure`);
  if (first && !/care lead/.test(first.text)) fail("calls", `${c.id} first agent turn does not offer the care lead`);
  if (c.turns.some((t) => t.speaker === "member")) fail("calls", `${c.id} an agent talks to the member`);
  if (!c.release_on_file) fail("calls", `${c.id} called without a release on file`);
  if (!providerIds.has(c.provider)) fail("calls", `${c.id} missing provider ${c.provider}`);
  // A call never claims a booking the office has not confirmed, and an open request names its retry.
  if (!/^(requested, not confirmed|confirmed by the office)$/.test(c.outcome)) fail("calls", `${c.id} outcome must be "requested, not confirmed" or "confirmed by the office"`);
  if (c.outcome === "requested, not confirmed" && !/\bD[0+-]\d*\s+\d{1,2}:\d{2}\b/.test(c.next ?? "")) fail("calls", `${c.id} open request has no retry time`);
}

// Every email has a body, and the planted item is marked
const bodies = load("inbox/bodies.json").bodies;
for (const m of data.inbox) if (!bodies[m.id]) fail("inbox", `${m.id} has no body`);
for (const m of data.inbox) if (m.flag === "planted" && !bodies[m.id]?.planted) fail("inbox", `${m.id} planted item not marked in bodies`);

if (errors.length) {
  console.error(`Seed check failed, ${errors.length} problem(s):\n- ` + errors.join("\n- "));
  process.exit(1);
}
const counts = Object.entries(data).map(([k, v]) => `${k} ${v.length}`).join(", ");
console.log(`Seed check passed. ${counts}.`);
