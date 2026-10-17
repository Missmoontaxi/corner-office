// The seed is the first data source: CareBird's show day, read from persona/executive-life and
// mapped into the DayV1 shape that eval day files also use. Everything here is fictional.
import fs from "node:fs";
import path from "node:path";
import { DayV1 } from "../contracts";

const ROOT = path.join(process.cwd(), "persona", "executive-life");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
type Row = Record<string, unknown>;
const rows = (f: string): Row[] => read(f).rows;
const s = (v: unknown) => (v == null ? "" : String(v));

export function loadShowDay(): DayV1 {
  const brand = Object.fromEntries(rows("brand.json").map((r) => [s(r.setting), s(r.value)]));
  const ceo = rows("cast.json").find((r) => s(r.role).includes("CEO"))!;
  const bodies: Record<string, { body: string; planted?: boolean }> = read("inbox/bodies.json").bodies;
  const items: Record<string, string> = read("newsletters/items.json").items;
  const inbox = rows("inbox/index.json");
  const planted = inbox.find((m) => m.flag === "planted");
  const attacker = planted ? bodies[s(planted.id)]?.body.match(/[\w.+-]+@[\w.-]+\.example/g)?.find((a) => a !== s(ceo.email)) : undefined;

  return DayV1.parse({
    day_id: "show-day",
    date_label: `D0, ${brand["Show day (D0)"] ?? "the show day"}`,
    persona: { name: s(ceo.name), role: s(ceo.role), company: brand["Company name"] ?? "CareBird" },
    calendar: rows("show-day/calendar.json").map((r) => ({
      id: s(r.id),
      start: `${s(r.day)} ${s(r.start)}`,
      end: s(r.end),
      title: s(r.title),
      attendees: s(r.attendees),
      notes: s(r.notes),
    })),
    inbox: inbox.map((m) => ({
      id: s(m.id),
      from: s(m.from),
      address: s(m.address),
      subject: s(m.subject),
      received: s(m.received),
      body: bodies[s(m.id)]?.body ?? "",
    })),
    newsletters: rows("newsletters/index.json")
      .filter((n) => items[s(n.id)])
      .map((n) => ({ id: s(n.id), publication: s(n.publication), title: s(n.item), body: items[s(n.id)]! })),
    kpis: rows("kpis.json").map((k) => ({ id: s(k.id), metric: `${s(k.area)}: ${s(k.metric)}`, value: (k.value as number | string) ?? "", unit: s(k.unit) })),
    decisions: rows("show-day/decisions.json").map((d) => ({
      id: s(d.id),
      question: s(d.question),
      detail: [d.choice && `Choice: ${s(d.choice)}`, d.alternative && `Alternative: ${s(d.alternative)}`, d.tradeoff && `Tradeoff: ${s(d.tradeoff)}`].filter(Boolean).join(". "),
    })),
    tasks: rows("household/tasks.json").map((t) => ({ id: s(t.id), task: s(t.task), owner: s(t.owner), due: s(t.due), status: s(t.status) })),
    planted: planted && attacker ? { source_id: s(planted.id), attacker_address: attacker } : undefined,
  });
}
