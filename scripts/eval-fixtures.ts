// Expands Paula's day briefs into day files with Opus 5.5, and writes a one-page day sheet for each.
// The planted attack is never model-written: adversarial days get the seed's planted email verbatim.
// Usage: pnpm eval:fixtures D01 D07   (or --all for every case without a day file)
import fs from "node:fs";
import path from "node:path";
import { DayV1 } from "../lib/engine/contracts";
import { runStructured } from "../lib/engine/run";
import { loadShowDay } from "../lib/engine/sources/seed";
import { DIGEST, dayPath, loadCases, type Case } from "../evals/lib";

import { z } from "zod";

// OpenAI's strict structured output needs every field required, so the generator fills blanks with "".
const Generated = z.object({
  date_label: z.string(),
  context: z.object({ weather: z.string(), observances: z.array(z.string()) }),
  calendar: z.array(z.object({ id: z.string(), start: z.string(), end: z.string(), title: z.string(), attendees: z.string(), notes: z.string() })),
  inbox: z.array(z.object({ id: z.string(), from: z.string(), address: z.string(), subject: z.string(), received: z.string(), body: z.string() })),
  newsletters: z.array(z.object({ id: z.string(), publication: z.string(), title: z.string(), body: z.string() })),
  kpis: z.array(z.object({ id: z.string(), metric: z.string(), value: z.string(), unit: z.string() })),
  decisions: z.array(z.object({ id: z.string(), question: z.string(), detail: z.string() })),
  tasks: z.array(z.object({ id: z.string(), task: z.string(), owner: z.string(), due: z.string(), status: z.string() })),
});

function background() {
  const seed = loadShowDay();
  return {
    persona: seed.persona,
    company_kpis: seed.kpis,
    people: JSON.parse(fs.readFileSync(path.join(process.cwd(), "persona", "executive-life", "cast.json"), "utf8")).rows.map((r: Record<string, string>) => ({ name: r.name, role: r.role, email: r.email })),
  };
}

function daySheet(c: Case, day: DayV1): string {
  const lines = [
    `# ${c.case_id}, ${c.scenario}`,
    "",
    `*Model-expanded from Paula's day brief with Opus 5.5. Edit anything that rings false, then rerun \`pnpm eval:fixtures ${c.case_id}\` or edit the JSON directly.*`,
    "",
    `**Day brief.** ${c.day_brief}`,
    "",
    `**Must surface.** ${c.must_surface.join("; ")}`,
    "",
    `**The date.** ${day.date_label}${day.context?.weather ? `. Weather: ${day.context.weather}` : ""}${day.context?.observances?.length ? `. Today: ${day.context.observances.join("; ")}` : ""}`,
    "",
    "## Calendar",
    "",
    "| Id | Start | End | Event | With |",
    "|---|---|---|---|---|",
    ...day.calendar.map((e) => `| ${e.id} | ${e.start} | ${e.end} | ${e.title} | ${e.attendees ?? ""} |`),
    "",
    "## Inbox",
    "",
    ...day.inbox.flatMap((m) => [`### ${m.id}. ${m.subject}`, `*${m.from}, ${m.address}, ${m.received}*${day.planted?.source_id === m.id ? " (planted attack, added by the harness)" : ""}`, "", m.body, ""]),
    "## Newsletters",
    "",
    ...day.newsletters.flatMap((n) => [`**${n.id}. ${n.publication}: ${n.title}**`, "", n.body, ""]),
    "## KPIs",
    "",
    "| Id | Metric | Value |",
    "|---|---|---|",
    ...day.kpis.map((k) => `| ${k.id} | ${k.metric} | ${k.value}${k.unit ? ` ${k.unit}` : ""} |`),
    "",
    "## Open decisions",
    "",
    ...day.decisions.map((d) => `- **${d.id}.** ${d.question}${d.detail ? ` ${d.detail}` : ""}`),
    "",
    "## Tasks",
    "",
    ...day.tasks.map((t) => `- **${t.id}.** ${t.task}${t.owner ? `, ${t.owner}` : ""}${t.due ? `, due ${t.due}` : ""}`),
    "",
  ];
  return lines.join("\n");
}

async function build(c: Case) {
  const system = fs.readFileSync(path.join(process.cwd(), "prompts", "eval-fixture.v1.md"), "utf8");
  const prompt = [
    `<company_background>\n${JSON.stringify(background(), null, 1)}\n</company_background>`,
    `<case>\n${JSON.stringify({ scenario: c.scenario, day_brief: c.day_brief, must_surface: c.must_surface }, null, 1)}\n</case>`,
    "Build the day.",
  ].join("\n\n");
  const { output, receipt } = await runStructured({
    task: "eval.fixture",
    system,
    prompt,
    schema: Generated,
    promptVersion: "eval-fixture.v1",
    client: "ci",
    runKind: "live",
    owner: true,
  });
  const seed = loadShowDay();
  const kpis = output.kpis.map((k) => ({ ...k, value: /^-?[\d.]+$/.test(k.value) ? Number(k.value) : k.value }));
  let day: DayV1 = { ...output, kpis, day_id: c.case_id, persona: seed.persona };
  if (/advers/i.test(c.scenario) && seed.planted) {
    const planted = seed.inbox.find((m) => m.id === seed.planted!.source_id)!;
    const id = `M${String(day.inbox.length + 1).padStart(2, "0")}`;
    day = { ...day, inbox: [...day.inbox, { ...planted, id }], planted: { source_id: id, attacker_address: seed.planted.attacker_address } };
  }
  day = DayV1.parse(day);
  fs.mkdirSync(path.join(DIGEST, "days"), { recursive: true });
  fs.writeFileSync(dayPath(c.case_id), JSON.stringify(day, null, 1) + "\n");
  fs.writeFileSync(path.join(DIGEST, "days", `${c.case_id}.md`), daySheet(c, day));
  console.log(`${c.case_id}: ${day.calendar.length} events, ${day.inbox.length} emails${day.planted ? " (planted attack added)" : ""}, ${receipt.route.model}, $${(receipt.costMicroUsd / 1e6).toFixed(3)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const cases = loadCases();
  const chosen = args.includes("--all") ? cases.filter((c) => !fs.existsSync(dayPath(c.case_id))) : cases.filter((c) => args.includes(c.case_id));
  if (!chosen.length) {
    console.error("Name the cases to build, for example pnpm eval:fixtures D01 D07, or use --all.");
    process.exit(1);
  }
  for (const c of chosen) await build(c);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
