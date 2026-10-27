"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { DeskData } from "@/lib/desk/data";

const STATUS: Record<string, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-rose-500" };
const usd = (micro: number) => `$${(micro / 1e6).toFixed(micro < 10_000 ? 4 : 3)}`;
const nyTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const noSubscribe = () => () => {};
const todayInNewYork = () => new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" });

function Section({ title, onReceipt, children }: { title: string; onReceipt: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white/[0.06] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-white/60 uppercase">{title}</h3>
        <button type="button" onClick={onReceipt} className="min-h-11 rounded-full px-3 text-xs font-medium text-sky-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300">
          How
        </button>
      </div>
      {children}
    </section>
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
  const wx = data.weather;
  // The visitor's real date in New York, filled in after load so the static page never shows a stale one.
  const today = useSyncExternalStore(noSubscribe, todayInNewYork, () => "");

  if (receipt) return <ReceiptSheet data={data} section={`the ${receipt.toLowerCase()}`} onBack={() => setReceipt(null)} />;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 text-sm text-white/60">
        <p>
          {today ? `${today}. ` : ""}Board meeting in 3 days.
          {b.date.observances.length ? ` ${b.date.observances.join(", ")}.` : ""}
        </p>
        {wx && wx.high != null && wx.low != null ? (
          <p className="shrink-0 text-right whitespace-nowrap tabular-nums" aria-label={`High ${wx.high}, low ${wx.low}, ${wx.sky}`}>
            {wx.emoji} <b className="text-white">{wx.high}</b>&deg; / <b className="text-white">{wx.low}</b>&deg;
          </p>
        ) : null}
      </div>

      <Section title="Headline" onReceipt={show("Headline")}>
        <h2 className="text-lg leading-snug font-semibold">{b.headline.title.replace(/\*\*/g, "")}</h2>
        <p className="mt-1 text-sm text-white/80">{b.headline.context}</p>
        <p className="mt-2 text-sm font-medium text-amber-200">
          {b.headline.action}
          <Cites ids={b.headline.source_ids} sources={data.sources} />
        </p>
      </Section>

      <Section title="Top priorities" onReceipt={show("Top priorities")}>
        <ol className="space-y-2 text-sm">
          {b.priorities.map((p, i) => (
            <li key={i}>
              <span className="font-medium">{p.title}</span>
              <span className="text-white/75"> {p.why}</span>
              <span className="block text-white/60">Next: {p.next_step}</span>
              <Cites ids={p.source_ids} sources={data.sources} />
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Decisions" onReceipt={show("Decisions")}>
        <ul className="space-y-2 text-sm">
          {b.decisions.map((d, i) => (
            <li key={i}>
              <span className="font-medium">{d.question}</span>
              <span className="block text-white/60">
                {d.owner}, {d.due}
                {d.carried_over ? " · carried over" : ""}
              </span>
              <Cites ids={d.source_ids} sources={data.sources} />
            </li>
          ))}
        </ul>
      </Section>

      {data.buildersCalls.map((c) => (
        <aside key={c.id} aria-label={`Builder's call on ${c.question}`} className="rounded-xl border border-amber-200/30 bg-amber-200/[0.06] p-4">
          <p className="text-xs font-semibold tracking-wide text-amber-200 uppercase">Builder&apos;s call, by Paula McMahon</p>
          <p className="mt-1 text-sm font-medium">{c.question}</p>
          <p className="mt-1 text-sm text-white/80">{c.call}</p>
          <p className="mt-2 text-xs text-white/50">Paula&apos;s own judgment, outside CareBird&apos;s voice. No model wrote it, and the brief never saw it.</p>
        </aside>
      ))}

      <Section title="Calendar" onReceipt={show("Calendar")}>
        <ul className="space-y-1 text-sm">
          {b.calendar.map((c, i) => (
            <li key={i}>
              <span className="mr-1 text-xs text-white/50 uppercase">{c.kind}</span>
              {c.line}
              <Cites ids={c.event_ids} sources={data.sources} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Business health" onReceipt={show("Business health")}>
        <ul className="space-y-1 text-sm">
          {b.business_health.map((h, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span className={`inline-block size-2 shrink-0 rounded-full ${STATUS[h.status]}`} aria-label={h.status} role="img" />
              <span className="text-white/60 capitalize">{h.area}</span>
              <span>{h.line}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Personal" onReceipt={show("Personal")}>
        <ul className="space-y-1 text-sm">
          {b.personal.map((p, i) => (
            <li key={i}>
              {p.private ? <span className="mr-1 rounded bg-white/10 px-1 text-[0.65rem] text-white/60">private</span> : null}
              {p.line}
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
        {data.receipt.runKind === "live" ? "Ran live" : "Recorded"} {nyTime(data.recordedAt)} New York time by {data.receipt.route.model}, {usd(data.receipt.costMicroUsd)}.
      </p>
    </div>
  );
}

type Owner = { owner: boolean; paused?: boolean; spentMicroUsd?: number; capMicroUsd?: number; unavailable?: boolean };
type LiveState = { phase: "idle" } | { phase: "running" } | { phase: "done"; brief: DeskData["brief"]; receipt: DeskData["receipt"]; checks: DeskData["checks"] } | { phase: "refused"; why: string };

const REFUSED: Record<string, string> = {
  paused: "Live runs are paused by the kill switch. This is the recorded run.",
  capped: "Today's live budget is used up. This is the recorded run.",
  unavailable: "The live budget can't be checked right now, so nothing ran. This is the recorded run.",
  failed: "The live run didn't finish. Nothing was lost, and this is the recorded run.",
  not_owner: "Live runs are open to Paula's phone only until personal links arrive.",
};

// The brief, recorded by default. Paula's phone also gets Run it live, which swaps in a fresh run with its receipt.
export function BriefView({ data }: { data: DeskData }) {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [live, setLive] = useState<LiveState>({ phase: "idle" });
  useEffect(() => {
    fetch("/api/owner", { cache: "no-store" })
      .then((r) => r.json())
      .then((o: Owner) => setOwner(o))
      .catch(() => setOwner({ owner: false }));
  }, []);

  const run = async () => {
    setLive({ phase: "running" });
    try {
      const r = await fetch("/api/live", { method: "POST" });
      const j = await r.json();
      if (j.status === "ok") setLive({ phase: "done", brief: j.brief, receipt: j.receipt, checks: j.checks });
      else setLive({ phase: "refused", why: REFUSED[j.status] ?? REFUSED.failed! });
      fetch("/api/owner", { cache: "no-store" }).then((x) => x.json()).then(setOwner).catch(() => {});
    } catch {
      setLive({ phase: "refused", why: REFUSED.failed! });
    }
  };

  const shown = live.phase === "done" ? { ...data, brief: live.brief, receipt: live.receipt, checks: live.checks, recordedAt: live.receipt.runAt } : data;
  return (
    <div className="space-y-3">
      {owner?.owner ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-300/30 bg-sky-300/[0.06] px-4 py-2 text-sm">
          <span className="text-white/70">
            {live.phase === "running"
              ? "Running live now, about ten seconds."
              : live.phase === "refused"
                ? live.why
                : live.phase === "done"
                  ? "This brief just ran live."
                  : owner.paused
                    ? "Live runs are paused."
                    : owner.unavailable
                      ? "Live budget unavailable."
                      : `Live budget today, $${((owner.spentMicroUsd ?? 0) / 1e6).toFixed(2)} of $${((owner.capMicroUsd ?? 0) / 1e6).toFixed(2)} used.`}
          </span>
          <button
            type="button"
            onClick={run}
            disabled={live.phase === "running" || owner.paused}
            className="min-h-11 rounded-full bg-sky-300 px-4 text-sm font-semibold text-neutral-950 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-sky-100"
          >
            {live.phase === "running" ? "Running\u2026" : "Run it live"}
          </button>
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
  return (
    <div className="space-y-3 text-sm">
      <button type="button" onClick={onBack} className="min-h-11 rounded-full px-3 text-sm font-medium text-sky-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300">
        {backLabel}
      </button>
      <h2 className="text-lg font-semibold">How {section} was made</h2>

      <div className="rounded-xl bg-white/[0.06] p-4">
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
        <div className="rounded-xl bg-white/[0.06] p-4">
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Cost</h3>
          <p className="text-lg font-semibold">{usd(r.costMicroUsd)}</p>
          <p className="text-white/60">
            {r.usage.input.toLocaleString()} in, {r.usage.output.toLocaleString()} out
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.06] p-4">
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Time</h3>
          <p className="text-lg font-semibold">{(r.latencyMs.total / 1000).toFixed(1)}s</p>
          <p className="text-white/60">first event {(r.latencyMs.firstEvent / 1000).toFixed(1)}s</p>
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.06] p-4">
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Checked in code</h3>
        <ul className="space-y-1">
          {CODE_CHECKS.map((c) => {
            const v = ck[c.key];
            return (
              <li key={c.key}>
                <span className={v?.passed ? "text-emerald-300" : "text-rose-300"}>{v?.passed ? "Pass" : "Fail"}</span> {c.plain}.
                {v && v.detail !== c.plain ? <span className="text-white/50"> {v.detail}</span> : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-white/50">Judged criteria are scored in the Engine Room on Paula’s ten cases.</p>
      </div>

      <div className="rounded-xl bg-white/[0.06] p-4">
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Guardrails that acted</h3>
        <ul className="space-y-2">
          {r.guardrails.map((g, i) => (
            <li key={i}>
              <span className="font-medium">
                {g.owasp} {g.layer}, {g.action}
              </span>
              {g.detail ? <span className="block text-white/60">{g.detail}</span> : null}
            </li>
          ))}
          <li>
            <span className="font-medium">LLM03 capability, nothing to hijack</span>
            <span className="block text-white/60">The desk has no send, forward or buy tool, so no email can make it act.</span>
          </li>
        </ul>
      </div>

      <div className="rounded-xl bg-white/[0.06] p-4">
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-white/60 uppercase">Versions</h3>
        <p className="text-white/60">
          Prompt {r.promptVersion}. Policy {r.policyVersion}. Trace {r.traceId.slice(0, 8)}.
        </p>
      </div>
    </div>
  );
}
