// Everything the desk renders, read at build time from committed recordings and the seed. No model runs on a
// page load. The brief and receipt are the recorded guarded run, the documents are seeded and rendered by code.
import fs from "node:fs";
import path from "node:path";
import { AskV1, BriefV1, Receipt } from "@/lib/engine/contracts";
import { loadVerdicts, untrustedItems, verdictKey } from "@/lib/engine/guard/screen";
import { policy } from "@/lib/engine/policy";
import { loadShowDay } from "@/lib/engine/sources/seed";

const ROOT = process.cwd();
const readJson = <T,>(...p: string[]): T => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), "utf8")) as T;

import { NUMBER_WORDS, type Call, type Check, type Provider, type Scorecard } from "./shared";

export function loadDesk() {
  const day = loadShowDay();
  const recorded = readJson<{ recordedAt: string; checks: Record<string, Check>; brief: unknown; receipt: unknown }>("recordings", "brief-show-day.json");
  const replayFile = fs.readdirSync(path.join(ROOT, "recordings")).filter((f) => f.startsWith("screen-off.")).sort().at(-1);
  const replay = replayFile ? readJson<{ recordedAt: string; modelFlaggedIt: boolean; filterStripped: number; addressReachedPage: boolean; receipt: unknown }>("recordings", replayFile) : null;
  // The six prompt keys, precomputed with pnpm asks. Absent until the first recording exists.
  const asksFile = path.join(ROOT, "recordings", "asks-show-day.json");
  const asks = fs.existsSync(asksFile)
    ? readJson<{ answers: { key: number; question: string; answer: unknown; checks: Record<string, Check>; receipt: unknown }[] }>("recordings", "asks-show-day.json").answers.map((a) => ({
        key: a.key,
        question: a.question,
        answer: AskV1.parse(a.answer),
        checks: a.checks,
        receipt: Receipt.parse(a.receipt),
      }))
    : [];
  const scorecardFile = path.join(ROOT, "recordings", "scorecard.json");
  const scorecard = fs.existsSync(scorecardFile) ? readJson<Scorecard>("recordings", "scorecard.json") : null;

  const verdicts = loadVerdicts();
  const items = untrustedItems(day);
  const screened = items.filter((i) => verdicts[verdictKey(i)]);
  const quarantined = screened.filter((i) => verdicts[verdictKey(i)]!.suspicious);

  // The honesty line's provider count comes from the makers of the text models we route to.
  const vendors = new Set(Object.entries(policy().models.models).filter(([id]) => !policy().models.blocked.includes(id)).map(([, m]) => m.vendor));

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
    asks,
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
    honesty: `Fictional executive, seeded data, live models from ${NUMBER_WORDS[vendors.size] ?? vendors.size} providers. Built by Paula McMahon.`,
  };
}

export type DeskData = ReturnType<typeof loadDesk>;
