"use client";

import { useState } from "react";
import type { DeskData } from "@/lib/desk/data";
import { daysAgo, plainDay, type Call } from "@/lib/desk/shared";

const minutes = (hhmm: string) => {
  const m = hhmm.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

function NoModel() {
  return <p className="mt-4 border-t border-black/10 pt-2 text-xs text-black/50">No model used. Seeded data, rendered by code, $0.</p>;
}

function Paper({ title, big = false, children }: { title: string; big?: boolean; children: React.ReactNode }) {
  return (
    <article className="rounded-lg bg-[#f7f3ea] p-4 text-[#1d1b18] shadow-inner">
      <h2 className={`mb-3 font-semibold ${big ? "text-lg" : "text-base"}`}>{title}</h2>
      {children}
      <NoModel />
    </article>
  );
}

// Events on the same day whose times overlap, found in code from the seeded calendar.
function conflictsOf(cal: DeskData["calendar"]) {
  const out = new Set<string>();
  const today = cal.filter((e) => e.start.startsWith("D0"));
  for (const a of today)
    for (const b of today) {
      if (a.id >= b.id) continue;
      const [as, ae, bs, be] = [minutes(a.start), minutes(a.end), minutes(b.start), minutes(b.end)];
      if (as == null || ae == null || bs == null || be == null) continue;
      if (as < be && bs < ae) out.add(a.id).add(b.id);
    }
  return out;
}

export function CalendarDoc({ data }: { data: DeskData }) {
  const [call, setCall] = useState<Call | null>(null);
  const conflicts = conflictsOf(data.calendar);
  if (call) return <CallDoc data={data} call={call} onBack={() => setCall(null)} />;

  return (
    <Paper title="Alex's day">
      <ul className="divide-y divide-black/10 text-sm">
        {data.calendar.map((e) => {
          const task = e.notes?.match(/\bT\d{2}\b/)?.[0];
          const linked = task ? data.calls.find((c) => c.task === task) : undefined;
          return (
            <li key={e.id} className="py-2">
              <div className="flex gap-3">
                <span className="w-24 shrink-0 font-semibold text-black/85 tabular-nums">
                  {e.start.startsWith("D0 ") ? e.start.slice(3) : plainDay(e.start)} to {e.end}
                </span>
                <span className="font-medium">
                  {e.title}
                  {conflicts.has(e.id) ? <span className="ml-2 rounded bg-rose-600 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">conflict</span> : null}
                </span>
              </div>
              {linked ? (
                <button type="button" onClick={() => setCall(linked)} className="mt-1 ml-24 min-h-11 rounded-full px-3 text-left text-xs font-medium text-sky-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-sky-700">
                  The agent’s call to the provider, {linked.outcome}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Paper>
  );
}

function CallDoc({ data, call, onBack }: { data: DeskData; call: Call; onBack: () => void }) {
  const p = data.providers.find((x) => x.id === call.provider);
  const n = p ? daysAgo(p.verified_on) : null;
  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="min-h-11 rounded-full px-3 text-sm font-medium text-sky-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300">
        <span aria-hidden>‹ </span>
        Back to the calendar
      </button>
      <Paper title={`Call to ${p?.name ?? "the provider"}`}>
        {p ? (
          <p className="mb-3 text-xs text-black/60">
            {p.type}, {p.scope}. Verified {n === 0 ? "today" : n === 1 ? "1 day ago" : `${n} days ago`}.
          </p>
        ) : null}
        <ol className="space-y-2 text-sm">
          {call.turns.map((t, i) => (
            <li key={i}>
              <span className="mr-1 font-semibold">{t.speaker === "agent" ? "Agent (AI)" : t.speaker === "front_desk" ? "Front desk" : t.speaker}</span>
              {t.text}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm font-medium">
          {call.outcome[0]!.toUpperCase() + call.outcome.slice(1)}. {plainDay(call.next)}.
        </p>
      </Paper>
    </div>
  );
}

const fmt = (v: number | string, unit: string) => {
  if (typeof v !== "number") return `${v} ${unit}`.trim();
  if (unit === "USD") return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${v.toLocaleString()}`;
  if (unit === "percent") return `${Math.round(v * 1000) / 10}%`;
  return `${v.toLocaleString()} ${unit}`;
};

export function KpiDoc({ data }: { data: DeskData }) {
  const groups = new Map<string, DeskData["kpis"]>();
  for (const k of data.kpis) {
    const [area] = k.metric.split(": ");
    groups.set(area!, [...(groups.get(area!) ?? []), k]);
  }
  return (
    <Paper title="CareBird by the numbers" big>
      <div className="space-y-4 text-sm">
        {[...groups].map(([area, ks]) => (
          <section key={area}>
            <h3 className="mb-1 text-sm font-bold text-[#1f2d55]">{area}</h3>
            <dl className="divide-y divide-black/10">
              {ks.map((k) => (
                <div key={k.id} className="flex justify-between gap-4 py-1">
                  <dt className="text-black/75">{k.metric.split(": ").slice(1).join(": ")}</dt>
                  <dd className="shrink-0 font-medium tabular-nums">{fmt(k.value, k.unit ?? "")}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Paper>
  );
}
