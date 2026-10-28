"use client";

import type { DeskData } from "@/lib/desk/data";

const usd = (micro: number) => `$${(micro / 1e6).toFixed(3)}`;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white/[0.06] p-4 text-sm">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-white/60 uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function EngineRoom({ data }: { data: DeskData }) {
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
          <div className="space-y-4">
            {sc.models.map((m) => {
              // Code-checked criteria lead, then the judged ones, each labeled with who checked it.
              const rows = [...m.criteria].sort((a, b) => Number(b.checkedBy === "code" || b.checkedBy.startsWith("code")) - Number(a.checkedBy === "code" || a.checkedBy.startsWith("code")));
              return (
                <div key={m.model}>
                  <h4 className="mb-1 font-medium">{m.model}</h4>
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
