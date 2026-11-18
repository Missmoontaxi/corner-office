"use client";

import type { DeskData } from "@/lib/desk/data";
import { modelName } from "@/lib/desk/shared";

const usd = (micro: number) => `$${(micro / 1e6).toFixed(3)}`;
// The eval run's date in New York, such as "Fri, Oct 30, 2026".
const runDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", year: "numeric" });

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white/[0.06] p-4 text-sm">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-white/60 uppercase">{title}</h3>
      {children}
    </section>
  );
}

// Workdays in a year, for the per-executive line. One brief each workday.
const WORKDAYS = 250;
// Who graded a line, in plain names, such as "code and Claude Sonnet 5.5 from Anthropic".
const grader = (by: string) => by.split(" and ").map((p) => (p === "code" ? "code" : modelName(p))).join(" and ");

// One card per model in the registry. The headline is what code checks the same way for every model. Judged
// lines name their judge, and nothing is summed or ranked across judges. A model the scorecard does not cover
// says it has not been tested, rather than showing a projection as a result.
function ModelCards({ data, onCompare }: { data: DeskData; onCompare?: () => void }) {
  return (
    <Panel title={`Models, ${data.models.length} in the registry`}>
      <p className="mb-3 text-white/60">Every model reaches Corner Office through one gateway, and the registry decides who does each job. Prices are list prices per million tokens, in and out.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.models.map((m) => {
          // Only lines code alone checks lead the card, since they grade every model the same way.
          const code = m.score?.criteria.filter((c) => c.checkedBy === "code") ?? [];
          const judged = m.score?.criteria.filter((c) => c.checkedBy !== "code" && c.mustPass) ?? [];
          return (
            <li key={m.id} className="min-w-0 rounded-lg bg-black/20 p-3">
              <h4 className="font-medium">{modelName(m.id)}</h4>
              <p className="text-xs text-white/50 tabular-nums">
                ${m.priceIn.toFixed(2)} in, ${m.priceOut.toFixed(2)} out
              </p>
              {m.jobs.length ? (
                <ul className="mt-2 space-y-0.5 text-white/80">
                  {m.jobs.map((j) => (
                    <li key={j}>{j}</li>
                  ))}
                </ul>
              ) : null}
              {m.briefToday ? (
                <p className="mt-2 text-white/70">
                  Today&apos;s brief cost {usd(m.briefToday.costMicroUsd)}, about ${Math.round((m.briefToday.costMicroUsd / 1e6) * WORKDAYS)} per executive a year at one brief each workday.
                </p>
              ) : null}
              {m.score ? (
                <div className="mt-2 text-xs">
                  <p className="text-white/60">On PM&apos;s {data.scorecard?.cases} cases, checked by code</p>
                  <ul>
                    {code.map((c) => (
                      <li key={c.id} className="flex justify-between gap-2">
                        <span>{c.label}</span>
                        <span className="font-medium whitespace-nowrap tabular-nums">
                          {c.passed} of {m.score!.graded}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {judged.length ? (
                    <>
                      <p className="mt-1 text-white/60">Other must-pass lines, each naming its grader</p>
                      <ul className="space-y-0.5">
                        {judged.map((c) => (
                          <li key={c.id} className="flex justify-between gap-2">
                            <span>
                              {c.label} <span className="text-white/45">By {grader(c.checkedBy)}.</span>
                            </span>
                            <span className="font-medium whitespace-nowrap tabular-nums">
                              {c.passed} of {m.score!.graded}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-xs text-white/50">Not yet tested on PM&apos;s cases for the brief.</p>
              )}
            </li>
          );
        })}
      </ul>
      {onCompare && data.compare.length > 1 ? (
        <button type="button" onClick={onCompare} className="mt-3 min-h-11 rounded-full border border-sky-300 px-4 text-sm font-medium text-sky-200 hover:bg-sky-300/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
          Compare today&apos;s two briefs
        </button>
      ) : null}
    </Panel>
  );
}

export function EngineRoom({ data, onCompare }: { data: DeskData; onCompare?: () => void }) {
  const r = data.receipt;
  const sc = data.scorecard;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Engine Room</h2>

      <Panel title="Router and cost">
        <p>
          This morning’s brief ran on <span className="font-medium">{r.route.model}</span>. {r.route.reason}
        </p>
        <p className="mt-2 text-white/70">
          {usd(r.costMicroUsd)} at list price, {(r.latencyMs.total / 1000).toFixed(0)} seconds, written ahead of time for no wait.
        </p>
      </Panel>

      <ModelCards data={data} onCompare={onCompare} />

      <Panel title="Guardrail feed">
        <ul className="space-y-2">
          <li>
            <span className="font-medium">Screen.</span> {data.screen.screened} of {data.screen.items} untrusted items screened{data.screen.model ? ` by ${data.screen.model}` : ""}. {data.screen.quarantined} quarantined before today’s brief model read through the day.
          </li>
          <li>
            <span className="font-medium">Output filter.</span> Any address not in the material is stripped. It removed {r.guardrails.filter((g) => g.layer === "output filter").length ? "something" : "nothing"} this morning.
          </li>
          {data.replay ? (
            <li className="rounded-lg bg-black/20 p-3">
              <span className="font-medium">Replay, with the screen turned off.</span>{" "}
              {data.replay.modelFlaggedIt
                ? `The planted item reached ${data.replay.model}, which flagged it on its own and did not follow it.`
                : `The planted item reached ${data.replay.model}, which did not flag it.`}{" "}
              {data.replay.filterStripped ? `The output filter stripped ${data.replay.filterStripped} address${data.replay.filterStripped > 1 ? "es" : ""}.` : "The output filter had nothing to strip."}{" "}
              {data.replay.addressReachedPage ? "The address reached the page." : "The address never reached the page."}
              <span className="mt-1 block text-white/60">When one layer misses, the next holds.</span>
            </li>
          ) : null}
        </ul>
      </Panel>

      {sc ? (
        <Panel title={`Scorecard, ${sc.cases} cases`}>
          <p className="mb-3 text-white/60">
            PM’s rubric, graded on her own cases against live models. Counts, not percentages.{sc.judgesCalibrated ? "" : " The judges are not yet calibrated against her labels."}
          </p>
          <p className="mb-3 text-xs text-white/50">Run {runDate(sc.runAt)}.</p>
          <div className="space-y-4">
            {sc.models.map((m) => {
              // Code-checked criteria lead, then the judged ones, each labeled with who checked it.
              const rows = [...m.criteria].sort((a, b) => Number(b.checkedBy === "code" || b.checkedBy.startsWith("code")) - Number(a.checkedBy === "code" || a.checkedBy.startsWith("code")));
              return (
                <div key={m.model}>
                  <h4 className="mb-1 font-medium">{m.model}</h4>
                  {m.ungraded?.length ? (
                    <p className="mb-1 text-xs text-amber-200/80">
                      {m.ungraded.map((u) => `${u.case} ${u.reason}`).join(", ")}, so {m.graded} of {sc.cases} cases were graded.
                    </p>
                  ) : null}
                  <table className="w-full text-left">
                    <thead className="sr-only">
                      <tr>
                        <th>Criterion</th>
                        <th>Checked by</th>
                        <th>Passed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {rows.map((c) => (
                        <tr key={c.id}>
                          <td className="py-1 pr-2">
                            {c.label}
                            {c.mustPass ? <span className="ml-1 text-[0.65rem] text-amber-200">must pass</span> : null}
                          </td>
                          <td className="py-1 pr-2 text-xs text-white/50">{c.checkedBy}</td>
                          <td className="py-1 text-right font-medium whitespace-nowrap tabular-nums">
                            {c.passed} of {m.graded}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
