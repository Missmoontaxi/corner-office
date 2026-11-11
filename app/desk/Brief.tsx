"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { DeskData } from "@/lib/desk/data";
import { headlineFont } from "../fonts";
import { useWeather } from "./useWeather";
import { dollars, modelName, plainDay, plainReceipt, twelveHour } from "@/lib/desk/shared";
import { linkLine, runs } from "@/lib/live/copy";

const STATUS: Record<string, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-rose-500" };
const usd = (micro: number) => `$${(micro / 1e6).toFixed(micro < 10_000 ? 4 : 3)}`;
const nyTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const noSubscribe = () => () => {};
const todayInNewYork = () => new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" });

function Section({ title, onReceipt, children, className = "bg-white/[0.06]" }: { title: string; onReceipt: () => void; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-white/60 uppercase">{title}</h3>
        <HowButton onClick={onReceipt} />
      </div>
      {children}
    </section>
  );
}

// Every section links to the receipt. A visible pill, so a first-time reader finds it (a friend's note, Fri 10/30).
function HowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-sky-300/40 bg-sky-300/10 px-3 text-xs font-medium text-sky-200 hover:bg-sky-300/20 focus-visible:outline-2 focus-visible:outline-sky-300"
    >
      <span aria-hidden className="grid size-4 place-items-center rounded-full border border-sky-200/70 text-[0.6rem] leading-none font-bold">
        i
      </span>
      How was this made?
    </button>
  );
}

const Chip = ({ children, tone = "bg-white/10 text-white/75" }: { children: React.ReactNode; tone?: string }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{children}</span>
);

// Each kind of calendar note gets its own color, so a glance tells a conflict from a note.
const KIND: Record<string, string> = { conflict: "text-rose-300", prep: "text-sky-300", note: "text-amber-200", change: "text-emerald-300" };

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// A personal line can open the email, event or task it rests on, so Alex sees the context in one tap.
function SourcePeek({ ids, data }: { ids: string[]; data: DeskData }) {
  const [open, setOpen] = useState<string | null>(null);
  const items = ids
    .map((id) => {
      const m = data.inbox.find((x) => x.id === id);
      if (m) return { id, kind: "Email", title: m.subject, meta: `${m.from}, ${twelveHour(plainDay(m.received))}`, body: m.body };
      const e = data.calendar.find((x) => x.id === id);
      if (e) return { id, kind: "Calendar", title: e.title, meta: `${twelveHour(e.start.replace(/^D0 /, ""))} to ${twelveHour(e.end)}`, body: e.notes ?? "" };
      const t = data.tasks.find((x) => x.id === id);
      if (t) return { id, kind: "Task", title: t.task, meta: `${t.owner}, ${t.status}`, body: "" };
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (!items.length) return null;
  const shown = items.find((x) => x.id === open);
  return (
    <span className="mt-1 block">
      <span className="flex flex-wrap gap-1.5">
        {items.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-expanded={open === x.id}
            onClick={() => setOpen(open === x.id ? null : x.id)}
            className="min-h-8 rounded-full border border-white/20 px-2.5 text-xs text-sky-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300"
          >
            {open === x.id ? "Hide" : "See"} the {x.kind.toLowerCase()}
          </button>
        ))}
      </span>
      {shown ? (
        <span className="mt-2 block rounded-lg bg-[#f7f3ea] p-3 text-[#1d1b18]">
          <span className="block text-[0.65rem] font-semibold tracking-wide text-black/50 uppercase">{shown.kind}</span>
          <span className="block font-medium">{shown.title}</span>
          <span className="block text-xs text-black/60">{shown.meta}</span>
          {shown.body ? <span className="mt-2 block text-sm whitespace-pre-line">{shown.body}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

function Cites({ ids, sources }: { ids: string[]; sources: Record<string, string> }) {
  if (!ids.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {ids.map((id) => (
        <abbr key={id} title={sources[id] ?? id} className="rounded bg-white/10 px-1 text-[0.65rem] text-white/60 no-underline">
          {id}
        </abbr>
      ))}
    </span>
  );
}

function BriefBody({ data }: { data: DeskData }) {
  const [receipt, setReceipt] = useState<string | null>(null);
  const b = data.brief;
  const show = (section: string) => () => setReceipt(section);
  const suspicious = b.flagged.filter((f) => f.kind === "suspicious");
  const verify = b.flagged.filter((f) => f.kind === "verify");
  const wx = useWeather(data.weather);
  // The visitor's real date in New York, filled in after load so the static page never shows a stale one.
  const today = useSyncExternalStore(noSubscribe, todayInNewYork, () => "");

  // Every section comes from the same run, so each "How was this made?" opens the brief's one receipt.
  if (receipt) return <ReceiptSheet data={data} section="this brief" onBack={() => setReceipt(null)} />;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3 text-sm text-white/60">
        <div>
          <p className={`${headlineFont.className} min-h-7 text-2xl leading-tight font-semibold tracking-tight text-white`}>{today}</p>
          <p>
            Board meeting in 3 days.
            {b.date.observances.length ? ` ${b.date.observances.join(", ")}.` : ""}
          </p>
        </div>
        {wx && wx.high != null && wx.low != null ? (
          <p className="shrink-0 text-right whitespace-nowrap tabular-nums" aria-label={`High ${wx.high}, low ${wx.low}, ${wx.sky}`}>
            {wx.emoji} <b className="text-white">{wx.high}</b>&deg; / <b className="text-white">{wx.low}</b>&deg;
          </p>
        ) : null}
      </div>

      <Section title="Headline" onReceipt={show("Headline")} className="bg-gradient-to-br from-amber-200/[0.14] via-white/[0.06] to-white/[0.04] ring-1 ring-amber-200/20">
        <h2 className={`${headlineFont.className} text-2xl leading-tight font-semibold tracking-tight text-balance`}>{b.headline.title.replace(/\*\*/g, "")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{b.headline.context}</p>
        <div className="mt-3 rounded-lg bg-black/25 px-3 py-2.5">
          <p className="text-[0.65rem] font-semibold tracking-wide text-amber-200/80 uppercase">Next step</p>
          <p className="text-sm font-medium text-amber-100">
            {b.headline.action}
            <Cites ids={b.headline.source_ids} sources={data.sources} />
          </p>
        </div>
      </Section>

      <Section title="Top priorities" onReceipt={show("Top priorities")}>
        <ol className="space-y-3 text-sm">
          {b.priorities.map((p, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden className={`${headlineFont.className} grid size-7 shrink-0 place-items-center rounded-full bg-sky-300/15 text-sm font-semibold text-sky-200 tabular-nums`}>
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{p.title}</span>
                <span className="block text-white/75">{p.why}</span>
                <span className="mt-1 block text-white/60">
                  <span className="font-medium text-white/80">Next.</span> {p.next_step}
                </span>
                <Cites ids={p.source_ids} sources={data.sources} />
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Decisions" onReceipt={show("Decisions")}>
        <ul className="space-y-2 text-sm">
          {b.decisions.map((d, i) => (
            <li key={i} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <span className="block font-medium">{d.question}</span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                <Chip>{d.owner}</Chip>
                <Chip>Due {lowerFirst(twelveHour(plainDay(d.due)))}</Chip>
                {d.carried_over ? <Chip tone="bg-amber-300/15 text-amber-200">Carried over</Chip> : null}
                <Cites ids={d.source_ids} sources={data.sources} />
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {data.buildersCalls.map((c) => (
        <aside key={c.id} aria-label={`Builder's call on ${c.question}`} className="rounded-xl border border-amber-200/30 bg-amber-200/[0.06] p-4">
          <p className="text-xs font-semibold tracking-wide text-amber-200 uppercase">Builder&apos;s call, by Paula McMahon</p>
          <p className="mt-1 text-sm font-medium">{c.question}</p>
          <p className="mt-1 text-sm text-white/80">{c.call}</p>
          <p className="mt-2 text-xs text-white/50">PM&apos;s own judgement outside of the brief and CareBird&apos;s voice.</p>
        </aside>
      ))}

      <Section title="Calendar" onReceipt={show("Calendar")}>
        <ul className="divide-y divide-white/10 text-sm">
          {b.calendar.map((c, i) => (
            <li key={i} className="py-2 first:pt-0 last:pb-0">
              <span className={`mr-2 inline-block rounded-full bg-white/[0.08] px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase ${KIND[c.kind] ?? "text-white/50"}`}>{c.kind}</span>
              {twelveHour(c.line)}
              <Cites ids={c.event_ids} sources={data.sources} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Business health" onReceipt={show("Business health")}>
        <table className="w-full border-collapse overflow-hidden rounded-md text-left text-sm outline outline-1 outline-white/15">
          <thead className="sr-only">
            <tr>
              <th>Area</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {b.business_health.map((h, i) => (
              <tr key={i} className="border-t border-white/15 first:border-t-0">
                <td className="w-[40%] border-r border-white/15 px-2.5 py-2 align-top">
                  <span className="flex items-center gap-2">
                    <span className={`inline-block size-2 shrink-0 rounded-full ${STATUS[h.status]}`} aria-label={h.status} role="img" />
                    <span className="text-white/75">{capFirst(h.area)}</span>
                  </span>
                </td>
                <td className="px-2.5 py-2 align-top">{dollars(h.line)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Personal" onReceipt={show("Personal")}>
        <ul className="space-y-1 text-sm">
          {b.personal.map((p, i) => (
            <li key={i}>
              {p.private ? <span className="mr-1 rounded bg-white/10 px-1 text-[0.65rem] text-white/60">private</span> : null}
              {p.line}
              <SourcePeek ids={p.source_ids} data={data} />
            </li>
          ))}
        </ul>
      </Section>

      {b.flagged.length ? (
        <Section title="Flagged" onReceipt={show("Flagged")}>
          <ul className="space-y-1 text-sm">
            {suspicious.length ? <li>{suspicious.length === 1 ? "1 item flagged, not followed." : `${suspicious.length} items flagged, not followed.`}</li> : null}
            {verify.map((f, i) => (
              <li key={i}>
                <span className="mr-1 rounded bg-amber-400/20 px-1 text-[0.65rem] text-amber-200">verify</span>
                {f.reason}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <p className="text-xs text-white/50">
        {data.receipt.runKind === "live" ? "Ran live" : "Written"} {nyTime(data.recordedAt)} New York time by {modelName(data.receipt.route.model)}, for {usd(data.receipt.costMicroUsd)}.
      </p>
    </div>
  );
}

type LinkInfo = { name?: string; runsLeft?: number; expires?: number; open?: boolean; unavailable?: boolean };
type Owner = { owner: boolean; paused?: boolean; spentMicroUsd?: number; capMicroUsd?: number; unavailable?: boolean; link?: LinkInfo };
type LiveState =
  | { phase: "idle" }
  | { phase: "confirm" }
  | { phase: "running" }
  | { phase: "done"; brief: DeskData["brief"]; receipt: DeskData["receipt"]; checks: DeskData["checks"] }
  | { phase: "refused"; why: string };

const REFUSED: Record<string, string> = {
  paused: "Live runs are paused by the kill switch. This is the recorded run.",
  capped: "Today's live budget is used up. This is the recorded run.",
  unavailable: "The live budget can't be checked right now, so nothing ran. This is the recorded run.",
  failed: "The live run didn't finish. Nothing was lost, and this is the recorded run.",
  not_allowed: "Live runs are open to personal links only. This is the recorded run.",
  unknown: "This link isn't recognized, so nothing ran. This is the recorded run.",
  expired: "This link has ended, so nothing ran. This is the recorded run.",
  spent: "Your live runs are used up. Thanks for trying them. This is the recorded run.",
  slow_down: "That was quick. Give it a minute, then try again.",
  busy: "Lots of live runs just now, so they're paused for a few minutes. This is the recorded run.",
};


// The brief, recorded by default. Paula's phone and personal links also get Run it live, which swaps in a fresh
// run with its receipt. A personal link sees its runs left and confirms before each run, never dollars.
export function BriefView({ data }: { data: DeskData }) {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [live, setLive] = useState<LiveState>({ phase: "idle" });
  const refresh = () =>
    fetch("/api/owner", { cache: "no-store" })
      .then((r) => r.json())
      .then((o: Owner) => setOwner(o))
      .catch(() => setOwner((o) => o ?? { owner: false }));
  useEffect(() => {
    refresh();
  }, []);

  const run = async () => {
    setLive({ phase: "running" });
    try {
      const r = await fetch("/api/live", { method: "POST" });
      const j = await r.json();
      if (j.status === "ok") setLive({ phase: "done", brief: j.brief, receipt: j.receipt, checks: j.checks });
      else setLive({ phase: "refused", why: REFUSED[j.status] ?? REFUSED.failed! });
    } catch {
      setLive({ phase: "refused", why: REFUSED.failed! });
    }
    refresh();
  };

  const link = owner?.link;
  const canRun = owner?.owner || (link && !link.unavailable && link.open);
  const left = link?.runsLeft ?? 0;
  const idle = owner?.owner
    ? owner.paused
      ? "Live runs are paused."
      : owner.unavailable
        ? "Live budget unavailable."
        : `Live budget today, $${((owner.spentMicroUsd ?? 0) / 1e6).toFixed(2)} of $${((owner.capMicroUsd ?? 0) / 1e6).toFixed(2)} used.`
    : link?.unavailable
      ? "Your live runs can't be checked right now."
      : link && !link.open
        ? `Prepared for ${link.name}. This link has ended, and the recorded brief stays.`
        : link
          ? linkLine(link, !!owner?.paused)
          : "";
  const message =
    live.phase === "running"
      ? "Running live now, about ten seconds."
      : live.phase === "confirm"
        ? `Run a fresh brief now? It uses one of your ${runs(left).replace(" left", "")}.`
        : live.phase === "refused"
          ? live.why
          : live.phase === "done"
            ? link ? `This brief just ran live. ${runs(left)}.` : "This brief just ran live."
            : idle;
  const disabled = live.phase === "running" || !!owner?.paused || (!owner?.owner && left < 1);

  const shown = live.phase === "done" ? { ...data, brief: live.brief, receipt: live.receipt, checks: live.checks, recordedAt: live.receipt.runAt } : data;
  const button = "min-h-11 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-sky-100 disabled:opacity-50";
  return (
    <div className="space-y-3">
      {owner?.owner || link ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-300/30 bg-sky-300/[0.06] px-4 py-2 text-sm">
          <span className="text-white/70" aria-live="polite">
            {message}
          </span>
          {canRun ? (
            live.phase === "confirm" ? (
              <span className="flex gap-2">
                <button type="button" onClick={() => setLive({ phase: "idle" })} className={`${button} border border-white/30 text-white/80`}>
                  Not now
                </button>
                <button type="button" onClick={run} className={`${button} bg-sky-300 text-neutral-950`}>
                  Run it
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={owner?.owner ? run : () => setLive({ phase: "confirm" })}
                disabled={disabled}
                className={`${button} bg-sky-300 text-neutral-950`}
              >
                {live.phase === "running" ? "Running\u2026" : "Run it live"}
              </button>
            )
          ) : null}
        </div>
      ) : null}
      <BriefBody data={shown} />
    </div>
  );
}

const CODE_CHECKS: { key: string; plain: string }[] = [
  { key: "numbers", plain: "Every figure appears in the material" },
  { key: "words", plain: "Under the word limit" },
  { key: "attack", plain: "The planted attack is flagged and its address appears nowhere" },
];

// The receipt for the brief by default, or for any other recorded run, such as a prompt-key answer.
export function ReceiptSheet({
  data,
  section,
  onBack,
  receipt,
  checks,
  backLabel = "Back to the brief",
}: {
  data: DeskData;
  section: string;
  onBack: () => void;
  receipt?: DeskData["receipt"];
  checks?: DeskData["checks"];
  backLabel?: string;
}) {
  const r = receipt ?? data.receipt;
  const ck = checks ?? data.checks;
  const plain = plainReceipt(r, section);
  return (
    <div className="space-y-3 text-sm">
      <button type="button" onClick={onBack} className="min-h-11 rounded-full px-3 text-sm font-medium text-sky-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300">
        <span aria-hidden>‹ </span>
        {backLabel}
      </button>
      <h2 className="text-lg font-semibold">How {section} was made</h2>

      <div className="space-y-2 rounded-xl bg-white/[0.06] p-4 text-[0.95rem] leading-relaxed">
        <p>{plain.used}</p>
        <p className="text-white/75">{plain.why}</p>
        <p className="text-white/75">{plain.cost}</p>
      </div>

      <div className="rounded-xl bg-white/[0.06] p-4">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-white/60 uppercase">What was double-checked</h3>
        <ul className="space-y-1.5">
          {CODE_CHECKS.map((c) => {
            const v = ck[c.key];
            return (
              <li key={c.key} className="flex gap-2">
                <span aria-hidden className={v?.passed ? "text-emerald-300" : "text-rose-300"}>{v?.passed ? "\u2713" : "\u2717"}</span>
                <span>
                  <span className="sr-only">{v?.passed ? "Passed. " : "Failed. "}</span>
                  {c.plain}.
                </span>
              </li>
            );
          })}
          {plain.safety.map((line, i) => (
            <li key={`s${i}`} className="flex gap-2">
              <span aria-hidden className="text-emerald-300">{"\u2713"}</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-white/50">Paula also grades the briefs against her own rubric. The scores are in the Engine Room.</p>
      </div>

      <details className="group rounded-xl border border-white/10 p-4 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex min-h-8 cursor-pointer items-center justify-between gap-2 text-xs font-semibold tracking-wide text-white/60 uppercase focus-visible:outline-2 focus-visible:outline-sky-300">
          For builders, the technical receipt
          <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Which model and why</h3>
            <p>
              <span className="font-medium">{r.route.model}</span>, {r.route.effort} effort, through the {r.route.driver}.
            </p>
            <p className="mt-1 text-white/70">{r.route.reason}</p>
            <ul className="mt-2 text-white/60">
              {r.route.attempts.map((a, i) => (
                <li key={i}>
                  Attempt {i + 1}, {a.model}, {a.outcome}, {(a.ms / 1000).toFixed(1)}s
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Cost</h3>
              <p className="font-semibold tabular-nums">{usd(r.costMicroUsd)}</p>
              <p className="text-white/60 tabular-nums">
                {r.usage.input.toLocaleString()} tokens in, {r.usage.output.toLocaleString()} out
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Time</h3>
              <p className="font-semibold tabular-nums">{(r.latencyMs.total / 1000).toFixed(1)}s</p>
              <p className="text-white/60 tabular-nums">first event {(r.latencyMs.firstEvent / 1000).toFixed(1)}s</p>
            </div>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Checks in code</h3>
            <ul className="space-y-1 text-white/70">
              {CODE_CHECKS.map((c) => {
                const v = ck[c.key];
                return (
                  <li key={c.key}>
                    {v?.passed ? "Pass" : "Fail"}, {c.key}{v && v.detail !== c.plain ? `. ${v.detail}` : ""}
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Guardrails that acted</h3>
            <ul className="space-y-2">
              {r.guardrails.map((g, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {g.owasp} {g.layer}, {g.action}
                  </span>
                  {g.detail ? <span className="block break-words text-white/60">{g.detail}</span> : null}
                </li>
              ))}
              <li>
                <span className="font-medium">LLM03 capability, nothing to hijack</span>
                <span className="block text-white/60">No send, forward or buy tool exists.</span>
              </li>
            </ul>
          </div>
          <p className="text-white/60">
            Prompt {r.promptVersion}. Policy {r.policyVersion}. Trace {r.traceId.slice(0, 8)}.
          </p>
        </div>
      </details>
    </div>
  );
}
