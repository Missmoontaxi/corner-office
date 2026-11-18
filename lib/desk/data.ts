// Everything the desk renders. No model runs on a page load. The brief, receipt and prompt-key answers come from
// the morning's promoted snapshot when there is one, and from the committed recordings otherwise. The documents
// are seeded and rendered by code.
import fs from "node:fs";
import path from "node:path";
import { AskV1, BriefV1, Receipt } from "@/lib/engine/contracts";
import { loadVerdicts, untrustedItems, verdictKey } from "@/lib/engine/guard/screen";
import { policy } from "@/lib/engine/policy";
import type { Snapshot } from "@/lib/engine/snapshot";
import { loadShowDay } from "@/lib/engine/sources/seed";

const ROOT = process.cwd();
// Every desk page reads these files once, at build time, so the bundler need not trace the path.
const readJson = <T,>(...p: string[]): T => JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ ROOT, ...p), "utf8")) as T;

import { parseWeather, type Call, type Check, type Provider, type Scorecard } from "./shared";

// What each alias does on the desk, in plain words, for the model cards. The registry decides who does it.
const JOBS: Record<string, { primary: string; fallback: string }> = {
  "text.brief": { primary: "Writes the morning brief", fallback: "Backup for the morning brief" },
  "text.mid": { primary: "Answers the prompt keys and writes Balanced live briefs", fallback: "Backup for the prompt keys and Balanced live briefs" },
  "text.small": { primary: "Screens untrusted mail and writes Fast live briefs", fallback: "Backup for the screen and Fast live briefs" },
  "text.frontier": { primary: "Writes Deep live briefs, on Paula's phone only", fallback: "Backup for Deep live briefs" },
};

// One card per model in the registry, the brief's pair first. Scores come from the committed scorecard, and a
// model it does not cover says so rather than showing a projection as a result.
function modelCards(scorecard: Scorecard | null, briefs: { model: string; costMicroUsd: number; runAt: string }[]) {
  const { models, routing } = policy();
  const brief = models.aliases["text.brief"];
  const judge = routing.tasks["judge.ci"]?.judge_for ?? {};
  const order = (id: string) => (id === brief?.primary ? 0 : id === brief?.fallback ? 1 : 2);
  return Object.entries(models.models)
    .sort(([a], [b]) => order(a) - order(b))
    .map(([id, m]) => {
      // Jobs it leads come before jobs it backs up, in the order JOBS lists them.
      const aliases = Object.keys(JOBS).map((k) => [k, models.aliases[k]] as const);
      const jobs = [
        ...aliases.filter(([, a]) => a?.primary === id).map(([k]) => JOBS[k]!.primary),
        ...aliases.filter(([, a]) => a?.fallback === id).map(([k]) => JOBS[k]!.fallback),
      ];
      // The CI judge for each vendor's briefs, so the card can say whose briefs this model grades.
      for (const [vendor, j] of Object.entries(judge)) if (j === id) jobs.push(`Judges ${vendor === "openai" ? "OpenAI" : "Anthropic"} briefs in evals`);
      const today = briefs.find((b) => b.model === id);
      return { id, vendor: m.vendor, priceIn: m.in, priceOut: m.out, jobs, briefToday: today ?? null, score: scorecard?.models.find((s) => s.model === id) ?? null };
    });
}

export function loadDesk(snapshot: Snapshot | null = null) {
  const day = loadShowDay();
  const recorded = snapshot
    ? { recordedAt: snapshot.runAt, ...snapshot.brief }
    : readJson<{ recordedAt: string; checks: Record<string, Check>; brief: unknown; receipt: unknown }>("recordings", "brief-show-day.json");
  const replayFile = fs.readdirSync(path.join(ROOT, "recordings")).filter((f) => f.startsWith("screen-off.")).sort().at(-1);
  const replay = replayFile ? readJson<{ recordedAt: string; modelFlaggedIt: boolean; filterStripped: number; addressReachedPage: boolean; receipt: unknown }>("recordings", replayFile) : null;
  // The six prompt keys, precomputed with pnpm asks. Absent until the first recording exists.
  const asksFile = path.join(ROOT, "recordings", "asks-show-day.json");
  const asks = snapshot
    ? snapshot.asks
    : fs.existsSync(asksFile)
    ? readJson<{ answers: { key: number; question: string; answer: unknown; checks: Record<string, Check>; receipt: unknown }[] }>("recordings", "asks-show-day.json").answers.map((a) => ({
        key: a.key,
        question: a.question,
        answer: AskV1.parse(a.answer),
        checks: a.checks,
        receipt: Receipt.parse(a.receipt),
      }))
    : [];
  // Compare's second brief, from the snapshot when the morning run produced one, else the committed recording.
  const compareFile = path.join(ROOT, "recordings", "brief-compare-show-day.json");
  const compareSides = snapshot?.compare?.length
    ? snapshot.compare
    : fs.existsSync(compareFile)
    ? [readJson<{ brief: unknown; receipt: unknown; checks: Record<string, Check> }>("recordings", "brief-compare-show-day.json")]
    : [];
  // Every brief written for the same day, the production one first. Compare shows them side by side.
  const compare = [
    { brief: BriefV1.parse(recorded.brief), receipt: Receipt.parse(recorded.receipt), checks: recorded.checks },
    ...compareSides.map((c) => ({ brief: BriefV1.parse(c.brief), receipt: Receipt.parse(c.receipt), checks: c.checks })),
  ];
  const scorecardFile = path.join(ROOT, "recordings", "scorecard.json");
  const scorecard = fs.existsSync(scorecardFile) ? readJson<Scorecard>("recordings", "scorecard.json") : null;

  const verdicts = loadVerdicts();
  const items = untrustedItems(day);
  const screened = items.filter((i) => verdicts[verdictKey(i)]);
  const quarantined = screened.filter((i) => verdicts[verdictKey(i)]!.suspicious);


  // Paula's Builder's calls, from the seed's Decisions tab. A cell that still reads "Due ..." has no call yet.
  // The brief model never sees these, so the call sits beside the brief instead of steering it.
  const buildersCalls = readJson<{ rows: { id: string; question: string; builders_call: string | null }[] }>("persona", "executive-life", "show-day", "decisions.json")
    .rows.filter((d) => d.builders_call && !/^due\b/i.test(d.builders_call))
    .map((d) => ({ id: d.id, question: d.question, call: d.builders_call! }));

  const household = (f: string) => readJson<Record<string, unknown>>("persona", "executive-life", "household", f);
  const providers = (household("providers.json").rows as Provider[]) ?? [];
  const calls = (household("calls.json").calls as Call[]) ?? [];

  return {
    persona: day.persona,
    dateLabel: day.date_label,
    brief: BriefV1.parse(recorded.brief),
    receipt: Receipt.parse(recorded.receipt),
    checks: recorded.checks,
    recordedAt: recorded.recordedAt,
    screen: { items: items.length, screened: screened.length, quarantined: quarantined.length, model: quarantined[0] ? verdicts[verdictKey(quarantined[0])]!.model : null },
    replay: replay && { recordedAt: replay.recordedAt, modelFlaggedIt: replay.modelFlaggedIt, filterStripped: replay.filterStripped, addressReachedPage: replay.addressReachedPage, model: Receipt.parse(replay.receipt).route.model },
    scorecard,
    compare,
    models: modelCards(scorecard, compare.map((c) => ({ model: c.receipt.route.model, costMicroUsd: c.receipt.costMicroUsd, runAt: c.receipt.runAt }))),
    asks,
    buildersCalls,
    // What this morning's precomputed AI cost, at list price: the brief plus every prompt-key answer.
    morningCostMicroUsd: Receipt.parse(recorded.receipt).costMicroUsd + asks.reduce((t, a) => t + a.receipt.costMicroUsd, 0),
    // Emails a brief line can open as context. A quarantined item never reaches the page.
    inbox: day.inbox.filter((m) => !quarantined.some((q) => q.kind === "email" && q.id === m.id)).map(({ id, from, subject, received, body }) => ({ id, from, subject, received, body })),
    calendar: day.calendar,
    kpis: day.kpis,
    tasks: day.tasks,
    providers,
    calls,
    // A short name for every id a brief line can cite, so receipts show what each line rests on.
    sources: Object.fromEntries([
      ...day.inbox.map((m) => [m.id, `Email from ${m.from}, "${m.subject}"`]),
      ...day.newsletters.map((n) => [n.id, `${n.publication}, "${n.title}"`]),
      ...day.calendar.map((e) => [e.id, `Calendar, ${e.title}`]),
      ...day.kpis.map((k) => [k.id, `KPI, ${k.metric}`]),
      ...day.decisions.map((d) => [d.id, `Open decision, ${d.question}`]),
      ...day.tasks.map((t) => [t.id, `Task, ${t.task}`]),
    ]) as Record<string, string>,
    // Paula's wording, Thu 10/22.
    honesty: "A day in the life as CEO at CareBird, a fictional company seeded with data and routed through live models.",
    weather: parseWeather(day.context?.weather),
  };
}

export type DeskData = ReturnType<typeof loadDesk>;
